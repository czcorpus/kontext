# Copyright (c) 2016 Institute of the Czech National Corpus
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
"""
Text types helper functions (collecting checked text types from a respective
HTML form and transforming them into a query, adding sizes of respective sets
specified by attributes values).
"""

from functools import partial
import collections
import re
import logging
from typing import List, Tuple

import l10n
from argmapping import Args
from werkzeug.wrappers import Request
import corplib
import settings
import plugins
from translation import ugettext as _
from functools import reduce


class TextTypesCache(object):
    """
    Caches corpus text type information (= available structural attribute values).
    This can be helpful in case of large corpora with rich metadata. In case
    there is no caching directory set values are always loaded directly from
    the corpus.
    """

    def __init__(self, db):
        self._db = db

    @staticmethod
    def _mk_cache_key(corpname):
        return 'ttcache:%s' % (corpname, )

    def get_values(self, corp, subcorpattrs, maxlistsize, shrink_list=False, collator_locale=None):
        text_types = self._db.get(self._mk_cache_key(corp.corpname))
        if text_types is None:
            text_types = corplib.texttype_values(corp=corp, subcorpattrs=subcorpattrs,
                                                 maxlistsize=maxlistsize, shrink_list=shrink_list,
                                                 collator_locale=collator_locale)
            self._db.set(self._mk_cache_key(corp.corpname), text_types)
        return text_types

    def clear(self, corp):
        self._db.remove(self._mk_cache_key(corp.corpname))


class StructNormsCalc(object):
    """
    Adds a size information of texts related to respective attribute values.
    An instance is always bound to a concrete structure and required value type.
    """

    def __init__(self, corpus, structname, subcnorm):
        """
        arguments:
        corpus -- manatee.Corpus instance (enriched by KonText
                  initialization - 'corpname' attribute is required here)
        structname -- a name of a corpus structure
        subcnorm -- a type of value to be collected (allowed values: freq, tokens)
        """
        self._corp = corpus
        self._structname = structname
        self._struct = self._corp.get_struct(structname)
        self._subcnorm = subcnorm
        self._normvals = None

    @property
    def normvals(self):
        if self._normvals is None:
            self._normvals = self._calc_normvals()
        return self._normvals

    def _calc_normvals(self):
        if self._subcnorm == 'freq':
            normvals = dict((self._struct.beg(i), 1) for i in range(self._struct.size()))
        elif self._subcnorm == 'tokens':
            normvals = dict((self._struct.beg(i), self._struct.end(i) - self._struct.beg(i))
                            for i in range(self._struct.size()))
        else:
            nas = self._struct.get_attr(self._subcnorm).pos2str
            normvals = dict((self._struct.beg(i), self._safe_int(nas(i)))
                            for i in range(self._struct.size()))
        return normvals

    @staticmethod
    def _safe_int(s):
        try:
            return int(s)
        except ValueError:
            return 0

    def compute_norm(self, attrname, value):
        attr = self._struct.get_attr(attrname)
        valid = attr.str2id(value)
        r = self._corp.filter_query(self._struct.attr_val(attrname, valid))
        cnt = 0
        while not r.end():
            cnt += self.normvals[r.peek_beg()]
            r.next()
        return cnt


class CachedStructNormsCalc(StructNormsCalc):
    """
    A caching variant of StructNormsCalc. Uses 'db' key=>value plug-in to
    store values.
    """

    def __init__(self, corpus, structname, subcnorm, db):
        """
        arguments:
        corpus -- manatee.Corpus instance (enriched version returned by corplib.CorpusManager)
        structname -- a name of a corpus structure
        subcnorm -- a type of value to be collected (allowed values: freq, tokens)
        db -- a 'db' plug-in instance
        """
        super(CachedStructNormsCalc, self).__init__(corpus, structname, subcnorm)
        self._db = db
        mkdict = partial(collections.defaultdict, lambda: {})
        try:
            self._data = mkdict(self._db.get(self._mk_cache_key(), {}))
        except IOError:
            self._data = mkdict()

    def _mk_cache_key(self):
        return 'ttcache:%s:%s:%s' % (self._corp.corpname, self._structname, self._subcnorm)

    def compute_norm(self, attrname, value):
        if attrname not in self._data or value not in self._data[attrname]:
            self._data[attrname][value] = super(
                CachedStructNormsCalc, self).compute_norm(attrname, value)
            self._db.set(self._mk_cache_key(), self._data)
        return self._data[attrname][value]


