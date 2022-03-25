# Copyright(c) 2022 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

from typing import Dict, Any, Optional, List, Tuple, Union
from action.req_args import JSONRequestArgsProxy, RequestArgsProxy

import plugins
from action import ActionProps
from action.krequest import KRequest
from action.response import KResponse
from action.argmapping.conc.query import QueryFormArgs
from action.argmapping.conc.filter import FilterFormArgs
from action.argmapping.pquery import PqueryFormArgs
from action.model.corpus import CorpusActionModel, CorpusPluginCtx
from action.errors import UserActionException
from main_menu.model import EventTriggeringItem, MainMenu
from texttypes.model import TextTypesCache
import settings


class PQueryPluginCtx(CorpusPluginCtx):
    pass


class ParadigmaticQueryActionModel(CorpusActionModel):

    PQUERY_QUICK_SAVE_MAX_LINES = 10000

    TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)

    def __init__(self, req: KRequest, resp: KResponse, action_props: ActionProps, tt_cache: TextTypesCache):
        super().__init__(req, resp, action_props, tt_cache)
        self._curr_pquery_args: Optional[PqueryFormArgs] = None
        self._plugin_ctx: Optional[PQueryPluginCtx] = None

    @property
    def plugin_ctx(self):
        if self._plugin_ctx is None:
            self._plugin_ctx = PQueryPluginCtx(self, self._req, self._resp)
        return self._plugin_ctx

    async def load_conc_queries(self, conc_ids: List[str], corpus_id: str,
                                form_type: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Load both conc. query forms and respective raw Manatee queries

        form_type is either 'query' or 'filter'
        """
        forms = {}
        raw_queries = {}
        with plugins.runtime.QUERY_PERSISTENCE as qs:
            for conc_id in conc_ids:
                data = await qs.open(conc_id)
                if data is None:
                    raise UserActionException(
                        'Source concordance query does not exist: {}'.format(conc_id))
                if qs.stored_form_type(data) != form_type:
                    raise UserActionException('Invalid source query used: {}'.format(conc_id))
                if form_type == 'query':
                    args = (await QueryFormArgs.create(
                        plugin_ctx=self.plugin_ctx, corpora=[corpus_id], persist=True)).updated(data['lastop_form'], conc_id)
                elif form_type == 'filter':
                    args = (await FilterFormArgs.create(
                        plugin_ctx=self.plugin_ctx, maincorp=corpus_id, persist=True)).updated(data['lastop_form'], conc_id)
                forms[args.op_key] = args.to_dict()
                raw_queries[args.op_key] = data['q']
        return forms, raw_queries

    async def export_form_args(self, result):
        if self._curr_pquery_args:
            result['pquery_form'] = self._curr_pquery_args.to_dict()
            result['conc_forms'], _ = await self.load_conc_queries(
                self._curr_pquery_args.conc_ids, self.args.corpname, 'query')
            if self._curr_pquery_args.conc_subset_complements:
                s_forms, _ = await self.load_conc_queries(
                    self._curr_pquery_args.conc_subset_complements.conc_ids,
                    self.args.corpname, 'query')
                result['conc_forms'].update(s_forms)
            if self._curr_pquery_args.conc_superset:
                s_forms, _ = await self.load_conc_queries(
                    [self._curr_pquery_args.conc_superset.conc_id],
                    self.args.corpname, 'query')
                result['conc_forms'].update(s_forms)
        else:
            result['pquery_form'] = None
            result['conc_forms'] = {}

    async def get_tagsets(self):
        corp_info = await self.get_corpus_info(self.args.corpname)
        return [tagset.to_dict() for tagset in corp_info.tagsets]

    def get_default_attr(self):
        attrs = self.corp.get_posattrs()
        return 'lemma' if 'lemma' in attrs else attrs[0]

    async def pre_dispatch(self, req_args: Union[RequestArgsProxy, JSONRequestArgsProxy]):
        ans = await super().pre_dispatch(req_args)
        if self._active_q_data is not None:
            if self._active_q_data.get('form', {}).get('form_type') != 'pquery':
                raise UserActionException('Invalid search session for a paradimatic query')
            self._curr_pquery_args = PqueryFormArgs(
                corpname=self.corp.corpname,
                attr=self.get_default_attr(),
                position='0<0~0>0'
            )
            self._curr_pquery_args.from_dict(self._active_q_data['form'])

        return ans

    async def post_dispatch(self, action_props: ActionProps, result, err_desc):
        await super().post_dispatch(action_props, result, err_desc)
        # create and store concordance query key
        if action_props.mutates_result:
            with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
                query_id = await qp.store(user_id=self.session_get('user', 'id'),
                                          curr_data=dict(form=self._curr_pquery_args.to_qp(),
                                                         corpora=[self._curr_pquery_args.corpname],
                                                         usesubcorp=self._curr_pquery_args.usesubcorp))
                ts = await qh.store(
                    user_id=self.session_get('user', 'id'),
                    query_id=query_id, q_supertype='pquery')
                for fn in self._on_query_store:
                    fn([query_id], ts, result)

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

    def add_save_menu(self):
        self._add_save_menu_item('CSV', save_format='csv',
                                 hint=self._req.translate(f'Saves at most {self.PQUERY_QUICK_SAVE_MAX_LINES} items. Use "Custom" for more options.'))
        self._add_save_menu_item('XLSX', save_format='xlsx',
                                 hint=self._req.translate(f'Saves at most {self.PQUERY_QUICK_SAVE_MAX_LINES} items. Use "Custom" for more options.'))
        self._add_save_menu_item('XML', save_format='xml',
                                 hint=self._req.translate(f'Saves at most {self.PQUERY_QUICK_SAVE_MAX_LINES} items. Use "Custom" for more options.'))
        self._add_save_menu_item(self._req.translate('Custom'))
