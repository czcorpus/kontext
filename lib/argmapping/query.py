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

    def __init__(self, persist):
        self._persistent = persist
        self._op_key = '__new__'

    def updated(self, attrs, op_key):
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
        for k, v in list(attrs.items()):
            if k in vars(self):
                setattr(self, k, v)
        self._op_key = op_key
        return self

    def to_dict(self):
        tmp = dict((k, v) for k, v in list(self.__dict__.items()) if not k.startswith('_'))
        if not self.is_persistent:
            tmp['op_key'] = self._op_key
        return tmp

    def serialize(self):
        """
        Export data required to be saved. In case there
        are some corpus-dependent and fixed data (e.g. list of PoS),
        it can be omitted here and re-initialized in __init__
        from user-independent data. By default - all the
        object's attributes are exported.
        """
        return self.to_dict()

    @property
    def is_persistent(self):
        return self._persistent

    @property
    def op_key(self):
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

    def __init__(self, persist):
        super(LgroupOpArgs, self).__init__(persist)
        self.form_type = 'lgroup'


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

    def __init__(self, persist):
        super(LockedOpFormsArgs, self).__init__(persist)
        self.form_type = 'locked'


class QueryFormArgs(ConcFormArgs):
    """
    QueryFormArgs collects arguments required
    to initialize the 'first_form' for one or more
    corpora.

    The class is only used to make collecting and
    serializing data easier. Stored data are expected
    to be JSON-serializable.
    """

    def __init__(self, corpora, persist):
        super(QueryFormArgs, self).__init__(persist)
        self.form_type = 'query'
        self.curr_query_types = dict((c, None) for c in corpora)
        self.curr_queries = dict((c, None) for c in corpora)
        self.curr_pcq_pos_neg_values = dict((c, None) for c in corpora)
        self.curr_include_empty_values = dict((c, None) for c in corpora)
        self.curr_lpos_values = dict((c, None) for c in corpora)
        self.curr_qmcase_values = dict((c, None) for c in corpora)
        self.curr_default_attr_values = dict((c, None) for c in corpora)
        self.tag_builder_support = dict((c, None) for c in corpora)
        self.tagset_docs = dict((c, None) for c in corpora)
        self.has_lemma = dict((c, False) for c in corpora)
        self.selected_text_types = {}
        # for bibliography structattr - maps from hidden ids to visible titles (this is optional)
        self.bib_mapping = {}
        for corp in corpora:
            self._add_corpus_metadata(corp)

    def _add_corpus_metadata(self, corpus_id):
        with plugins.runtime.TAGHELPER as th:
            self.tag_builder_support[corpus_id] = th.tags_enabled_for(corpus_id)

        with plugins.runtime.CORPARCH as ca:
            corp_info = ca.get_corpus_info('en_US', corpus_id)
            self.has_lemma[corpus_id] = corp_info.manatee.has_lemma
            self.tagset_docs[corpus_id] = corp_info.manatee.tagset_doc

    def serialize(self):
        ans = super(QueryFormArgs, self).to_dict()
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

    def __init__(self, maincorp, persist):
        super(FilterFormArgs, self).__init__(persist)
        self.form_type = 'filter'
        self.query_type = 'iquery'
        self.query = ''
        self.maincorp = maincorp
        self.pnfilter = 'p'
        self.filfl = 'f'
        self.filfpos = '-5'
        self.filtpos = '5'
        self.inclkwic = True
        self.qmcase = False
        self.default_attr = 'word'
        self.has_lemma = False
        self.tagset_doc = ''
        self.tag_builder_support = False
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

    def __init__(self, persist):
        """
        args:
            persist -- specify whether the object should be stored
                       to disk when the current action is finished
        """
        super(SortFormArgs, self).__init__(persist)
        self.form_type = 'sort'
        self.form_action = 'sortx'
        self.sattr = ''
        self.skey = 'kw'
        self.spos = 3  # number of tokens to sort
        self.sicase = ''
        self.sbward = ''
        self.sortlevel = 1
        self.ml1attr = ''
        self.ml2attr = ''
        self.ml3attr = ''
        self.ml4attr = ''
        self.ml1icase = ''
        self.ml2icase = ''
        self.ml3icase = ''
        self.ml4icase = ''
        self.ml1bward = ''
        self.ml2bward = ''
        self.ml3bward = ''
        self.ml4bward = ''
        self.ml1pos = 1
        self.ml2pos = 1
        self.ml3pos = 1
        self.ml4pos = 1
        self.ml1ctx = '0~0>0'
        self.ml2ctx = '0~0>0'
        self.ml3ctx = '0~0>0'
        self.ml4ctx = '0~0>0'


class SampleFormArgs(ConcFormArgs):

    def __init__(self, persist):
        super(SampleFormArgs, self).__init__(persist)
        self.form_type = 'sample'
        self.rlines = '250'


class ShuffleFormArgs(ConcFormArgs):

    def __init__(self, persist):
        super(ShuffleFormArgs, self).__init__(persist)
        self.form_type = 'shuffle'


class SubHitsFilterFormArgs(ConcFormArgs):

    def __init__(self, persist):
        super(SubHitsFilterFormArgs, self).__init__(persist)
        self.form_type = 'subhits'


class FirstHitsFilterFormArgs(ConcFormArgs):

    def __init__(self, persist, doc_struct):
        super(FirstHitsFilterFormArgs, self).__init__(persist)
        self.doc_struct = doc_struct
        self.form_type = 'firsthits'


class KwicSwitchArgs(ConcFormArgs):

    def __init__(self, maincorp, persist):
        super(KwicSwitchArgs, self).__init__(persist)
        self.form_type = 'switchmc'
        self.maincorp = maincorp


def build_conc_form_args(corpora, data, op_key):
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
        raise ValueError('Cannot determine stored conc args class from type %s' % (tp,))


class QuickFilterArgsConv(object):

    def __init__(self, args):
        self.args = args

    @staticmethod
    def _parse(q):
        srch = re.search(r'^([pPnN])(-?\d)([<>]\d)?\s(-?\d)([<>]\d)?\s(\d+)\s(.*)', q)
        if srch:
            return tuple(x.strip() if x is not None else x for x in srch.groups())
        else:
            logging.getLogger(__name__).warning('Failed to parse quick filter query: %s' % (q,))
            return 'p', '', '', ''

    @staticmethod
    def _incl_kwic(v):
        return True if v in ('n', 'p') else False

    def __call__(self, query):
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

    def __init__(self, args):
        self.args = args

    @staticmethod
    def _convert_query(attrname, items, fctxtype):
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

    def __call__(self, attrname, items, ctx, fctxtype):
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
