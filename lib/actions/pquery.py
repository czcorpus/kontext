# Copyright(c) 2021 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

from typing import Optional
from controller import exposed
from controller.kontext import Kontext
from argmapping.pquery import PqueryFormArgs
from argmapping.query import QueryFormArgs
from werkzeug import Request
import plugins
from texttypes import TextTypesCache
import bgcalc
from bgcalc.pquery import require_existing_pquery
from bgcalc.pquery.errors import PqueryResultNotFound
import settings
from controller.kontext import AsyncTaskStatus
import time
from translation import ugettext as translate
from typing import List
from controller.errors import UserActionException
import sys
from main_menu import MainMenu, EventTriggeringItem


PAGE_SIZE = 10

"""
This module contains HTTP actions for the "Paradigmatic query" functionality
"""

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


def _load_conc_queries(conc_ids: List[str], corpus_id: str):
    ans = []
    with plugins.runtime.QUERY_PERSISTENCE as qs:
        for conc_id in conc_ids:
            data = qs.open(conc_id)
            if data is None:
                raise UserActionException('Source concordance query does not exist: {}'.format(conc_id))
            fdata = data.get('lastop_form', {})
            if fdata['form_type'] != 'query':
                raise UserActionException('Invalid source query used: {}'.format(conc_id))
            args = QueryFormArgs(corpora=[corpus_id], persist=True)
            tmp = args.updated(fdata, conc_id).to_dict()
            tmp['query_id'] = args.op_key
            ans.append(tmp)
    return ans


