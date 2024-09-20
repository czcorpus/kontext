# Copyright(c) 2016 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import os
import re
import urllib.parse
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple, Union
import asyncio
import logging
from sanic import Sanic

import conclib
import plugins
import settings
import strings
from action.argmapping import ConcArgsMapping
from action.argmapping.conc import build_conc_form_args
from action.argmapping.conc.filter import (
    ContextFilterArgsConv, FilterFormArgs, FirstHitsFilterFormArgs)
from action.argmapping.conc.other import SampleFormArgs, ShuffleFormArgs
from action.argmapping.conc.query import ConcFormArgs, QueryFormArgs
from action.argmapping.conc.sort import SortFormArgs
from action.errors import ImmediateRedirectException
from action.krequest import KRequest
from action.model import ModelsSharedData
from action.model.concordance.linesel import LinesGroups
from action.model.corpus import CorpusActionModel, CorpusPluginCtx
from action.props import ActionProps
from action.response import KResponse
from conclib import ConcDescJsonItem
from conclib.common import KConc
from conclib.search import get_conc
from main_menu.model import MainMenu
from plugin_types.corparch.corpus import CorpusInfo
from plugin_types.subc_storage import SubcListFilterArgs
from strings import simple_query_escape
from texttypes.model import TextTypeCollector


