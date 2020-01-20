# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
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
import logging

import plugins


class ConcFormArgs(object):
    """
    A helper class to handle miscellaneous
    form (filter, query, sort,...) args
    properly. It is used only indirectly
    - we create an instance and immediately
    after that we export it (either to serialize
    it via conc_persistence or to pass it
    to the client-side).
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
            if k in vars(self):
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
    to initialize the 'first_form' for one or more
    corpora.

    The class is only used to make collecting and
    serializing data easier. Stored data are expected
    to be JSON-serializable.
    """

    def __init__(self, corpora: List[str], persist: bool) -> None:
        super().__init__(persist)
        self.form_type: str = 'query'

        empty_dict: Dict[str, Any] = {c: None for c in corpora}
        self.curr_query_types = empty_dict.copy()
        self.curr_queries = empty_dict.copy()
        self.curr_pcq_pos_neg_values = empty_dict.copy()
        self.curr_include_empty_values = empty_dict.copy()
        self.curr_lpos_values = empty_dict.copy()
        self.curr_qmcase_values = empty_dict.copy()
        self.curr_default_attr_values = empty_dict.copy()
        self.tag_builder_support = empty_dict.copy()
        self.tagset_docs = empty_dict.copy()
        self.has_lemma = empty_dict.copy()

        self.selected_text_types: Dict[str, str] = {}
        # for bibliography structattr - maps from hidden ids to visible titles (this is optional)
        self.bib_mapping: Dict[str, str] = {}

        for corp in corpora:
            self._add_corpus_metadata(corp)

    def _add_corpus_metadata(self, corpus_id: str):
        with plugins.runtime.TAGHELPER as th:
            self.tag_builder_support[corpus_id] = getattr(th, 'tags_enabled_for')(corpus_id)

        with plugins.runtime.CORPARCH as ca:
            corp_info = getattr(ca, 'get_corpus_info')('en_US', corpus_id)
            self.has_lemma[corpus_id] = corp_info.manatee.has_lemma
            self.tagset_docs[corpus_id] = corp_info.manatee.tagset_doc

    def serialize(self) -> Dict[str, Any]:
        ans = super().to_dict()
        del ans['has_lemma']
        del ans['tagset_docs']
        del ans['tag_builder_support']
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
        self.query_type: str = 'iquery'
        self.query: str = ''
        self.maincorp: str = maincorp
        self.pnfilter: str = 'p'
        self.filfl: str = 'f'
        self.filfpos: str = '-5'
        self.filtpos: str = '5'
        self.inclkwic: bool = True
        self.qmcase: bool = False
        self.default_attr: str = 'word'
        self.has_lemma: bool = False
        self.tagset_doc: str = ''
        self.tag_builder_support: bool = False
        self._add_corpus_metadata()

    def _add_corpus_metadata(self):
        with plugins.runtime.TAGHELPER as th:
            self.tag_builder_support = th.tags_enabled_for(self.maincorp)

        with plugins.runtime.CORPARCH as ca:
            corp_info = ca.get_corpus_info('en_US', self.maincorp)
            self.has_lemma = corp_info.manatee.has_lemma
            self.tagset_doc = corp_info.manatee.tagset_doc


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
        self.sattr: str = ''
        self.skey: str = 'kw'
        self.spos: int = 3  # number of tokens to sort
        self.sicase: str = ''
        self.sbward: str = ''
        self.sortlevel: int = 1
        self.ml1attr: str = ''
        self.ml2attr: str = ''
        self.ml3attr: str = ''
        self.ml4attr: str = ''
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
    conc_persistence database.
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


class QuickFilterArgsConv(object):

    def __init__(self, args) -> None:  # TODO args type ???
        self.args = args

    @staticmethod
    def _parse(q: str) -> Tuple[str, ...]:
        srch = re.search(r'^([pPnN])(-?\d)([<>]\d)?\s(-?\d)([<>]\d)?\s(\d+)\s(.*)', q)
        if srch:
            return tuple(x.strip() if x is not None else x for x in srch.groups())
        else:
            logging.getLogger(__name__).warning(f'Failed to parse quick filter query: {q}')
            return 'p', '', '', ''

    @staticmethod
    def _incl_kwic(v: str) -> bool:
        return True if v in ('n', 'p') else False

    def __call__(self, query: str) -> FilterFormArgs:
        elms = self._parse(query)
        ff_args = FilterFormArgs(maincorp=self.args.maincorp if self.args.maincorp else self.args.corpname,
                                 persist=True)
        ff_args.query_type = 'cql'
        ff_args.query = elms[-1]
        ff_args.maincorp = self.args.maincorp if self.args.maincorp else self.args.corpname
        ff_args.pnfilter = elms[0].lower()
        ff_args.filfl = elms[5]
        ff_args.filfpos = elms[1]
        ff_args.filtpos = elms[3]
        ff_args.inclkwic = self._incl_kwic(elms[0])
        ff_args.qmcase = True
        ff_args.default_attr = self.args.default_attr
        return ff_args


class ContextFilterArgsConv(object):
    """
    Converts context filter (i.e. the filter which is part of the main query form)
    form arguments into the regular filter ones.
    """

    def __init__(self, args) -> None:  # TODO args type ???
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

    def __call__(self, attrname: str, items: List[str], ctx: List[Any], fctxtype: str) -> FilterFormArgs:  # TODO ctx type
        ff_args = FilterFormArgs(maincorp=self.args.maincorp if self.args.maincorp else self.args.corpname,
                                 persist=True)
        ff_args.maincorp = self.args.maincorp if self.args.maincorp else self.args.corpname
        ff_args.pnfilter = 'p' if fctxtype in ('any', 'all') else 'n'
        ff_args.filfpos = ctx[0]
        ff_args.filtpos = ctx[1]
        ff_args.filfl = 'f' if ctx[2] > 0 else 'l'
        ff_args.inclkwic = False
        ff_args.default_attr = self.args.default_attr
        ff_args.query_type = 'cql'
        ff_args.query = self._convert_query(attrname, items, fctxtype)
        return ff_args