class ParadigmaticQuery(Kontext):

    PQUERY_QUICK_SAVE_MAX_LINES = 10000

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)

    def get_mapping_url_prefix(self):
        return '/pquery/'

    def _get_tagsets(self):
        corp_info = self.get_corpus_info(self.args.corpname)
        return [dict(ident=tagset.tagset_name, posAttr=tagset.pos_attr, featAttr=tagset.feat_attr,
                     docUrlLocal=tagset.doc_url_local, docUrlEn=tagset.doc_url_en)
                for tagset in corp_info.tagsets]

    def _get_default_attr(self):
        attrs = self.corp.get_conf('ATTRLIST').split(',')
        return 'lemma' if 'lemma' in attrs else attrs[0]

    @exposed(template='pquery/index.html', http_method='GET', page_model='pquery')
    def index(self, request):
        if 'query_id' in request.args:
            with plugins.runtime.QUERY_PERSISTENCE as qp:
                data = qp.open(request.args['query_id'])
                form = PqueryFormArgs()
                form.update_by_user_query(data)
        else:
            form = None
        ans = {
            'corpname': self.args.corpname,
            'form_data': form.to_dict() if form is not None else None,
            'tagsets': self._get_tagsets(),
            'pquery_default_attr': self._get_default_attr()
        }
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, ans)
        self._add_save_menu()
        return ans

    @exposed(template='pquery/result.html', http_method='GET', page_model='pqueryResult')
    def result(self, request):
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            stored_pq = qp.open(request.args.get('query_id'))
            pquery = PqueryFormArgs()
            pquery.update_by_user_query(stored_pq)
        pagesize = PAGE_SIZE  # TODO
        page = 1
        offset = (page - 1) * pagesize
        corp_info = self.get_corpus_info(self.args.corpname)
        conc_queries = _load_conc_queries(pquery.conc_ids, self.args.corpname)
        try:
            total_num_lines, freqs = require_existing_pquery(
                pquery, offset, pagesize, corp_info.collator_locale, 'freq', True)
            data_ready = True
        except PqueryResultNotFound:
            total_num_lines = 0
            freqs = []
            data_ready = False
        ans = {
            'corpname': self.args.corpname,
            'usesubcorp': self.args.usesubcorp,
            'query_id': request.args.get('query_id'),
            'freqs': freqs,
            'page': page,
            'pagesize': pagesize,
            'form_data': pquery.to_dict(),
            'conc_queries': conc_queries,
            'total_num_lines': total_num_lines,
            'data_ready': data_ready
        }
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, ans)
        self._add_save_menu()
        return ans

    @exposed(http_method='POST', return_type='json')
    def freq_intersection(self, request):
        """
        Run a paradigmatic query out of existing concordances.

        submitted JSON structure - see models.pquery.common.FreqIntersectionArgs
        """
        app = bgcalc.calc_backend_client(settings)
        corp_info = self.get_corpus_info(self.args.corpname)

        args = PqueryFormArgs()
        args.update_by_user_query(request.json)
        with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
            query_id = qp.store(user_id=self.session_get('user', 'id'), curr_data=args.to_qp())
            qh.write(user_id=self.session_get('user', 'id'), query_id=query_id, qtype='pquery')

        raw_queries = dict()
        with plugins.runtime.QUERY_PERSISTENCE as query_persistence:
            for conc_id in request.json.get('conc_ids'):
                raw_queries[conc_id] = query_persistence.open(conc_id)['q']
        calc_args = (
            args,
            raw_queries,
            self.subcpath,
            self.session_get('user', 'id'),
            corp_info.collator_locale if corp_info.collator_locale else 'en_US')
        res = app.send_task('calc_merged_freqs', args=calc_args,
                            time_limit=TASK_TIME_LIMIT)
        task_args = dict(query_id=query_id, last_update=time.time())
        async_task = AsyncTaskStatus(status=res.status, ident=res.id,
                                     category=AsyncTaskStatus.CATEGORY_PQUERY,
                                     label=translate('Paradigmatic query calculation'),
                                     args=task_args)
        self._store_async_task(async_task)
        return dict(task=async_task.to_dict())

    @exposed(http_method='GET', return_type='json', skip_corpus_init=True)
    def get_results(self, request):
        page_id = int(request.args['page']) - 1
        sort = request.args['sort']
        reverse = bool(int(request.args['reverse']))
        offset = page_id * PAGE_SIZE

        with plugins.runtime.QUERY_PERSISTENCE as qp:
            stored_pq = qp.open(request.args.get('query_id'))
        pquery = PqueryFormArgs()
        pquery.update_by_user_query(stored_pq)
        corp_info = self.get_corpus_info(self.args.corpname)
        total_num_lines, freqs = require_existing_pquery(
            pquery, offset, PAGE_SIZE, corp_info.collator_locale, sort, reverse)
        return dict(rows=freqs)

    @exposed(http_method='POST', return_type='json', skip_corpus_init=True)
    def save_query(self, request):
        args = PqueryFormArgs()
        args.update_by_user_query(request.json)
        with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
            query_id = qp.store(user_id=self.session_get('user', 'id'), curr_data=args.to_dict())
            qh.write(user_id=self.session_get('user', 'id'), query_id=query_id, qtype='pquery')
        return dict(ok=True, query_id=query_id)

    @exposed(access_level=1, func_arg_mapped=True, skip_corpus_init=True, return_type='plain')
    def download(self, query_id='', sort='value', reverse='0', saveformat='', from_line=1, to_line='',
                 colheaders=0, heading=0):
        """
        dawnload a paradigmatic query results
        """
        from_line = int(from_line) - 1
        to_line = int(to_line) if to_line else sys.maxsize

        with plugins.runtime.QUERY_PERSISTENCE as qp:
            stored_pq = qp.open(query_id)
        pquery = PqueryFormArgs()
        pquery.update_by_user_query(stored_pq)
        corp_info = self.get_corpus_info(self.args.corpname)
        _, freqs = require_existing_pquery(
            pquery, from_line, to_line - from_line, corp_info.collator_locale, sort, bool(int(reverse)))

        def mkfilename(suffix):
            return f'{self.args.corpname}-pquery.{suffix}'

        writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='pquery')
        writer.set_col_types(int, str, float)

        self._headers['Content-Type'] = writer.content_type()
        self._headers['Content-Disposition'] = f'attachment; filename="{mkfilename(saveformat)}"'

        if colheaders or heading:
            writer.writeheading(['', 'value', 'freq'])

        for (i, row) in enumerate(freqs):
            writer.writerow(i + 1, row)

        output = writer.raw_content()
        return output

    def _add_save_menu_item(self, label: str, save_format: Optional[str] = None, hint: Optional[str] = None):
        if save_format is None:
            event_name = 'MAIN_MENU_SHOW_SAVE_FORM'
            self._save_menu.append(
                EventTriggeringItem(MainMenu.SAVE, label, event_name, key_code=83, key_mod='shift',
                                    hint=hint).mark_indirect())  # key = 's'

        else:
            event_name = 'MAIN_MENU_DIRECT_SAVE'
            self._save_menu.append(EventTriggeringItem(MainMenu.SAVE, label, event_name, hint=hint
                                                       ).add_args(('saveformat', save_format)))

    def _add_save_menu(self):
        self._add_save_menu_item('CSV', save_format='csv',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.PQUERY_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XLSX', save_format='xlsx',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.PQUERY_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XML', save_format='xml',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.PQUERY_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item(translate('Custom'))