class ConcActionModel(CorpusActionModel):
    """
    ConcActionModel contains general logic for dealing with
    a concordance. Based on provided URL arguments (or form ones),
    it always tries to instantiate required corpus and a concordance
    (both typically identified by a concordance ID (q=~[hash])
    """
    CONC_QUICK_SAVE_MAX_LINES = 10000
    FREQ_QUICK_SAVE_MAX_LINES = 10000
    COLLS_QUICK_SAVE_MAX_LINES = 10000

    def __init__(self, req: KRequest, resp: KResponse, action_props: ActionProps, shared_data: ModelsSharedData):
        super().__init__(req, resp, action_props, shared_data)
        self._curr_conc_form_args: Optional[ConcFormArgs] = None
        # data of the current manual concordance line selection/categorization
        self._lines_groups: LinesGroups = LinesGroups(data=[])
        self._conc_dir: str = ''
        self._plugin_ctx: Optional[ConcPluginCtx] = None

    @property
    def plugin_ctx(self):
        if self._plugin_ctx is None:
            self._plugin_ctx = ConcPluginCtx(self, self._req, self._resp, self._plg_shared)
        return self._plugin_ctx

    async def _restore_prev_query_params(self, form):
        loaded = await super()._restore_prev_query_params(form)
        if loaded:
            self._lines_groups = LinesGroups.deserialize(
                self._active_q_data.get('lines_groups', []))
        return loaded

    async def fetch_prev_query(self, query_type: str) -> Optional[QueryFormArgs]:
        """
        Based on information about prev. query ID (and type) stored in session,
        load full form data of the previous query.

        In case the prev. operation is based on the same corpus, redirect
        immediately to the '/query' action with respective arguments.
        """
        curr = self._req.ctx.session.get('last_search', {})
        last_op = curr.get(query_type, None)
        if last_op:
            with plugins.runtime.QUERY_PERSISTENCE as qp, plugins.runtime.SUBC_STORAGE as subc_arch:
                last_op_form = await qp.open(last_op)
                if last_op_form is None:  # probably a lost/deleted concordance record
                    return None
                prev_corpora = last_op_form.get('corpora', [])
                prev_subcorp = last_op_form.get('usesubcorp', None)
                curr_corpora = [self.args.corpname] + self.args.align
                curr_subcorp = self.args.usesubcorp

                if prev_corpora and len(curr_corpora) == 1 and prev_corpora[0] == curr_corpora[0]:
                    args = [('corpname', prev_corpora[0])] + [('align', a)
                                                              for a in prev_corpora[1:]]

                    subcorpora = await subc_arch.list(
                        self._req.ctx.session.get('user')['id'], SubcListFilterArgs(), corpname=prev_corpora[0])
                    if prev_subcorp and not curr_subcorp and any(subc.id == prev_subcorp for subc in subcorpora):
                        args += [('usesubcorp', prev_subcorp)]

                    if len(args) > 1:
                        raise ImmediateRedirectException(self._req.create_url('query', args))

                if last_op_form:
                    if query_type == 'conc:filter':
                        qf_args = await FilterFormArgs.create(
                            plugin_ctx=self.plugin_ctx,
                            maincorp=self.args.corpname,
                            persist=False)
                        qf_args.apply_last_used_opts(last_op_form.get('lastop_form', {}))
                    else:
                        qf_args = await QueryFormArgs.create(
                            plugin_ctx=self.plugin_ctx,
                            corpora=self.select_current_aligned_corpora(active_only=False),
                            persist=False)
                        qf_args.apply_last_used_opts(
                            data=last_op_form.get('lastop_form', {}),
                            prev_corpora=prev_corpora,
                            curr_corpora=[self.args.corpname] + self.args.align,
                            curr_posattrs=self.corp.get_posattrs())
                    return qf_args
        return None

    def set_curr_conc_form_args(self, item: ConcFormArgs) -> None:
        """
        Set persistent form arguments for the currently processed
        action. The data are used in two ways:
        1) as a source of values when respective JS models are instantiated
        2) when conc persistence automatic save procedure
           is performed during post_dispatch() (see self.export_query_data())
        """
        self._curr_conc_form_args = item

    def export_query_data(self):
        """
        Export query data for query_persistence

        Return a 2-tuple with the following elements
            1) a flag specifying whether the query should be stored to user query history
               (please note that query history != stored/persistent query; query history is just a personal
               list of recent queries)
            2) values to be stored as a representation of user's query (here we mean all the data needed
               to reach the current result page including data needed to restore involved query forms).
        """
        if len(self._auto_generated_conc_ops) > 0:
            q_limit = self._auto_generated_conc_ops[0][0]
        else:
            q_limit = len(self.args.q)
        data = dict(
            # we don't want to store all the items from self.args.q in case auto generated
            # operations are present (we will store them individually later).
            user_id=self.session_get('user', 'id'),
            q=self.args.q[:q_limit],
            corpora=self.get_current_aligned_corpora(),
            usesubcorp=getattr(self.args, 'usesubcorp'),
            lines_groups=self._lines_groups.serialize()
        )
        use_history = True
        if self._curr_conc_form_args is not None and self._curr_conc_form_args.is_persistent:
            data.update(lastop_form=self._curr_conc_form_args.serialize())
            if (
                    isinstance(self._curr_conc_form_args, QueryFormArgs) or
                    isinstance(self._curr_conc_form_args, FilterFormArgs)):
                use_history = not self._curr_conc_form_args.data.no_query_history
        return use_history, data

    def update_output_with_group_info(self, tpl_data: Dict[str, Any]) -> None:
        tpl_data['num_lines_in_groups'] = len(self._lines_groups)
        tpl_data['lines_groups_numbers'] = tuple(set([v[2] for v in self._lines_groups]))

    def _output_last_op_id(self, op_id: Optional[str], tpl_data: Dict[str, Any]) -> None:
        """
        Update template data dictionary tpl_data with stored concordance operation values.
        In case the operation is new (i.e. something user just submitted from a respective
        form), replace temporary '__latest__' ID with actual ID obtained from conc_persistence
        plug-in.

        Note: the actual op. form data is accessed via '_active_q_data' property

        arguments:
        op_id -- unique operation ID as provided by conc_persistence plug-in
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
                    # TODO here we update already serialized objects which is not very readable/type safe
                    tpl_data['conc_forms_args'][op_id]['op_key'] = op_id
                    del tpl_data['conc_forms_args']['__latest__']
                    tpl_data['query_overview'][-1]['conc_persistence_op_id'] = op_id
            else:
                tpl_data['Q'] = []
                tpl_data['conc_persistence_op_id'] = None
        else:
            tpl_data['Q'] = getattr(self.args, 'q')[:]
        self.update_output_with_group_info(tpl_data)

        if len(self._lines_groups) > 0:
            self.disabled_menu_items += (
                MainMenu.FILTER, MainMenu.CONCORDANCE('sorting'),
                MainMenu.CONCORDANCE('shuffle'), MainMenu.CONCORDANCE('sample'))

    def acknowledge_auto_generated_conc_op(self, q_idx: int, query_form_args: ConcFormArgs) -> None:
        """
        In some cases, KonText automatically (either
        based on user's settings or for an internal reason)
        appends user-editable (which is a different situation
        compared e.g. with aligned corpora where there are
        also auto-added "q" elements but this is hidden from
        user) operations right after the current operation
        in self.args.q.

        E.g. user adds OP1, but we have to add also OP2, OP3
        where all the operations are user-editable (e.g. filters).
        In such case we must add OP1 but also "acknowledge"
        OP2 and OP3.

        Please note that it is expected that these operations
        come right after the query (no matter what q_idx says - it is
        used just to split original encoded query when storing
        the multi-operation as separate entities in query storage).

        Arguments:
        q_idx -- defines where the added operation resides within the q list
        query_form_args -- ConcFormArgs instance
        """
        self._auto_generated_conc_ops.append((q_idx, query_form_args))

    async def post_dispatch(self, action_props, resp, err_desc):
        """
        post_dispatch calls its descendant first, then
        it stores actual concordance parameters and updates
        action result accordingly
        """
        await super().post_dispatch(action_props, resp, err_desc)
        # create and store concordance query key
        if type(resp.result) is dict:
            if action_props.mutates_result:
                next_query_keys, history_ts = await self._store_conc_params()
            else:
                next_query_keys = [self._active_q_data.get(
                    'id', None)] if self._active_q_data else []
                history_ts = None
            for fn in self._on_query_store:
                if callable(fn):
                    await fn(next_query_keys, history_ts, resp.result)
            self._output_last_op_id(
                next_query_keys[-1] if len(next_query_keys) else None, resp.result)

    async def store_unbound_query_chain(self, chain: List[Tuple[str, ConcFormArgs]]):
        """
        Based on provided list of (raw query, form data) pairs, store all the
        operations like a standard KonText query chain. This is mostly used
        when dealing with backlinks from other apps (see actions create_view,
        create_lazy_view).
        """
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            self.args.q = []
            for i, (raw_q, farg) in enumerate(chain):
                self.args.q.append(raw_q)
                self.set_curr_conc_form_args(farg)
                if i < len(chain) - 1:
                    new_ids, _ = await self._store_conc_params()
                    self._active_q_data = await qp.open(new_ids[-1])

    async def _store_conc_params(self) -> Tuple[List[str], Optional[int]]:
        """
        Stores concordance operation if the query_persistence plugin is installed
        (otherwise nothing is done).

        returns:
        a list of 2-tuple (
            ID of the stored operation (or the current ID of nothing was stored),
            UNIX timestamp of stored history item (or None)
        """
        application = Sanic.get_app('kontext')
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            prev_data = self._active_q_data if self._active_q_data is not None else {}
            use_history, curr_data = self.export_query_data()
            user_id = self.session_get('user', 'id')
            qp_store_id = await qp.store(user_id, curr_data=curr_data, prev_data=self._active_q_data)
            ans = [qp_store_id]

            history_ts = await self._save_query_to_history(ans[0], curr_data) if use_history else None
            lines_groups = prev_data.get('lines_groups', self._lines_groups.serialize())
            for q_idx, op in self._auto_generated_conc_ops:
                prev = dict(id=ans[-1], lines_groups=lines_groups, q=getattr(self.args, 'q')[:q_idx],
                            corpora=self.get_current_aligned_corpora(), usesubcorp=self.args.usesubcorp,
                            user_id=self.session_get('user', 'id'))
                curr = dict(lines_groups=lines_groups,
                            q=getattr(self.args, 'q')[:q_idx + 1],
                            corpora=self.get_current_aligned_corpora(), usesubcorp=self.args.usesubcorp,
                            lastop_form=op.to_dict(), user_id=self.session_get('user', 'id'))
                qp_store_id = await qp.store(self.session_get('user', 'id'), curr_data=curr, prev_data=prev)
                ans.append(qp_store_id)
            return ans, history_ts

    def select_current_aligned_corpora(self, active_only: bool) -> List[str]:
        return self.get_current_aligned_corpora() if active_only else self.get_available_aligned_corpora()

    async def export_query_forms(self, tpl_out: Dict[str, Any]) -> List[ConcFormArgs]:
        """
        Export  data required by client-side forms which are
        part of the current query pipeline (i.e. initial query, filters,
        sorting, samples,...).

        Also export query_overview which is a list of Manatee arguments for
        each operation with attached concordance persistence IDs. The 'query_overview'
        is the only data structure keeping order of operations (directly; otherwise
        forms and their 'prev_id' can be theoretically used to rebuild the chain).
        """
        corpus_info = await self.get_corpus_info(self.args.corpname)
        tpl_out['metadata_desc'] = corpus_info.metadata.desc
        tpl_out['input_languages'] = {}
        tpl_out['input_languages'][self.args.corpname] = corpus_info.metadata.default_virt_keyboard \
            if corpus_info.metadata.default_virt_keyboard else corpus_info.collator_locale

        conc_forms_args: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        query_overview = await self.concdesc_json()
        if self._active_q_data is not None and 'lastop_form' in self._active_q_data:
            op_key = self._active_q_data['id']
            with plugins.runtime.QUERY_PERSISTENCE as qp:
                pipeline = await qp.load_pipeline_ops(self.plugin_ctx, op_key, build_conc_form_args)
                for i, item in enumerate(pipeline):
                    conc_forms_args[item.op_key] = item.to_dict()
                    if i < len(query_overview):
                        query_overview[i].conc_persistence_op_id = item.op_key
                        query_overview[i].is_registered_author = item.author_id is not None and not self.is_anonymous_id(item.author_id)
                    elif item.form_type != 'lgroup':
                        raise RuntimeError(
                            'Found a mismatch between Manatee query encoding and stored metadata')

        # Attach new form args added by the current action.
        if len(self._auto_generated_conc_ops) > 0:
            conc_forms_args['__latest__'] = self._auto_generated_conc_ops[-1][1].to_dict()
        elif self._curr_conc_form_args is not None:  # we add main query only iff there are no auto-generated ops
            item_key = '__latest__' if self._curr_conc_form_args.is_persistent else '__new__'
            conc_forms_args[item_key] = self._curr_conc_form_args.to_dict()
        tpl_out['conc_forms_args'] = conc_forms_args

        corpora = self.select_current_aligned_corpora(active_only=True)
        tpl_out['conc_forms_initial_args'] = dict(
            query=(await QueryFormArgs.create(
                plugin_ctx=self.plugin_ctx, corpora=corpora, persist=False)).to_dict(),
            filter=(await FilterFormArgs.create(
                plugin_ctx=self.plugin_ctx, maincorp=getattr(self.args, 'maincorp') if getattr(
                    self.args, 'maincorp') else getattr(self.args, 'corpname'), persist=False)).to_dict(),
            sort=SortFormArgs(persist=False).to_dict(),
            sample=SampleFormArgs(persist=False).to_dict(),
            shuffle=ShuffleFormArgs(persist=False).to_dict(),
            firsthits=FirstHitsFilterFormArgs(
                persist=False, struct=self.corp.get_conf('DOCSTRUCTURE')).to_dict())
        tpl_out['query_overview'] = [x.to_dict() for x in query_overview]
        if len(query_overview) > 0:
            tpl_out['page_title'] = '{0} ({1})'.format(
                strings.shorten(
                    f'{self.corp.human_readable_corpname} / {tpl_out["query_overview"][0]["nicearg"]}',
                    length=80,
                    nice=True,
                ),
                self._req.translate('Concordance'),
            )
        return [x for x in conc_forms_args.values()]

    async def add_globals(self, app, action_props, result):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        result = await super().add_globals(app, action_props, result)
        result['conc_dashboard_modules'] = settings.get_list('global', 'conc_dashboard_modules')
        conc_args = self.get_mapped_attrs(ConcArgsMapping)
        conc_args['q'] = [q for q in result.get('Q')]
        conc_args['cutoff'] = self.args.cutoff
        result['Globals'] = conc_args
        return result

    def apply_viewmode(self, sentence_struct):
        if self.args.viewmode == 'kwic':
            self.args.leftctx = self.args.kwicleftctx
            self.args.rightctx = self.args.kwicrightctx
        elif self.args.viewmode == 'align' and self.args.align:
            self.args.leftctx = 'a,%s' % os.path.basename(self.args.corpname)
            self.args.rightctx = 'a,%s' % os.path.basename(self.args.corpname)
        else:
            self.args.leftctx = self.args.senleftctx_tpl % sentence_struct
            self.args.rightctx = self.args.senrightctx_tpl % sentence_struct

    @staticmethod
    def compile_query(corpus: str, form: Union[QueryFormArgs, FilterFormArgs]) -> Optional[str]:
        if isinstance(form, QueryFormArgs):
            qtype = form.data.curr_query_types[corpus]
            query = form.data.curr_queries[corpus]
            icase = '' if form.data.curr_qmcase_values[corpus] else '(?i)'
            attr = form.data.curr_default_attr_values[corpus]
            use_regexp = form.data.curr_use_regexp_values[corpus]
            query_parsed = [x for x, _ in form.data.curr_parsed_queries[corpus]]
        else:
            qtype = form.data.query_type
            query = form.data.query
            icase = '' if form.data.qmcase else '(?i)'
            attr = form.data.default_attr
            use_regexp = form.data.use_regexp
            query_parsed = [x for x, _ in form.data.parsed_query]

        if query.strip() == '':
            return None

        def mk_query_val(q):
            if qtype == 'advanced' or use_regexp:
                return q.strip()
            return icase + simple_query_escape(q.strip())

        def stringify_parsed_query(q: List[List[str]]):
            expr = []
            for token_args in q:
                position = []
                for tok_attr, val in token_args:
                    if type(tok_attr) is str:
                        position.append(f'{tok_attr}="{mk_query_val(val)}"')
                    else:
                        position.append('({})'.format(' | '.join(
                            [f'{a2}="{mk_query_val(val)}"' for a2 in tok_attr])))
                expr.append('[' + ' & '.join(position) + ']')
            return ' '.join(expr)

        if qtype == 'simple':
            if query_parsed:
                return stringify_parsed_query(query_parsed)
            else:
                return ' '.join([f'[{attr}="{mk_query_val(part)}"]' for part in query.split(' ')])
        else:
            return re.sub(r'[\n\r]+', ' ', query).strip()

    async def set_first_query(self, corpora: List[str], form: QueryFormArgs, corpus_info: CorpusInfo):

        async def append_form_filter_op(opIdx, attrname, items, ctx, fctxtype):
            filter_args = await ContextFilterArgsConv(self._plugin_ctx, form)(
                corpora[0], attrname, items, ctx, fctxtype)
            self.acknowledge_auto_generated_conc_op(opIdx, filter_args)

        def ctx_to_str(ctx):
            return ' '.join(str(x) for x in ctx)

        async def append_filter(idx: int, attrname, items: List[str], ctx, fctxtype) -> int:
            """
            return next idx of a new acknowledged auto-operation idx (to be able to continue
            with appending of other ops). I.e. if the last operation appended
            here has idx = 7 then the returned value will be 8.
            """
            if not items:
                return idx
            if fctxtype == 'any':
                self.args.q.append('P{} [{}]'.format(
                    ctx_to_str(ctx), '|'.join([f'{attrname}="{i}"' for i in items])))
                await append_form_filter_op(idx, attrname, items, ctx, fctxtype)
                return idx + 1
            elif fctxtype == 'none':
                self.args.q.append('N{} [{}]'.format(
                    ctx_to_str(ctx), '|'.join([f'{attrname}="{i}"' for i in items])))
                await append_form_filter_op(idx, attrname, items, ctx, fctxtype)
                return idx + 1
            elif fctxtype == 'all':
                for i, v in enumerate(items):
                    self.args.q.append('P{} [{}="{}"]'.format(ctx_to_str(ctx), attrname, v))
                    await append_form_filter_op(idx + i, attrname, [v], ctx, fctxtype)
                return idx + len(items)

        if 'lemma' in self.corp.get_posattrs():
            lemmaattr = 'lemma'
        else:
            lemmaattr = 'word'

        wpos_patt_map = {}
        for tagset in corpus_info.tagsets:
            if tagset.ident == corpus_info.default_tagset:
                wpos_patt_map = dict((x.pos, x.pattern) for x in tagset.pos_category)
                break

        if form.data.curr_default_attr_values[corpora[0]]:
            qbase = f'a{form.data.curr_default_attr_values[corpora[0]]},'
        else:
            qbase = 'q'

        texttypes = TextTypeCollector(self.corp, form.data.selected_text_types).get_query()
        if texttypes:
            ttquery = ' '.join([f'within <{attr} {expr} />' for attr, expr in texttypes])
        else:
            ttquery = ''
        par_query = ''
        nopq = []
        for al_corpname in corpora[1:]:
            wnot = '' if form.data.curr_pcq_pos_neg_values[al_corpname] == 'pos' else '!'
            pq = self.compile_query(corpus=al_corpname, form=form)
            if pq:
                par_query += f'within{wnot} {al_corpname}:{pq}'
            if not pq or wnot:
                nopq.append(al_corpname)

        self.args.q = [
            ' '.join(x for x in [qbase + self.compile_query(corpora[0], form), ttquery, par_query] if x)]
        ag_op_idx = 1  # an initial index of auto-generated conc. operations
        ag_op_idx = await append_filter(
            ag_op_idx,
            lemmaattr,
            form.data.fc_lemword.split(),
            (form.data.fc_lemword_wsize[0], form.data.fc_lemword_wsize[1], 1),
            form.data.fc_lemword_type)
        await append_filter(
            ag_op_idx,
            'tag',
            [wpos_patt_map.get(t, '') for t in form.data.fc_pos],
            (form.data.fc_pos_wsize[0], form.data.fc_pos_wsize[1], 1),
            form.data.fc_pos_type)

        for al_corpname in corpora[1:]:
            if al_corpname in nopq and not int(form.data.curr_include_empty_values[al_corpname]):
                self.args.q.append('X%s' % al_corpname)
        if len(corpora) > 1:
            self.args.viewmode = 'align'

    @staticmethod
    def create_empty_conc_result_dict() -> Dict[str, Any]:
        """
        Create a minimal concordance result data required by the client-side app to operate properly.
        """
        pagination = dict(lastPage=0, prevPage=None, nextPage=None, firstPage=0)
        return dict(
            Lines=[], CorporaColumns=[], KWICCorps=[], pagination=pagination, Sort_idx=[],
            concsize=0, fullsize=0, sampled_size=0, result_relative_freq=0, result_arf=0,
            result_shuffled=False, finished=True, merged_attrs=[], merged_ctxattrs=[])

    def apply_linegroups(self, conc: KConc):
        """
        Applies user-defined line groups stored via query_persistence
        to the provided concordance instance.
        """
        if self._lines_groups.is_defined():
            for lg in self._lines_groups:
                conc.set_linegroup_at_pos(lg[0], lg[2])
            if self._lines_groups.sorted:
                conclib.sort_line_groups(conc, [x[2] for x in self._lines_groups])

    @property
    def lines_groups(self):
        return self._lines_groups

    @lines_groups.setter
    def lines_groups(self, lg: LinesGroups):
        self._lines_groups = lg

    async def get_speech_segment(self):
        """
        Returns:
            tuple (structname, attr_name)
        """
        segment_str = (await self.get_corpus_info(self.args.corpname)).speech_segment
        if segment_str:
            return tuple(segment_str.split('.'))
        return None

    async def get_conc_sizes(self, conc: KConc):
        i = 1
        concsize = conc.size()
        fullsize = conc.fullsize()
        sampled_size = 0
        while i < len(self.args.q) and not self.args.q[i].startswith('r'):
            i += 1
        if i < len(self.args.q):
            sampled_size = concsize

        for j in range(i + 1, len(self.args.q)):
            if self.args.q[j][0] in ('p', 'n'):
                return dict(concsize=concsize, sampled_size=0, relconcsize=0, fullsize=fullsize,
                            finished=conc.finished())
        if sampled_size:
            orig_conc = await get_conc(
                corp=self.corp, user_id=self.session_get('user', 'id'),
                q=self.args.q[:i], fromp=self.args.fromp, pagesize=self.args.pagesize, asnc=False)
            concsize = orig_conc.size()
            fullsize = orig_conc.fullsize()

        return dict(sampled_size=sampled_size, concsize=concsize,
                    relconcsize=1e6 * fullsize / self.corp.search_size,
                    fullsize=fullsize, finished=conc.finished())

    async def concdesc_json(self):
        """
        Return encoded query description (i.e. just Manatee args, no form info)
        """
        out_list: List[ConcDescJsonItem] = []
        conc_desc = await conclib.get_conc_desc(corpus=self.corp, q=self.args.q, cutoff=self.args.cutoff)

        def nicearg(arg, oid):
            if oid == 'F':
                return arg
            args = arg.split('"')
            niceargs = []
            prev_val = ''
            prev_other = ''
            exclude = False
            for i, arg_i in enumerate(args):
                if i % 2:
                    tmparg = arg_i.strip('\\').replace('(?i)', '')
                    if tmparg != prev_val or '|' not in prev_other:
                        if exclude:
                            exclude = False
                            niceargs.append(f'!{tmparg}')
                        else:
                            niceargs.append(tmparg)
                    prev_val = tmparg
                else:
                    if arg_i.startswith('within'):
                        niceargs.append('within')
                    if '!=' in arg_i:
                        exclude = True
                    prev_other = arg_i
            return ', '.join(niceargs)
        # o,  a,    u1,   u2,   s,           opid
        # op, args, url1, url2, size, fsize, opid
        for op_item in conc_desc:
            op_item.url2.append(('corpname', self.args.corpname))
            if self.args.usesubcorp:
                op_item.url2.append(('usesubcorp', self.args.usesubcorp))
            out_list.append(ConcDescJsonItem(
                op=self._req.translate(op_item.op),
                opid=op_item.opid,
                args=op_item.args,
                nicearg=nicearg(op_item.args, op_item.opid),
                tourl=urllib.parse.urlencode(op_item.url2),
                size=op_item.size,
                fullsize=op_item.fullsize))
        return out_list

    @staticmethod
    def filter_lines(data, pnfilter):
        def expand(x, n):
            return list(range(x, x + n))

        sel_lines = []
        for item in data:
            sel_lines.append(''.join(['[#%d]' % x2 for x2 in expand(item[0], item[1])]))
        return '%s%s %s %i %s' % (pnfilter, 0, 0, 0, '|'.join(sel_lines))

    # TODO this should be part of 'views'
    def go_to_restore_conc(self, return_action: str):
        args = []
        for k in self._req.args.keys():
            for val in self._req.args_getlist(k):
                args.append((k, val))
        args.append(('next', return_action))
        raise ImmediateRedirectException(self._req.create_url('restore_conc', args))


class ConcPluginCtx(CorpusPluginCtx):
    pass
