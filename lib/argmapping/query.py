# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Dict, Any, List, Tuple, Optional
import re

import plugins
from plugins.abstract.corpora import TagsetInfo
from .error import ArgumentMappingError


class ConcFormArgs(object):
    """
    A helper class to handle miscellaneous
    concordance-related forms (filter, query, sort,...).

    It is also used to store/restore data via
    conc. persistence plug-in. Perstitent form can
    be tested using `is_persistent` property.
    """

    def __init__(self, persist: bool) -> None:
        self._persistent = persist
        self._op_key = '__new__'
        self.form_type: Optional[str] = None

    def updated(self, attrs: Dict[str, Any], op_key: str) -> 'ConcFormArgs':
        """
        Return an updated self object
        (the same instance). There must
        be always the 'op_key' value
        present to emphasize the fact
        that only serialized data (i.e.
        data with their database key)
        can be used to update an 'unbound'
        instance.
        """
        for k, v in attrs.items():
            if hasattr(self, k):
                setattr(self, k, v)
        self._op_key = op_key
        return self

    def to_dict(self) -> Dict[str, Any]:
        tmp = {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
        if not self.is_persistent:
            tmp['op_key'] = self._op_key
        return tmp

    def serialize(self) -> Dict[str, Any]:
        """
        Export data required to be saved. In case there
        are some corpus-dependent and fixed data (e.g. list of PoS),
        it can be omitted here and re-initialized in __init__
        from user-independent data. By default - all the
        object's attributes are exported.
        """
        return self.to_dict()

    @property
    def is_persistent(self) -> bool:
        return self._persistent

    @property
    def op_key(self) -> str:
        """
        op_key property has a special status as
        it is kept separate from other attributes
        and is exported only if an instance is
        persistent (= loaded from database). I.e.
        newly created objects (where op_key == '__new__')
        should not export it.
        """
        return self._op_key

    def make_saveable(self):
        self._op_key = '__new__'
        self._persistent = True


class LgroupOpArgs(ConcFormArgs):
    """
    This is used to store special actions that modify
    compiled query string but are produced in a special
    way and thus cannot be edited again (e.g. lines groups
    operations).
    """

    def __init__(self, persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'lgroup'


class LockedOpFormsArgs(ConcFormArgs):
    """
    This is used to store actions that modify compiled
    query string and are mapped to an existing user-editable
    form (see the difference with LgroupOpArgs) but we
    do not want user to edit them manually (e.g. user
    filters manually selected lines which produces a bunch
    of token IDs - nothing human-friendly). We actually
    do not bother with storing the arguments.
    """

    def __init__(self, persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'locked'


class QueryFormArgs(ConcFormArgs):
    """
    QueryFormArgs collects arguments required
    to initialize the 'query' for one or more
    corpora.

    The class is only used to make collecting and
    serializing data easier. Stored data are expected
    to be JSON-serializable.
    """

    def __init__(self, corpora: List[str], persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'query'

        empty_dict: Dict[str, Any] = {c: None for c in corpora}
        self.curr_query_types = {k: 'simple' for k in corpora}
        self.curr_queries = empty_dict.copy()
        self.curr_parsed_queries = empty_dict.copy()
        self.curr_pcq_pos_neg_values = empty_dict.copy()
        self.curr_include_empty_values = empty_dict.copy()
        self.curr_lpos_values = empty_dict.copy()
        self.curr_qmcase_values = empty_dict.copy()
        self.curr_default_attr_values = {k: None for k in corpora}
        self.curr_use_regexp_values = {k: False for k in corpora}
        self.tagsets = empty_dict.copy()
        self.has_lemma = empty_dict.copy()
        self.asnc = False

        # context filter
        self.fc_lemword_type = 'all'
        self.fc_lemword_wsize = (-5, 5)
        self.fc_lemword = ''
        self.fc_pos_type = 'all'
        self.fc_pos_wsize = (-5, 5)
        self.fc_pos = []

        self.selected_text_types: Dict[str, str] = {}
        # for bibliography structattr - maps from hidden ids to visible titles (this is optional)
        self.bib_mapping: Dict[str, str] = {}

        for corp in corpora:
            self._add_corpus_metadata(corp)

    def apply_last_used_opts(self, data: Dict[str, Any], prev_corpora: List[str], curr_corpora: List[str],
                             curr_posattrs: List[str]):
        self._test_data_type(data, 'form_type', 'query')
        prev_maincorp = prev_corpora[0]
        curr_maincorp = curr_corpora[0]
        self.curr_query_types[curr_maincorp] = data['curr_query_types'][prev_maincorp]
        self.curr_qmcase_values[curr_maincorp] = data['curr_qmcase_values'][prev_maincorp]
        self.curr_use_regexp_values[curr_maincorp] = data['curr_use_regexp_values'][prev_maincorp]
        prev_default_attr = data['curr_default_attr_values'][prev_maincorp]
        if prev_default_attr in curr_posattrs:
            self.curr_default_attr_values[curr_maincorp] = prev_default_attr
        else:
            self.curr_default_attr_values[curr_maincorp] = None

    @staticmethod
    def _test_data_type(data, type_key, type_id):
        data_type = data.get(type_key)
        if data_type != type_id:
            raise ArgumentMappingError(f'Invalid form data type "{data_type}" for a query form mapping.')

    def update_by_user_query(self, data, bib_mapping):
        self._test_data_type(data, 'type', 'concQueryArgs')
        self.asnc = data.get('async', False)
        for query in data['queries']:
            corp = query['corpname']
            self.curr_query_types[corp] = query['qtype']
            self.curr_queries[corp] = query.get('query')
            self.curr_parsed_queries[corp] = query.get('queryParsed', [])
            self.curr_pcq_pos_neg_values[corp] = query['pcq_pos_neg']
            self.curr_include_empty_values[corp] = query['include_empty']
            self.curr_qmcase_values[corp] = query.get('qmcase', False)
            self.curr_default_attr_values[corp] = query.get('default_attr')
            self.curr_use_regexp_values[corp] = query.get('use_regexp', False)
        self.bib_mapping = bib_mapping

        ctx = data['context']
        self.fc_lemword_type = ctx.get('fc_lemword_type', self.fc_lemword_type)
        self.fc_lemword_wsize = ctx.get('fc_lemword_wsize', self.fc_lemword_wsize)
        self.fc_lemword = ctx.get('fc_lemword', self.fc_lemword)
        self.fc_pos_type = ctx.get('fc_pos_type', self.fc_pos_type)
        self.fc_pos_wsize = ctx.get('fc_pos_wsize', self.fc_pos_wsize)
        self.fc_pos = ctx.get('fc_pos', self.fc_pos)

        self.selected_text_types = data['text_types']

    def _add_corpus_metadata(self, corpus_id: str):
        with plugins.runtime.CORPARCH as ca, plugins.runtime.TAGHELPER as th:
            corp_info = getattr(ca, 'get_corpus_info')('en_US', corpus_id)
            self.has_lemma[corpus_id] = corp_info.manatee.has_lemma
            self.tagsets[corpus_id] = [d.to_dict() for d in corp_info.tagsets]
            for ts in self.tagsets[corpus_id]:
                ts['widgetEnabled'] = th.tags_enabled_for(corpus_id, ts['ident'])

    def serialize(self) -> Dict[str, Any]:
        ans = super().to_dict()
        del ans['has_lemma']
        del ans['tagsets']
        return ans


class FilterFormArgs(ConcFormArgs):
    """
    FilterFormArgs collects arguments required
    to initialize the 'filter' form.

    The class is only used to make collecting and
    serializing data easier. Stored data are expected
    to be JSON-serializable.
    """

    def __init__(self, maincorp: str, persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'filter'
        self.query_type: str = 'simple'
        self.query: str = ''
        self.parsed_query: List[Any] = []
        self.maincorp: str = maincorp
        self.pnfilter: str = 'p'
        self.filfl: str = 'f'
        self.filfpos: str = '-5'
        self.filtpos: str = '5'
        self.inclkwic: bool = True
        self.qmcase: bool = False
        self.default_attr: str = 'word'
        self.use_regexp: bool = False
        self.has_lemma: bool = False
        self.tagsets: List[TagsetInfo] = []
        self.within: bool = False
        self._add_corpus_metadata()

    def update_by_user_query(self, data):
        self.query_type = data['qtype']
        self.query = data.get('query')
        self.parsed_query = data.get('queryParsed', [])
        self.pnfilter = data['pnfilter']
        self.filfl = data['filfl']
        self.filfpos = data['filfpos']
        self.filfpos = data['filfpos']
        self.filtpos = data['filtpos']
        self.inclkwic = data['inclkwic']
        self.qmcase = data['qmcase']
        self.within = data['within']
        self.default_attr = data['default_attr']
        self.use_regexp = data.get('use_regexp', False)

    def _add_corpus_metadata(self):
        with plugins.runtime.CORPARCH as ca, plugins.runtime.TAGHELPER as th:
            corp_info = ca.get_corpus_info('en_US', self.maincorp)
            self.has_lemma = corp_info.manatee.has_lemma
            self.tagsets = [d.to_dict() for d in corp_info.tagsets]
            for tagset in self.tagsets:
                tagset['widgetEnabled'] = th.tags_enabled_for(self.maincorp, tagset['ident'])


class SortFormArgs(ConcFormArgs):
    """
    SortFormArgs collects arguments required
    to initialize the 'sort' form.

    The class is only used to make collecting and
    serializing data easier. Stored data are expected
    to be JSON-serializable.
    """

    def __init__(self, persist: bool) -> None:
        """
        args:
            persist -- specify whether the object should be stored
                       to disk when the current action is finished
        """
        super().__init__(persist)
        self.form_type: str = 'sort'
        self.form_action: str = 'sortx'
        self.sattr: str = 'word'
        self.skey: str = 'kw'
        self.spos: int = 3  # number of tokens to sort
        self.sicase: str = ''
        self.sbward: str = ''
        self.sortlevel: int = 1
        self.ml1attr: str = 'word'
        self.ml2attr: str = 'word'
        self.ml3attr: str = 'word'
        self.ml4attr: str = 'word'
        self.ml1icase: str = ''
        self.ml2icase: str = ''
        self.ml3icase: str = ''
        self.ml4icase: str = ''
        self.ml1bward: str = ''
        self.ml2bward: str = ''
        self.ml3bward: str = ''
        self.ml4bward: str = ''
        self.ml1pos: int = 1
        self.ml2pos: int = 1
        self.ml3pos: int = 1
        self.ml4pos: int = 1
        self.ml1ctx: str = '0~0>0'
        self.ml2ctx: str = '0~0>0'
        self.ml3ctx: str = '0~0>0'
        self.ml4ctx: str = '0~0>0'

    def update_by_user_query(self, data: Dict[str, Any]):
        if data.get('type') == 'sortQueryArgs':
            self.sattr = data['sattr']
            self.skey = data['skey']
            self.sbward = data['sbward']
            self.sicase = data['sicase']
            self.spos = data['spos']
            self.form_action = 'sortx'
        elif data.get('type') == 'mlSortQueryArgs':
            self.form_action = 'mlsortx'
            self.sortlevel = len(data['levels'])
            for i, args in enumerate(data['levels']):
                setattr(self, f'ml{i+1}attr', args['sattr'])
                setattr(self, f'ml{i+1}bward', args['sbward'])
                setattr(self, f'ml{i+1}ctx', args['ctx'])
                setattr(self, f'ml{i+1}icase', args['sicase'])
                setattr(self, f'ml{i+1}pos', args['spos'])
        else:
            raise Exception('Failed to recognize sort form source data')


class SampleFormArgs(ConcFormArgs):

    def __init__(self, persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'sample'
        self.rlines: str = '250'


class ShuffleFormArgs(ConcFormArgs):

    def __init__(self, persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'shuffle'


class SubHitsFilterFormArgs(ConcFormArgs):

    def __init__(self, persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'subhits'


class FirstHitsFilterFormArgs(ConcFormArgs):

    def __init__(self, persist: bool, doc_struct: str) -> None:
        super().__init__(persist)
        self.doc_struct: str = doc_struct
        self.form_type: str = 'firsthits'


class KwicSwitchArgs(ConcFormArgs):

    def __init__(self, maincorp: str, persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'switchmc'
        self.maincorp: str = maincorp


def build_conc_form_args(corpora: List[str], data: Dict[str, Any], op_key: str) -> ConcFormArgs:
    """
    A factory method to create a conc form args
    instance based on deserialized data from
    query_persistence database.
    """
    tp = data['form_type']
    if tp == 'query':
        return QueryFormArgs(corpora=corpora, persist=False).updated(data, op_key)
    elif tp == 'filter':
        return FilterFormArgs(maincorp=data['maincorp'], persist=False).updated(data, op_key)
    elif tp == 'sort':
        return SortFormArgs(persist=False).updated(data, op_key)
    elif tp == 'sample':
        return SampleFormArgs(persist=False).updated(data, op_key)
    elif tp == 'shuffle':
        return ShuffleFormArgs(persist=False).updated(data, op_key)
    elif tp == 'switchmc':
        return KwicSwitchArgs(maincorp=data['maincorp'], persist=False).updated(data, op_key)
    elif tp == 'lgroup':
        return LgroupOpArgs(persist=False).updated(data, op_key)
    elif tp == 'locked':
        return LockedOpFormsArgs(persist=False).updated(data, op_key)
    elif tp == 'subhits':
        return SubHitsFilterFormArgs(persist=False).updated(data, op_key)
    elif tp == 'firsthits':
        return FirstHitsFilterFormArgs(persist=False, doc_struct=data['doc_struct']).updated(data, op_key)
    else:
        raise ValueError(f'Cannot determine stored conc args class from type {tp}')


class QuickFilterArgsConv:

    def __init__(self, args) -> None:  # TODO args type ???
        self.args = args

    @staticmethod
    def _parse(q: str) -> Tuple[str, ...]:
        srch = re.search(r'^([pPnN])(-?\d+)([<>]\d+)?\s(-?\d+)([<>]\d+)?\s(\d+)\s(.*)', q)
        if srch:
            return tuple(x.strip() if x is not None else x for x in srch.groups())
        else:
            raise ArgumentMappingError(f'Failed to parse quick filter query: {q}')

    @staticmethod
    def _incl_kwic(v: str) -> bool:
        return True if v in ('n', 'p') else False

    def __call__(self, query: str) -> FilterFormArgs:
        elms = self._parse(query)
        ff_args = FilterFormArgs(maincorp=self.args.maincorp if self.args.maincorp else self.args.corpname,
                                 persist=True)
        ff_args.query_type = 'advanced'
        ff_args.query = elms[-1]
        ff_args.maincorp = self.args.maincorp if self.args.maincorp else self.args.corpname
        ff_args.pnfilter = elms[0].lower()
        ff_args.filfl = elms[5]
        ff_args.filfpos = elms[1]
        ff_args.filtpos = elms[3]
        ff_args.inclkwic = self._incl_kwic(elms[0])
        ff_args.qmcase = True
        return ff_args


class ContextFilterArgsConv(object):
    """
    Converts context filter (i.e. the filter which is part of the main query form)
    form arguments into the regular filter ones.
    """

    def __init__(self, args: QueryFormArgs) -> None:
        self.args = args

    @staticmethod
    def _convert_query(attrname: str, items: List[str], fctxtype: str) -> str:
        if fctxtype == 'any':
            return ' | '.join('[{0}="{1}"]'.format(attrname, v) for v in items)
        elif fctxtype == 'all':
            # here we assume len(items) == 1
            # (it's ok - see function append_filter() in _set_first_query action
            # where the operation is split into multiple filters as there
            # is no way how to specify a conjunction in a single query
            return '[{0}="{1}"]'.format(attrname, items[0])
        elif fctxtype == 'none':
            return ' | '.join('[{0}="{1}"]'.format(attrname, v) for v in items)
        raise ValueError(f'Unknown type fctxtype = {fctxtype}')

    def __call__(self, corpname: str, attrname: str, items: List[str], ctx: List[Any], fctxtype: str) -> FilterFormArgs:
        ff_args = FilterFormArgs(maincorp=corpname, persist=True)
        ff_args.maincorp = corpname
        ff_args.pnfilter = 'p' if fctxtype in ('any', 'all') else 'n'
        ff_args.filfpos = ctx[0]
        ff_args.filtpos = ctx[1]
        ff_args.filfl = 'f' if ctx[2] > 0 else 'l'
        ff_args.inclkwic = False
        ff_args.default_attr = self.args.curr_default_attr_values[corpname]
        ff_args.query_type = 'advanced'
        ff_args.query = self._convert_query(attrname, items, fctxtype)
        return ff_args
