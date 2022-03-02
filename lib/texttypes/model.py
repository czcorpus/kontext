# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2016 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

"""
Text types helper functions (collecting checked text types from a respective
HTML form and transforming them into a query, adding sizes of respective sets
specified by attributes values).
"""

import collections
import re
import logging
from typing import List, Tuple
from functools import reduce

from strings import escape_attr_val
from werkzeug.wrappers import Request
from corplib.corpus import AbstractKCorpus
import settings
import plugins
from translation import ugettext as _
from action.plugin.ctx import PluginCtx
from .cache import TextTypesCache
from .norms import CachedStructNormsCalc


class TextTypeCollector:

    EMPTY_VAL_PLACEHOLDER = settings.get('corpora', 'empty_attr_value_placeholder', '-')

    def __init__(self, corpus: AbstractKCorpus, src_obj):
        """
        arguments:
        corpus --
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
        scas = [(a, self._access_fn(self._src_obj, a))
                for a in self._attr_producer_fn(self._src_obj)]
        structs = collections.defaultdict(list)
        for sa, v in scas:
            s, a = sa.split('.')
            if type(v) is list:
                expr_items = []
                for v1 in v:
                    expr_items.append(f'{a}="{escape_attr_val(v1)}"')
                if len(expr_items) > 0:
                    query = f'({" | ".join(expr_items)})'
                else:
                    query = None
            else:
                query = f'{a}="{v}"'

            if query is not None:  # TODO: is the following encoding change always OK?
                structs[s].append(query)

        return [(sname, ' & '.join(subquery)) for sname, subquery in structs.items()]


class TextTypesException(Exception):
    pass


class TextTypes:

    def __init__(self, corp: AbstractKCorpus, corpname: str, tt_cache: TextTypesCache, plugin_ctx: PluginCtx):
        """
        arguments:
        corp --
        corpname -- a corpus ID
        plugin_ctx --
        """
        self._corp = corp
        self._corpname = corpname
        self._plugin_ctx = plugin_ctx
        self._tt_cache = tt_cache

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
            self._plugin_ctx, self._corpname)
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
            ans['bib_attr'] = corpus_info.metadata.label_attr
            ans['id_attr'] = corpus_info.metadata.id_attr
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
                struct_calc[k] = CachedStructNormsCalc(self._corp, k, subcnorm, self._tt_cache)
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
            normslist += [{'n': n, 'label': self._corp.get_conf(f'{structname}.{n}.LABEL') or n}
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
            self._plugin_ctx, self._corpname).metadata
        for line in tt:
            for item in line.get('Line', ()):
                label, widget = next((x for x in metadata.interval_attrs
                                      if x[0] == item['label']), (None, None))
                item['is_interval'] = int(bool(label))
                item['widget'] = widget
