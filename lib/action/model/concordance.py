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

from typing import Dict, Any, Optional, List, Tuple
from action.argmapping.conc.query import ConcFormArgs
from werkzeug import Request
from collections import defaultdict

from action.model.base import BaseActionModel
from main_menu.model import MainMenu
from texttypes import TextTypesCache
import plugins
from plugin_types.corparch.corpus import StructAttrInfo
from action.argmapping.conc.query import QueryFormArgs
from action.argmapping.conc.filter import FilterFormArgs, FirstHitsFilterFormArgs
from action.argmapping.conc.sort import SortFormArgs
from action.argmapping.conc.other import SampleFormArgs, ShuffleFormArgs
from action.argmapping.conc import build_conc_form_args


class ConcActionModel(BaseActionModel):
    """
    A controller for actions which rely on
    query input form (either directly or indirectly).
    It introduces a concept of a 'query pipeline' which
    is in fact a series of stored form arguments chained
    by 'prev_id' reference (i.e. a reversed list).
    """

    def __init__(self, request: Request, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, tt_cache=tt_cache)
        self._curr_conc_form_args: Optional[ConcFormArgs] = None

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
        1) as a source of values when respective JS models are instantiated
        2) when conc persistence automatic save procedure
           is performed during post_dispatch() (see self.export_query_data())
        """
        self._curr_conc_form_args = item

    def export_query_data(self):
        _, data = super().export_query_data()
        use_history = True
        if self._curr_conc_form_args is not None and self._curr_conc_form_args.is_persistent:
            data.update(lastop_form=self._curr_conc_form_args.serialize())
            if (
                    isinstance(self._curr_conc_form_args, QueryFormArgs) or
                    isinstance(self._curr_conc_form_args, FilterFormArgs)):
                use_history = not self._curr_conc_form_args.data.no_query_history
        return use_history, data

    def _update_output_with_conc_params(self, op_id: str, tpl_data: Dict[str, Any]) -> None:
        """
        Updates template data dictionary tpl_data with stored operation values.

        arguments:
        op_id -- unique operation ID
        tpl_data -- a dictionary used along with HTML template to render the output
        """
        if plugins.runtime.QUERY_PERSISTENCE.exists:
            if op_id:
                tpl_data['Q'] = [f'~{op_id}']
                tpl_data['conc_persistence_op_id'] = op_id
                if self._active_q_data:  # => main query already entered; user is doing something else
                    # => additional operation => ownership is clear
                    if self._active_q_data.get('id', None) != op_id:
                        tpl_data['user_owns_conc'] = True
                    else:  # some other action => we have to check if user is the author
                        tpl_data['user_owns_conc'] = self._active_q_data.get(
                            'user_id', None) == self.session_get('user', 'id')
                else:  # initial query => ownership is clear
                    tpl_data['user_owns_conc'] = True
                if '__latest__' in tpl_data.get('conc_forms_args', {}):
                    tpl_data['conc_forms_args'][op_id] = tpl_data['conc_forms_args']['__latest__']
                    del tpl_data['conc_forms_args']['__latest__']
            else:
                tpl_data['Q'] = []
                tpl_data['conc_persistence_op_id'] = None
        else:
            tpl_data['Q'] = getattr(self.args, 'q')[:]
        tpl_data['num_lines_in_groups'] = len(self._lines_groups)
        tpl_data['lines_groups_numbers'] = tuple(set([v[2] for v in self._lines_groups]))

        if len(self._lines_groups) > 0:
            self.disabled_menu_items += (MainMenu.FILTER, MainMenu.CONCORDANCE('sorting'),
                                         MainMenu.CONCORDANCE('shuffle'), MainMenu.CONCORDANCE('sample'))

    def post_dispatch(self, methodname, action_metadata, tmpl, result, err_desc):
        super().post_dispatch(methodname, action_metadata, tmpl, result, err_desc)
        # create and store concordance query key
        if type(result) is dict:
            if action_metadata['mutates_result']:
                next_query_keys, history_ts = self._store_conc_params()
            else:
                next_query_keys = [self._active_q_data.get(
                    'id', None)] if self._active_q_data else []
                history_ts = None
            self.on_conc_store(next_query_keys, history_ts, result)
            self._update_output_with_conc_params(
                next_query_keys[-1] if len(next_query_keys) else None, result)

    def _store_conc_params(self) -> Tuple[List[str], Optional[int]]:
        """
        Stores concordance operation if the query_persistence plugin is installed
        (otherwise nothing is done).

        returns:
        a 2-tuple (
            ID of the stored operation (or the current ID of nothing was stored),
            UNIX timestamp of stored history item (or None)
        """
        with plugins.runtime.QUERY_PERSISTENCE as cp:
            prev_data = self._active_q_data if self._active_q_data is not None else {}
            use_history, curr_data = self.export_query_data()
            ans = [cp.store(self.session_get('user', 'id'),
                            curr_data=curr_data, prev_data=self._active_q_data)]
            history_ts = self._save_query_to_history(ans[0], curr_data) if use_history else None
            lines_groups = prev_data.get('lines_groups', self._lines_groups.serialize())
            for q_idx, op in self._auto_generated_conc_ops:
                prev = dict(id=ans[-1], lines_groups=lines_groups, q=getattr(self.args, 'q')[:q_idx],
                            corpora=self.get_current_aligned_corpora(), usesubcorp=getattr(self.args, 'usesubcorp'),
                            user_id=self.session_get('user', 'id'))
                curr = dict(lines_groups=lines_groups,
                            q=getattr(self.args, 'q')[:q_idx + 1],
                            corpora=self.get_current_aligned_corpora(), usesubcorp=getattr(self.args, 'usesubcorp'),
                            lastop_form=op.to_dict(), user_id=self.session_get('user', 'id'))
                ans.append(cp.store(self.session_get('user', 'id'), curr_data=curr, prev_data=prev))
            return ans, history_ts

    def _select_current_aligned_corpora(self, active_only: bool) -> List[str]:
        return self.get_current_aligned_corpora() if active_only else self.get_available_aligned_corpora()

    def _attach_query_params(
            self, tpl_out: Dict[str, Any], query: Optional[QueryFormArgs] = None,
            filter: Optional[FilterFormArgs] = None, sort: Optional[SortFormArgs] = None,
            sample: Optional[SampleFormArgs] = None, shuffle: Optional[ShuffleFormArgs] = None,
            firsthits: Optional[FirstHitsFilterFormArgs] = None) -> None:
        """
        Attach data required by client-side forms which are
        part of the current query pipeline (i.e. initial query, filters,
        sorting, samples,...). If any of query, filter,..., firsthits is provided than
        it is used instead of the default variant of the form.
        """
        corpus_info = self.get_corpus_info(self.args.corpname)
        tpl_out['metadata_desc'] = corpus_info.metadata.desc
        tpl_out['input_languages'] = {}
        tpl_out['input_languages'][getattr(self.args, 'corpname')] = corpus_info.collator_locale
        if self._active_q_data is not None and 'lastop_form' in self._active_q_data:
            op_key = self._active_q_data['id']
            conc_forms_args = {
                op_key: build_conc_form_args(
                    self._plugin_ctx, self._active_q_data.get('corpora', []),
                    self._active_q_data['lastop_form'], op_key).to_dict()
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
            query=query.to_dict() if query is not None else QueryFormArgs(
                plugin_ctx=self._plugin_ctx, corpora=corpora, persist=False).to_dict(),
            filter=filter.to_dict() if filter is not None else FilterFormArgs(
                plugin_ctx=self._plugin_ctx, maincorp=getattr(self.args, 'maincorp') if getattr(
                    self.args, 'maincorp') else getattr(self.args, 'corpname'), persist=False).to_dict(),
            sort=sort.to_dict() if sort is not None else SortFormArgs(persist=False).to_dict(),
            sample=sample.to_dict() if sample is not None else SampleFormArgs(persist=False).to_dict(),
            shuffle=shuffle.to_dict() if shuffle is not None else ShuffleFormArgs(persist=False).to_dict(),
            firsthits=firsthits.to_dict() if firsthits is not None else FirstHitsFilterFormArgs(
                persist=False, doc_struct=self.corp.get_conf('DOCSTRUCTURE')).to_dict())

    def _attach_aligned_query_params(self, tpl_out: Dict[str, Any]) -> None:
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
                alcorp = self.cm.get_corpus(al)
                corp_info = self.get_corpus_info(al)

                tpl_out['Aligned'].append(dict(label=alcorp.get_conf('NAME') or al, n=al))

                poslist = []
                for tagset in corp_info.tagsets:
                    if tagset.ident == corp_info.default_tagset:
                        poslist = tagset.pos_category
                        break
                tpl_out['Wposlist_' + al] = [{'n': x.pos, 'v': x.pattern} for x in poslist]
                tpl_out['input_languages'][al] = corp_info.collator_locale


    def _get_structs_and_attrs(self) -> Dict[str, List[StructAttrInfo]]:
        structs_and_attrs: Dict[str, List[StructAttrInfo]] = defaultdict(list)
        attrs = [t for t in self.corp.get_structattrs() if t != '']
        with plugins.runtime.CORPARCH as ca:
            for attr in ca.get_structattrs_info(self._plugin_ctx, self.corp.corpname, attrs):
                structs_and_attrs[attr.structure_name].append(attr)
        return dict(structs_and_attrs)

    def add_globals(self, request, result, methodname, action_metadata):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        super().add_globals(request, result, methodname, action_metadata)

        result['structs_and_attrs'] = self._get_structs_and_attrs()
