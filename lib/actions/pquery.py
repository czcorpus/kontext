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
from werkzeug import Request
import plugins
from texttypes import TextTypesCache
import bgcalc
import settings
from controller.kontext import AsyncTaskStatus
import time
from translation import ugettext as translate
import os
import csv
from controller.errors import NotFoundException
from main_menu import MainMenu, EventTriggeringItem

"""
This module contains HTTP actions for the "Paradigmatic query" functionality
"""

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


class ParadigmaticQuery(Kontext):

    PQUERY_QUICK_SAVE_MAX_LINES = 10000

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)

    def get_mapping_url_prefix(self):
        return '/pquery/'

    def _init_page_data(self, request):
        query_id = request.args.get('query_id')
        data = None
        if query_id:
            with plugins.runtime.QUERY_PERSISTENCE as qs:
                data = qs.open(query_id)
        if data is not None:
            data['corpname'] = data['corpora'][0]
            del data['corpora']
        return data

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
        data = self._init_page_data(request)
        ans = {
            'corpname': self.args.corpname,
            'form_data': data,
            'calculate': False,
            'tagsets': self._get_tagsets(),
            'pquery_default_attr': self._get_default_attr()
        }
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, ans)
        self._add_save_menu()
        return ans

    @exposed(template='pquery/index.html', http_method='GET', page_model='pquery')
    def result(self, request):
        data = self._init_page_data(request)
        ans = {
            'corpname': self.args.corpname,
            'form_data': data,
            'calculate': True,
            'tagsets': self._get_tagsets(),
            'pquery_default_attr': self._get_default_attr()
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

        raw_queries = dict()
        with plugins.runtime.QUERY_PERSISTENCE as query_persistence:
            for conc_id in request.json.get('conc_ids'):
                raw_queries[conc_id] = query_persistence.open(conc_id)['q']
        calc_args = (
            request.json,
            raw_queries,
            self.subcpath,
            self.session_get('user', 'id'),
            corp_info.collator_locale if corp_info.collator_locale else 'en_US')
        res = app.send_task('calc_merged_freqs', args=calc_args,
                            time_limit=TASK_TIME_LIMIT)
        task_args = dict(conc_id=conc_id, last_update=time.time())
        async_task = AsyncTaskStatus(status=res.status, ident=res.id,
                                     category=AsyncTaskStatus.CATEGORY_PQUERY,
                                     label=translate('Paradigmatic query calculation'),
                                     args=task_args)
        self._store_async_task(async_task)
        return dict(task=async_task.to_dict())

    @exposed(http_method='GET', return_type='json', skip_corpus_init=True)
    def get_results(self, request):
        page_id = int(request.args['page']) - 1
        page_size = int(request.args['page_size'])
        sort = request.args['sort']
        reverse = bool(int(request.args['reverse']))
        resultId = request.args['resultId']

        path = os.path.join(settings.get('corpora', 'freqs_cache_dir'), f'pquery_{resultId}.csv')
        if os.path.exists(path):
            with open(path, 'r') as fr:
                csv_reader = csv.reader(fr)
                if sort == 'freq':
                    data = sorted([row for row in csv_reader],
                                  key=lambda x: int(x[1]), reverse=reverse)
                elif sort == 'value':
                    data = sorted([row for row in csv_reader], key=lambda x: x[0], reverse=reverse)
            return data[page_id * page_size:(page_id + 1) * page_size]

        raise NotFoundException(f'Pquery calculation is lost')

    @exposed(http_method='POST', return_type='json', skip_corpus_init=True)
    def save_query(self, request):
        args = PqueryFormArgs()
        args.update_by_user_query(request.json)
        with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
            query_id = qp.store(user_id=self.session_get('user', 'id'), curr_data=args.to_dict())
            qh.write(user_id=self.session_get('user', 'id'), query_id=query_id, qtype='pquery')
        return dict(ok=True, query_id=query_id)

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