class TextTypeCollector(object):

    EMPTY_VAL_PLACEHOLDER = settings.get('corpora', 'empty_attr_value_placeholder', '-')

    def __init__(self, corpus, src_obj):
        """
        arguments:
        corpus -- a manatee.Corpus instance (enriched version returned by corplib.CorpusManager)
        src_obj -- object holding argument names and values (request or controller.args)
        """
        self._corp = corpus
        self._src_obj = src_obj
        if type(src_obj) is dict:
            self._attr_producer_fn = lambda o: o.keys()
            self._access_fn = lambda o, att: o.get(att)
        elif isinstance(src_obj, Request):
            self._attr_producer_fn = lambda o: list(o.form.keys())
            self._access_fn = lambda o, x: o.form.getlist(*(x,))
        else:
            raise ValueError('Invalid source object (must be either a dict or Request): %s' % (
                             src_obj.__class__.__name__,))

    def get_attrmap(self):
        return dict((a, self._access_fn(self._src_obj, a)) for a in self._attr_producer_fn(self._src_obj))

    def get_query(self) -> List[Tuple[str, str]]:
        """
        returns:
        a list of tuples (struct, condition); strings are encoded to the encoding current
        corpus uses!
        """
        scas = [(a, self._access_fn(self._src_obj, a)) for a in self._attr_producer_fn(self._src_obj)]
        structs = {}
        for sa, v in scas:
            if type(v) in (str, str) and '|' in v:
                v = v.split('|')
            s, a = sa.split('.')
            if type(v) is list:
                expr_items = []
                for v1 in v:
                    expr_items.append('%s="%s"' % (a, l10n.escape(v1)))
                if len(expr_items) > 0:
                    query = '(%s)' % ' | '.join(expr_items)
                else:
                    query = None
            else:
                query = '%s="%s"' % (a, l10n.escape(v))

            if query is not None:  # TODO: is the following encoding change always OK?
                if s in structs:
                    structs[s].append(query)
                else:
                    structs[s] = [query]
        return [(sname, ' & '.join(subquery)) for sname, subquery in list(structs.items())]


class TextTypesException(Exception):
    pass


