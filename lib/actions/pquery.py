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

from typing import Optional, Callable, List, Dict, Any, Tuple
import time
import sys
from werkzeug import Request
from controller import exposed
from controller.kontext import Kontext
from controller.errors import UserActionException, NotFoundException
from argmapping.pquery import PqueryFormArgs
from argmapping.conc.query import QueryFormArgs
from argmapping.conc.filter import FilterFormArgs
import plugins
from texttypes import TextTypesCache
import bgcalc
from bgcalc.pquery import require_existing_pquery
from bgcalc.pquery.errors import PqueryResultNotFound
from bgcalc.task import AsyncTaskStatus
from action.plg import PluginCtx
from translation import ugettext as translate
from main_menu.model import MainMenu, EventTriggeringItem, MenuItemInternal
import settings


"""
This module contains HTTP actions for the "Paradigmatic query" functionality
"""

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


def _load_conc_queries(plugin_ctx: PluginCtx, conc_ids: List[str], corpus_id: str,
                       form_type: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Load both conc. query forms and respective raw Manatee queries

    form_type is either 'query' or 'filter'
    """
    forms = {}
    raw_queries = {}
    with plugins.runtime.QUERY_PERSISTENCE as qs:
        for conc_id in conc_ids:
            data = qs.open(conc_id)
            if data is None:
                raise UserActionException(
                    'Source concordance query does not exist: {}'.format(conc_id))
            if qs.stored_form_type(data) != form_type:
                raise UserActionException('Invalid source query used: {}'.format(conc_id))
            if form_type == 'query':
                args = QueryFormArgs(
                    plugin_ctx=plugin_ctx, corpora=[corpus_id], persist=True).updated(data['lastop_form'], conc_id)
            elif form_type == 'filter':
                args = FilterFormArgs(
                    plugin_ctx=plugin_ctx, maincorp=corpus_id, persist=True).updated(data['lastop_form'], conc_id)
            forms[args.op_key] = args.to_dict()
            raw_queries[args.op_key] = data['q']
    return forms, raw_queries


class ParadigmaticQuery(Kontext):

    PQUERY_QUICK_SAVE_MAX_LINES = 10000

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self._curr_pquery_args: Optional[PqueryFormArgs] = None
        self.on_conc_store: Callable[[List[str], Optional[int],
                                      Dict[str, Any]], None] = lambda s, uh, res: None

    def get_mapping_url_prefix(self):
        return '/pquery/'

    def export_form_args(self, result):
        if self._curr_pquery_args:
            result['pquery_form'] = self._curr_pquery_args.to_dict()
            result['conc_forms'], _ = _load_conc_queries(
                self._plugin_ctx, self._curr_pquery_args.conc_ids, self.args.corpname, 'query')
            if self._curr_pquery_args.conc_subset_complements:
                s_forms, _ = _load_conc_queries(
                    self._plugin_ctx, self._curr_pquery_args.conc_subset_complements.conc_ids,
                    self.args.corpname, 'query')
                result['conc_forms'].update(s_forms)
            if self._curr_pquery_args.conc_superset:
                s_forms, _ = _load_conc_queries(
                    self._plugin_ctx, [self._curr_pquery_args.conc_superset.conc_id],
                    self.args.corpname, 'query')
                result['conc_forms'].update(s_forms)
        else:
            result['pquery_form'] = None
            result['conc_forms'] = {}

    def _get_tagsets(self):
        corp_info = self.get_corpus_info(self.args.corpname)
        return [tagset.to_dict() for tagset in corp_info.tagsets]

    def _get_default_attr(self):
        attrs = self.corp.get_posattrs()
        return 'lemma' if 'lemma' in attrs else attrs[0]

    def pre_dispatch(self, action_name, action_metadata=None):
        ans = super().pre_dispatch(action_name, action_metadata)
        if self._active_q_data is not None:
            if self._active_q_data.get('form', {}).get('form_type') != 'pquery':
                raise UserActionException('Invalid search session for a paradimatic query')
            self._curr_pquery_args = PqueryFormArgs(
                corpname=self.corp.corpname,
                attr=self._get_default_attr(),
                position='0<0~0>0'
            )
            self._curr_pquery_args.from_dict(self._active_q_data['form'])

        return ans

    def post_dispatch(self, methodname, action_metadata, tmpl, result, err_desc):
        super().post_dispatch(methodname, action_metadata, tmpl, result, err_desc)
        # create and store concordance query key
        if action_metadata['mutates_result']:
            with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
                query_id = qp.store(user_id=self.session_get('user', 'id'),
                                    curr_data=dict(form=self._curr_pquery_args.to_qp(),
                                                   corpora=[self._curr_pquery_args.corpname],
                                                   usesubcorp=self._curr_pquery_args.usesubcorp))
                ts = qh.store(
                    user_id=self.session_get('user', 'id'),
                    query_id=query_id, q_supertype='pquery')
                self.on_conc_store([query_id], ts, result)

    @exposed(template='pquery/index.html', http_method='GET', page_model='pquery')
    def index(self, request):
        self.disabled_menu_items = (MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.VIEW('kwic-sent-switch'))
        ans = {
            'corpname': self.args.corpname,
            'tagsets': self._get_tagsets(),
            'pquery_default_attr': self._get_default_attr(),
        }
        self.export_form_args(ans)
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, ans)
        self._add_save_menu()
        return ans

    @exposed(template='pquery/result.html', http_method='GET', page_model='pqueryResult')
    def result(self, request):
        pagesize = self.args.pqueryitemsperpage
        page = 1
        offset = (page - 1) * pagesize
        corp_info = self.get_corpus_info(self.args.corpname)
        try:
            total_num_lines, freqs = require_existing_pquery(
                self._curr_pquery_args, offset, pagesize, corp_info.collator_locale, 'freq', True)
            data_ready = True
        except PqueryResultNotFound:
            total_num_lines = 0
            freqs = []
            data_ready = False
        ans = {
            'corpname': self.args.corpname,
            'usesubcorp': self.args.usesubcorp,
            'query_id': self._q_code,
            'freqs': freqs,
            'page': page,
            'pagesize': pagesize,
            'total_num_lines': total_num_lines,
            'data_ready': data_ready
        }
        self.export_form_args(ans)
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, ans)
        self._add_save_menu()
        self.disabled_menu_items = (
            MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS,
            MainMenu.VIEW('kwic-sent-switch'))
        for i, conc_id in enumerate(self._curr_pquery_args.conc_ids):
            self._dynamic_menu_items.append(
                MenuItemInternal(
                    MainMenu.CONCORDANCE, translate('Go to the constituent concordance #{}').format(i+1), 'view'
                ).add_args(('q', f'~{conc_id}'))
            )
        return ans

    @exposed(http_method='POST', mutates_result=True, return_type='json')
    def freq_intersection(self, request):
        """
        Run a paradigmatic query out of existing concordances.

        submitted JSON structure - see models.pquery.common.FreqIntersectionArgs
        """
        worker = bgcalc.calc_backend_client(settings)
        corp_info = self.get_corpus_info(self.args.corpname)

        self._curr_pquery_args = PqueryFormArgs(
            corpname=self.corp.corpname,
            attr=self._get_default_attr(),
            position='0<0~0>0')
        self._curr_pquery_args.update_by_user_query(request.json)
        conc_forms, raw_queries = _load_conc_queries(
            self._plugin_ctx, self._curr_pquery_args.conc_ids, self.args.corpname, 'query')
        if self._curr_pquery_args.conc_subset_complements:
            conc_forms2, raw_queries2 = _load_conc_queries(
                self._plugin_ctx, self._curr_pquery_args.conc_subset_complements.conc_ids, self.args.corpname, 'query')
            raw_queries.update(raw_queries2)
        if self._curr_pquery_args.conc_superset:
            conc_forms3, raw_queries3 = _load_conc_queries(
                self._plugin_ctx, [self._curr_pquery_args.conc_superset.conc_id], self.args.corpname, 'query')
            raw_queries.update(raw_queries3)

        calc_args = (
            self._curr_pquery_args,
            raw_queries,
            self.subcpath,
            self.session_get('user', 'id'),
            corp_info.collator_locale if corp_info.collator_locale else 'en_US')
        task_status = worker.send_task(
            'calc_merged_freqs', object.__class__, args=calc_args, time_limit=TASK_TIME_LIMIT)
        sq_items = []
        for conc_id in self._curr_pquery_args.conc_ids:
            sq_items.append(conc_forms[conc_id]['curr_queries'][self.args.corpname])
        shortened_q = ' && '.join(f'{{{q}}}' for q in sq_items)
        shortened_q = f'{shortened_q} -> {self._curr_pquery_args.attr}'

        def on_conc_store(query_ids, history_ts, result):
            async_task = AsyncTaskStatus(
                status=task_status.status, ident=task_status.id,
                category=AsyncTaskStatus.CATEGORY_PQUERY,
                label=shortened_q,
                args=dict(query_id=query_ids[0], last_update=time.time()),
                url=self.create_url('pquery/result', dict(q=f'~{query_ids[0]}')))
            self._store_async_task(async_task)
            result['task'] = async_task.to_dict()
            if history_ts:
                self._store_last_search('pquery', query_ids[0])

        self.on_conc_store = on_conc_store
        return {}

    @exposed(http_method='GET', return_type='json')
    def get_results(self, request):
        page_id = int(request.args['page']) - 1
        sort = request.args['sort']
        reverse = bool(int(request.args['reverse']))
        offset = page_id * self.args.pqueryitemsperpage
        corp_info = self.get_corpus_info(self.args.corpname)
        try:
            total_num_lines, freqs = require_existing_pquery(
                self._curr_pquery_args, offset, self.args.pqueryitemsperpage, corp_info.collator_locale, sort, reverse)
        except PqueryResultNotFound:
            raise NotFoundException('pquery__result_no_more_avail_for_download_pls_update')
        return dict(rows=freqs)

    @exposed(access_level=1, func_arg_mapped=True, return_type='plain')
    def download(self, sort='value', reverse='0', saveformat='', from_line=1, to_line='',
                 colheaders=0, heading=0):
        """
        dawnload a paradigmatic query results
        """
        from_line = int(from_line) - 1
        to_line = int(to_line) if to_line else sys.maxsize
        corp_info = self.get_corpus_info(self.args.corpname)
        try:
            _, freqs = require_existing_pquery(
                self._curr_pquery_args, from_line, to_line - from_line,
                corp_info.collator_locale, sort, bool(int(reverse)))
        except PqueryResultNotFound:
            raise NotFoundException('pquery__result_no_more_avail_for_download_pls_update')

        def mkfilename(suffix):
            return f'{self.args.corpname}-pquery.{suffix}'

        writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='pquery')
        writer.set_col_types(int, str, float)

        self._response.set_header('Content-Type', writer.content_type())
        self._response.set_header('Content-Disposition', f'attachment; filename="{mkfilename(saveformat)}"')

        if colheaders or heading:
            writer.writeheading(['', 'value', 'freq'])

        for (i, row) in enumerate(freqs):
            writer.writerow(i + 1, row)

        output = writer.raw_content()
        return output

    def _add_save_menu_item(self, label: str, save_format: Optional[str] = None, hint: Optional[str] = None):
        if save_format is None:
            event_name = 'MAIN_MENU_SHOW_SAVE_FORM'
            self._dynamic_menu_items.append(
                EventTriggeringItem(MainMenu.SAVE, label, event_name, key_code=83, key_mod='shift',
                                    hint=hint).mark_indirect())  # key = 's'

        else:
            event_name = 'MAIN_MENU_DIRECT_SAVE'
            self._dynamic_menu_items.append(
                EventTriggeringItem(
                    MainMenu.SAVE, label, event_name, hint=hint).add_args(('saveformat', save_format)))

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
