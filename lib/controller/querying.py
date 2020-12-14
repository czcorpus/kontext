# Copyright(c) 2016 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2016 Tomas Machalek <tomas.machalek @ gmail.com>
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

"""
This module contains a functionality related to
extended, re-editable query processing.
"""

from typing import Dict, Any, Optional, List
from argmapping.query import ConcFormArgs
from werkzeug import Request

import logging

from controller.kontext import Kontext
from texttypes import TextTypesCache
import corplib
import plugins
from argmapping.query import (FilterFormArgs, QueryFormArgs, SortFormArgs, SampleFormArgs, ShuffleFormArgs,
                              FirstHitsFilterFormArgs, build_conc_form_args)
from translation import ugettext as translate
from controller import exposed
from collections import defaultdict


class Querying(Kontext):
    """
    A controller for actions which rely on
    query input form (either directly or indirectly).
    It introduces a concept of a 'query pipeline' which
    is in fact a series of stored form arguments chained
    by 'prev_id' reference (i.e. a reversed list).
    """

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self._curr_conc_form_args: Optional[ConcFormArgs] = None

    def get_mapping_url_prefix(self) -> str:
        return super(Kontext, self).get_mapping_url_prefix()

    def acknowledge_auto_generated_conc_op(self, q_idx: int, query_form_args: ConcFormArgs) -> None:
        """
        In some cases KonText may automatically (either
        based on user's settings or for an internal reason)
        append user-editable (which is a different situation
        compared e.g. with aligned corpora where there are
        also auto-added "q" elements but this is hidden from
        user) operations right after the initial query.

        To be able to chain these operations and offer
        a way to edit them, KonText must store them too.

        Arguments:
        q_idx -- defines where the added operation resides within the q list
        query_form_args -- ConcFormArgs instance
        """
        self._auto_generated_conc_ops.append((q_idx, query_form_args))

    def add_conc_form_args(self, item: ConcFormArgs) -> None:
        """
        Add persistent form arguments for a currently processed
        action. The data are used in two ways:
        1) as a source of values when respective JS Flux stores are instantiated
        2) when conc persistence automatic save procedure
           is performed during post_dispatch() (see self.get_saveable_conc_data())
        """
        self._curr_conc_form_args = item

    def get_saveable_conc_data(self) -> Dict[str, Any]:
        """
        Export data stored by conc_persistence
        """
        ans = super().get_saveable_conc_data()

        if self._curr_conc_form_args is not None and self._curr_conc_form_args.is_persistent:
            ans.update(lastop_form=self._curr_conc_form_args.serialize())
        return ans

    def _select_current_aligned_corpora(self, active_only: bool):
        return self.get_current_aligned_corpora() if active_only else self.get_available_aligned_corpora()

    def _attach_query_params(self, tpl_out: Dict[str, Any]):
        """
        Attach data required by client-side forms which are
        part of the current query pipeline (i.e. initial query, filters,
        sorting, samples,...)
        """
        corpus_info = self.get_corpus_info(getattr(self.args, 'corpname'))
        tpl_out['metadata_desc'] = corpus_info['metadata']['desc']
        tpl_out['input_languages'] = {}
        tpl_out['input_languages'][getattr(self.args, 'corpname')] = corpus_info['collator_locale']
        if self._prev_q_data is not None and 'lastop_form' in self._prev_q_data:
            op_key = self._prev_q_data['id']
            conc_forms_args = {
                op_key: build_conc_form_args(self._prev_q_data.get('corpora', []), self._prev_q_data['lastop_form'],
                                             op_key).to_dict()
            }
        else:
            conc_forms_args = {}
        # Attach new form args added by the current action.
        if len(self._auto_generated_conc_ops) > 0:
            conc_forms_args['__latest__'] = self._auto_generated_conc_ops[-1][1].to_dict()
        elif self._curr_conc_form_args is not None:  # we add main query only iff there are no auto-generated ops
            item_key = '__latest__' if self._curr_conc_form_args.is_persistent else '__new__'
            conc_forms_args[item_key] = self._curr_conc_form_args.to_dict()
        tpl_out['conc_forms_args'] = conc_forms_args

        corpora = self._select_current_aligned_corpora(active_only=True)
        tpl_out['conc_forms_initial_args'] = dict(
            query=QueryFormArgs(corpora=corpora, persist=False).to_dict(),
            filter=FilterFormArgs(
                maincorp=getattr(self.args, 'maincorp') if getattr(self.args, 'maincorp') else getattr(self.args, 'corpname'),
                persist=False
            ).to_dict(),
            sort=SortFormArgs(persist=False).to_dict(),
            sample=SampleFormArgs(persist=False).to_dict(),
            shuffle=ShuffleFormArgs(persist=False).to_dict(),
            firsthits=FirstHitsFilterFormArgs(persist=False, doc_struct=self.corp.get_conf('DOCSTRUCTURE')).to_dict()
        )

    def _attach_aligned_query_params(self, tpl_out: Dict[str, Any]):
        """
        Adds template data required to generate components for adding/overviewing
        aligned corpora. This is called by individual actions.

        arguments:
        tpl_out -- a dict where exported data is stored
        """
        if self.corp.get_conf('ALIGNED'):
            tpl_out['Aligned'] = []
            if 'input_languages' not in tpl_out:
                tpl_out['input_languages'] = {}
            for al in self.corp.get_conf('ALIGNED').split(','):
                alcorp = corplib.open_corpus(al)
                tpl_out['Aligned'].append(dict(label=alcorp.get_conf('NAME') or al, n=al))
                attrlist = alcorp.get_conf('ATTRLIST').split(',')
                poslist = getattr(self.cm, 'corpconf_pairs')(alcorp, 'WPOSLIST')
                tpl_out['Wposlist_' + al] = [{'n': x[0], 'v': x[1]} for x in poslist]
                if 'lempos' in attrlist:
                    poslist = getattr(self.cm, 'corpconf_pairs')(alcorp, 'LPOSLIST')
                tpl_out['Lposlist_' + al] = [{'n': x[0], 'v': x[1]} for x in poslist]
                tpl_out['input_languages'][al] = self.get_corpus_info(al)['collator_locale']

    @exposed(return_type='json', http_method='GET')
    def ajax_fetch_conc_form_args(self, request: Request) -> Dict[str, Any]:
        try:
            # we must include only regular (i.e. the ones visible in the breadcrumb-like
            # navigation bar) operations - otherwise the indices would not match.
            pipeline = [x for x in self.load_pipeline_ops(request.args['last_key']) if x.form_type != 'nop']
            op_data = pipeline[int(request.args['idx'])]
            return op_data.to_dict()
        except (IndexError, KeyError):
            self.add_system_message('error', translate('Operation not found in the storage'))
            return {}

    @staticmethod
    def load_pipeline_ops(last_id: str) -> List[ConcFormArgs]:
        ans = []
        # here checking if instance exists -> we can ignore type check error cp.open does not exist on None
        if plugins.runtime.CONC_PERSISTENCE.exists:
            with plugins.runtime.CONC_PERSISTENCE as cp:
                data = cp.open(last_id)  # type: ignore
                if data is not None:
                    ans.append(build_conc_form_args(
                        data.get('corpora', []), data.get('lastop_form', {}), data['id']))
                limit = 100
                while data is not None and data.get('prev_id') and limit > 0:
                    data = cp.open(data['prev_id'])  # type: ignore
                    ans.insert(0, build_conc_form_args(
                        data.get('corpora', []), data.get('lastop_form', {}), data['id']))
                    limit -= 1
                    if limit == 0:
                        logging.getLogger(__name__).warning('Reached hard limit when loading query pipeline {0}'.format(
                            last_id))
        return ans

    def _get_structs_and_attrs(self) -> Dict[str, List[str]]:
        structs_and_attrs: Dict[str, List[str]] = defaultdict(list)
        attrs = (t for t in self.corp.get_conf('STRUCTATTRLIST').split(',') if t != '')
        for s, a in [t.split('.') for t in attrs]:
            structs_and_attrs[s].append(a)
        return dict(structs_and_attrs)

    def add_globals(self, result: Dict[str, Any], methodname: str, action_metadata: Dict[str, Any]):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        super().add_globals(result, methodname, action_metadata)

        result['structs_and_attrs'] = self._get_structs_and_attrs()
