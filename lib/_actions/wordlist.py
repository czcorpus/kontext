# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import logging
from typing import Optional, Callable, List, Dict, Any, Union

from corplib.errors import MissingSubCorpFreqFile
from controller import exposed
from controller.kontext import Kontext
from main_menu.model import MainMenu
from translation import ugettext as translate
from action.errors import UserActionException
from bgcalc import freq_calc, calc_backend_client
from bgcalc.errors import BgCalcError
from bgcalc.wordlist import make_wl_query, require_existing_wordlist
import plugins
import settings
from action.argmapping import log_mapping
from action.argmapping.wordlist import WordlistFormArgs, WordlistSaveFormArgs
from werkzeug import Request
from texttypes.model import TextTypesCache
from action.argmapping import WordlistArgsMapping, ConcArgsMapping
from action.req_args import RequestArgsProxy, JSONRequestArgsProxy


class WordlistError(UserActionException):
    pass


class Wordlist(Kontext):

    FREQ_FIGURES = {'docf': 'Document counts', 'frq': 'Word counts', 'arf': 'ARF'}

    WORDLIST_QUICK_SAVE_MAX_LINES = 10000

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self._curr_wlform_args: Optional[WordlistFormArgs] = None
        self.on_conc_store: Callable[[List[str], Optional[int],
                                      Dict[str, Any]], None] = lambda s, uh, res: None

    def get_mapping_url_prefix(self):
        return '/wordlist/'

    def pre_dispatch(self, action_name, action_metadata=None) -> Union[RequestArgsProxy, JSONRequestArgsProxy]:
        ans = super().pre_dispatch(action_name, action_metadata)
        if self._active_q_data is not None:
            if self._active_q_data.get('form', {}).get('form_type') != 'wlist':
                raise UserActionException('Invalid search session for a word-list')
            self._curr_wlform_args = WordlistFormArgs.from_dict(
                self._active_q_data['form'], id=self._active_q_data['id'])
        return ans

    def post_dispatch(self, methodname, action_metadata, tmpl, result, err_desc):
        super().post_dispatch(methodname, action_metadata, tmpl, result, err_desc)
        if action_metadata['mutates_result']:
            with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
                query_id = qp.store(user_id=self.session_get('user', 'id'),
                                    curr_data=dict(form=self._curr_wlform_args.to_qp(),
                                                   corpora=[self._curr_wlform_args.corpname],
                                                   usesubcorp=self._curr_wlform_args.usesubcorp))
                ts = qh.store(
                    user_id=self.session_get('user', 'id'),
                    query_id=query_id, q_supertype='wlist')
                self.on_conc_store([query_id], ts, result)

    def export_form_args(self, result):
        if self._curr_wlform_args:
            result['wordlist_form'] = self._curr_wlform_args.to_dict()
        else:
            result['wordlist_form'] = None

    def add_globals(self, request, result, methodname, action_metadata):
        super().add_globals(request, result, methodname, action_metadata)
        conc_args = self._get_mapped_attrs(WordlistArgsMapping + ConcArgsMapping)
        q = request.args.get('q')
        if q:
            conc_args['q'] = [q]
        result['Globals'] = conc_args
        result['conc_dashboard_modules'] = settings.get_list('global', 'conc_dashboard_modules')