class TextTypes(object):

    def __init__(self, corp, corpname, plugin_api):
        """
        arguments:
        corp -- a manatee.Corpus instance (enriched version returned by corplib.CorpusManager)
        corpname -- a corpus ID
        plugin_api --
        """
        self._corp = corp
        self._corpname = corpname
        self._plugin_api = plugin_api
        self._tt_cache = TextTypesCache(plugins.runtime.DB.instance)

    def export(self, subcorpattrs, maxlistsize, shrink_list=False, collator_locale=None):
        return self._tt_cache.get_values(self._corp, subcorpattrs, maxlistsize, shrink_list, collator_locale)

    def export_with_norms(self, subcorpattrs='', ret_nums=True, subcnorm='tokens'):
        """
        Returns a text types table containing also an information about
        total occurrences of respective attribute values.

        See corplib.texttype_values for arguments and returned value
        """
        ans = {}
        if not subcorpattrs:
            subcorpattrs = self._corp.get_conf('SUBCORPATTRS')
            if not subcorpattrs:
                subcorpattrs = self._corp.get_conf('FULLREF')
        if not subcorpattrs or subcorpattrs == '#':
            raise TextTypesException(
                _('Missing display configuration of structural attributes (SUBCORPATTRS or FULLREF).'))

        corpus_info = plugins.runtime.CORPARCH.instance.get_corpus_info(
            self._plugin_api.user_lang, self._corpname)
        maxlistsize = settings.get_int('global', 'max_attr_list_size')
        # if 'live_attributes' are installed then always shrink bibliographical
        # entries even if their count is < maxlistsize
        subcorp_attr_list_tmp = re.split(r'\s*[,|]\s*', subcorpattrs)
        subcorp_attr_list = collections.OrderedDict(
            zip(subcorp_attr_list_tmp, [None] * len(subcorp_attr_list_tmp))).keys()

        subcorpattrs = '|'.join(subcorp_attr_list)
        if len(subcorp_attr_list_tmp) != len(subcorp_attr_list):
            logging.getLogger(__name__).warning('Duplicate SUBCORPATTRS item found')

        if plugins.runtime.LIVE_ATTRIBUTES.exists:
            ans['bib_attr'] = corpus_info['metadata']['label_attr']
            ans['id_attr'] = corpus_info['metadata']['id_attr']
            # We have to ensure that the bibliography item (which uses different values
            # for labels and different values for actual identifiers) is represented
            # as an input box on client-side. Passing list_none with bib_attr element
            # to get_values()'s shrink_list ensures this.
            # Please see public/files/js/stores/textTypes/attrValues.ts for more information
            # on how is bibliography attr. box handled on client.
            list_none = (ans['bib_attr'], )
            tmp = [s for s in subcorp_attr_list]  # making copy here
            if ans['bib_attr'] and ans['bib_attr'] not in tmp:  # if bib type is not in subcorpattrs
                tmp.append(ans['bib_attr'])                     # we add it there
                subcorpattrs = '|'.join(tmp)  # we ignore NoSkE '|' vs. ',' stuff deliberately here
        else:
            ans['bib_attr'] = None
            ans['id_attr'] = None
            list_none = ()
        tt = self._tt_cache.get_values(corp=self._corp, subcorpattrs=subcorpattrs, maxlistsize=maxlistsize,
                                       shrink_list=list_none, collator_locale=corpus_info.collator_locale)
        self._add_tt_custom_metadata(tt)

        if ret_nums:
            struct_calc = collections.OrderedDict()
            for item in subcorp_attr_list:
                k = item.split('.')[0]
                struct_calc[k] = CachedStructNormsCalc(
                    self._corp, k, subcnorm, db=plugins.runtime.DB.instance)
            cache_ok = True
            for col in reduce(lambda p, c: p + c['Line'], tt, []):
                if 'textboxlength' not in col:
                    structname, attrname = col['name'].split('.')
                    for val in col['Values']:
                        try:
                            v = struct_calc[structname].compute_norm(attrname, val['v'])
                        except KeyError:
                            v = 0  # no problem here as the value is actually not required by subcorpattrs
                            cache_ok = False
                        val['xcnt'] = v
            if not cache_ok:
                self._tt_cache.clear(self._corp)
                logging.getLogger(__name__).warning(
                    'Removed invalid tt cache entry for corpus {0}'.format(self._corpname))
            ans['Blocks'] = tt
            ans['Normslist'] = self._get_normslist(list(struct_calc.keys())[0])
        else:
            ans['Blocks'] = tt
            ans['Normslist'] = []
        return ans

    def _get_normslist(self, structname):
        normsliststr = self._corp.get_conf('DOCNORMS')
        normslist = [{'n': 'freq', 'label': _('Document counts')},
                     {'n': 'tokens', 'label': _('Tokens')}]
        if normsliststr:
            normslist += [{'n': n, 'label': self._corp.get_conf(structname + '.' + n + '.LABEL') or n}
                          for n in normsliststr.split(',')]
        else:
            try:
                self._corp.get_attr(structname + '.wordcount')
                normslist.append({'n': 'wordcount', 'label': _('Word counts')})
            except:
                pass
        return normslist

    def _add_tt_custom_metadata(self, tt):
        metadata = plugins.runtime.CORPARCH.instance.get_corpus_info(
            self._plugin_api.user_lang, self._corpname)['metadata']
        for line in tt:
            for item in line.get('Line', ()):
                item['is_interval'] = int(item['label'] in metadata.get('interval_attrs', []))


def get_tt(corp, plugin_api):
    """
    A convenience factory to create a TextType instance

    arguments:
    corp -- a manatee.Corpus instance (enriched version returned by corplib.CorpusManager)
    corpname --
    plugin_api --
    """
    return TextTypes(corp, corp.corpname, plugin_api)
