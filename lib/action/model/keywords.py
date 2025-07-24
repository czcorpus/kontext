# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright(c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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


from typing import Any, Dict, Optional

import plugins
import settings
from action.argmapping import ConcArgsMapping, KeywordsArgsMapping
from action.argmapping.keywords import KeywordsFormArgs
from action.errors import UserReadableException
from action.krequest import KRequest
from action.model import ModelsSharedData
from action.model.corpus import CorpusActionModel, CorpusPluginCtx
from action.props import ActionProps
from action.response import KResponse
from main_menu.model import EventTriggeringItem, MainMenu
from sanic import Sanic


class KeywordsError(UserReadableException):
    pass


class KeywordsActionModel(CorpusActionModel):

    KEYWORDS_QUICK_SAVE_MAX_LINES = 10000

    def __init__(self, req: KRequest, resp: KResponse, action_props: ActionProps, shared_data: ModelsSharedData):
        super().__init__(req, resp, action_props, shared_data)
        self._curr_kwform_args: Optional[KeywordsFormArgs] = None
        self._plugin_ctx: Optional[KeywordsPluginCtx] = None

    @property
    def plugin_ctx(self):
        if self._plugin_ctx is None:
            self._plugin_ctx = KeywordsPluginCtx(self, self._req, self._resp, self._plg_shared)
        return self._plugin_ctx

    async def pre_dispatch(self, req_args):
        ans = await super().pre_dispatch(req_args)
        if self._active_q_data is not None:
            if self._active_q_data.get('form', {}).get('form_type') != 'kwords':
                raise UserReadableException('Invalid search session for a keywords')
            self._curr_kwform_args = KeywordsFormArgs.from_dict(
                self._active_q_data['form'], id=self._active_q_data['id'])
        return ans

    @property
    def curr_kwform_args(self):
        return self._curr_kwform_args

    def set_curr_kwform_args(self, args: KeywordsFormArgs):
        self._curr_kwform_args = args

    async def post_dispatch(self, action_props: ActionProps, resp: KResponse, err_desc):
        await super().post_dispatch(action_props, resp, err_desc)
        if action_props.mutates_result:
            with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
                query_id = await qp.store(
                    user_id=self.session_get('user', 'id'),
                    curr_data=dict(
                        form=self._curr_kwform_args.to_qp(),
                        corpora=[self._curr_kwform_args.corpname],
                        usesubcorp=self._curr_kwform_args.usesubcorp))
                ts = await qh.store(
                    user_id=self.session_get('user', 'id'),
                    query_id=query_id, q_supertype='kwords')
                for fn in self._on_query_store:
                    await fn([query_id], ts, resp.result)

    def export_form_args(self, result: Dict[str, Any]):
        if self._curr_kwform_args:
            result['keywords_form'] = self._curr_kwform_args.to_dict()
        else:
            result['keywords_form'] = None

    async def add_globals(self, app: Sanic, action_props: ActionProps, result: Dict[str, Any]) -> Dict[str, Any]:
        result = await super().add_globals(app, action_props, result)
        conc_args = self.get_mapped_attrs(KeywordsArgsMapping + ConcArgsMapping)
        q = self._req.args.get('q')
        if q:
            conc_args['q'] = [q]
        result['Globals'] = conc_args
        result['conc_dashboard_modules'] = settings.get_list('global', 'conc_dashboard_modules')
        return result

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
        self._add_save_menu_item(
            'CSV', save_format='csv',
            hint=self._req.translate(
                'Saves at most {0} items. Use "Custom" for more options.').format(self.KEYWORDS_QUICK_SAVE_MAX_LINES))
        self._add_save_menu_item(
            'XLSX', save_format='xlsx',
            hint=self._req.translate(
                'Saves at most {0} items. Use "Custom" for more options.').format(self.KEYWORDS_QUICK_SAVE_MAX_LINES))
        self._add_save_menu_item(
            'XML', save_format='xml',
            hint=self._req.translate(
                'Saves at most {0} items. Use "Custom" for more options.').format(self.KEYWORDS_QUICK_SAVE_MAX_LINES))
        self._add_save_menu_item(self._req.translate('Custom'))


class KeywordsPluginCtx(CorpusPluginCtx):
    pass
