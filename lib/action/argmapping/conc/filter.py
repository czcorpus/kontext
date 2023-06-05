# Copyright(c) 2017 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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


import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

import plugins
from action.argmapping import Args
from action.argmapping.conc.base import ConcFormArgs
from action.argmapping.error import ArgumentMappingError, ValidationError
from action.plugin.ctx import AbstractCorpusPluginCtx
from dataclasses_json import dataclass_json
from plugin_types.corparch.corpus import TagsetInfo

from .query import QueryFormArgs
from .base import AbstractRawQueryDecoder


@dataclass_json
@dataclass
class _FilterFormArgs:
    form_type: str = 'filter'
    query_type: str = 'simple'
    query: str = ''
    parsed_query: List[Any] = field(default_factory=list)
    maincorp: str = ''
    pnfilter: str = 'p'
    filfl: str = 'f'
    filfpos: str = '-5'
    filtpos: str = '5'
    inclkwic: bool = True
    qmcase: bool = False
    default_attr: str = 'word'
    use_regexp: bool = False
    has_lemma: bool = False
    tagsets: List[TagsetInfo] = field(default_factory=list)
    within: bool = False
    no_query_history: bool = False


class FilterFormArgs(ConcFormArgs[_FilterFormArgs], AbstractRawQueryDecoder):
    """
    FilterFormArgs provides methods to handle concordance filter
    form arguments represented by the _FilterFormArgs data class.
    """
    @classmethod
    async def create(cls, plugin_ctx: AbstractCorpusPluginCtx, maincorp: str, persist: bool) -> 'FilterFormArgs':
        self = FilterFormArgs(plugin_ctx, maincorp, persist)
        await self._add_corpus_metadata()
        return self

    def __init__(self, plugin_ctx: AbstractCorpusPluginCtx, maincorp: str, persist: bool) -> None:
        super().__init__(persist)
        self._plugin_ctx = plugin_ctx
        self.data = _FilterFormArgs(
            maincorp=maincorp
        )

    def update_by_user_query(self, data):
        self.data.query_type = data['qtype']
        self.data.query = data.get('query')
        self.data.parsed_query = data.get('queryParsed', [])
        self.data.pnfilter = data['pnfilter']
        self.data.filfl = data['filfl']
        self.data.filfpos = data['filfpos']
        self.data.filfpos = data['filfpos']
        self.data.filtpos = data['filtpos']
        self.data.inclkwic = data['inclkwic']
        self.data.qmcase = data['qmcase']
        self.data.within = data.get('within')
        self.data.default_attr = data['default_attr']
        self.data.use_regexp = data.get('use_regexp', False)
        self.data.no_query_history = data.get('no_query_history', False)

    def from_raw_query(self, q, corpname) -> 'FilterFormArgs':
        """
        Parses queries like: p-5 -1 1 [lc="author" & tag="N.*"]
        """
        srch = re.search(r'^([nNpP])(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(.+)$', q)
        if not srch:
            raise ValueError('unsupported filter expression: {}'.format(q))
        self.data.pnfilter = srch.group(1)
        if srch[0] in ('n', 'p'):
            self.data.inclkwic = True
        else:
            self.data.inclkwic = False
        self.data.filfpos = srch.group(2)
        self.data.filtpos = srch.group(3)
        if srch.group(4) != '1':
            raise ValueError(f'unsupported token selection {srch.group(4)}; only \'1\' is supported')
        self.data.filfl = 'f'
        self.data.query = srch.group(5)
        self.data.query_type = 'advanced'
        return self

    def apply_last_used_opts(self, data: Dict[str, Any]):
        self.data.filfpos = data['filfpos']
        self.data.filtpos = data['filtpos']
        self.data.filfl = data['filfl']
        self.data.inclkwic = data['inclkwic']
        self.data.qmcase = data['qmcase']
        self.data.default_attr = data['default_attr']
        self.data.use_regexp = data['use_regexp']

    async def _add_corpus_metadata(self):
        with plugins.runtime.CORPARCH as ca, plugins.runtime.TAGHELPER as th:
            corp_info = await ca.get_corpus_info(self._plugin_ctx, self.data.maincorp)
            self.data.has_lemma = corp_info.manatee.has_lemma
            self.data.tagsets = [d.to_dict() for d in corp_info.tagsets]
            for tagset in self.data.tagsets:
                tagset['widgetEnabled'] = tagset['widgetEnabled'] and await th.tags_available_for(
                    self._plugin_ctx, self.data.maincorp, tagset['ident'])

    def validate(self):
        try:
            int(self.data.filfpos)
        except ValueError:
            return ValidationError('Invalid value for filfpos: {}'.format(self.data.filfpos))
        try:
            int(self.data.filtpos)
        except ValueError:
            return ValidationError('Invalid value for filtpos: {}'.format(self.data.filtpos))


@dataclass_json
@dataclass
class _SubHitsFilterFormArgs:
    form_type: str = 'subhits'


class SubHitsFilterFormArgs(ConcFormArgs[_SubHitsFilterFormArgs], AbstractRawQueryDecoder):
    """
    SubHitsFilterFormArgs provides methods to handle concordance "sub hits"
    filter form arguments represented by the _SubHitsFilterFormArgs data class.
    """

    def __init__(self, persist: bool) -> None:
        super().__init__(persist)
        self.data = _SubHitsFilterFormArgs()

    def from_raw_query(self, q, corpname) -> 'SubHitsFilterFormArgs':
        if q[1:] != "":
            raise ValueError('Raw SubHitsFilterFormArgs query must be empty')
        return self


@dataclass_json
@dataclass
class _FirstHitsFilterFormArgs:
    doc_struct: str
    form_type: str = 'firsthits'


class FirstHitsFilterFormArgs(ConcFormArgs[_FirstHitsFilterFormArgs], AbstractRawQueryDecoder):
    """
    FirstHitsFilterFormArgs provides methods to handle concordance "first hit in document"
    filter form arguments represented by the _SubHitsFilterFormArgs data class.
    """

    def __init__(self, persist: bool, doc_struct: str) -> None:
        super().__init__(persist)
        self.data = _FirstHitsFilterFormArgs(doc_struct=doc_struct)

    def from_raw_query(self, q, corpname) -> 'FirstHitsFilterFormArgs':
        self.data.doc_struct = q[1:]
        return self

class ContextFilterArgsConv:
    """
    Converts context filter (i.e. the filter which is part of the main query form)
    form arguments into the regular filter ones.
    """

    def __init__(self, plugin_ctx: AbstractCorpusPluginCtx, args: QueryFormArgs) -> None:
        self.plugin_ctx = plugin_ctx
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

    async def __call__(self, corpname: str, attrname: str, items: List[str], ctx: List[Any], fctxtype: str) -> FilterFormArgs:
        ff_args = await FilterFormArgs.create(plugin_ctx=self.plugin_ctx, maincorp=corpname, persist=True)
        ff_args.maincorp = corpname
        ff_args.pnfilter = 'p' if fctxtype in ('any', 'all') else 'n'
        ff_args.filfpos = ctx[0]
        ff_args.filtpos = ctx[1]
        ff_args.filfl = 'f' if ctx[2] > 0 else 'l'
        ff_args.inclkwic = False
        ff_args.default_attr = self.args.data.curr_default_attr_values[corpname]
        ff_args.query_type = 'advanced'
        ff_args.query = self._convert_query(attrname, items, fctxtype)
        return ff_args


class QuickFilterArgsConv:

    def __init__(self, plugin_ctx: AbstractCorpusPluginCtx, args: Args) -> None:
        self.args = args
        self.plugin_ctx = plugin_ctx

    @staticmethod
    def _parse(q: str) -> Tuple[str, ...]:
        srch = re.search(r'^([pPnN])(-?\d+)([<>]\d+)?\s(-?\d+)([<>]\d+)?\s(-?\d+)\s(.*)', q)
        if srch:
            return tuple(x.strip() if x is not None else x for x in srch.groups())
        else:
            raise ArgumentMappingError(f'Failed to parse quick filter query: {q}')

    @staticmethod
    def _incl_kwic(v: str) -> bool:
        return True if v in ('n', 'p') else False

    def __call__(self, query: str) -> FilterFormArgs:
        elms = self._parse(query)
        ff_args = FilterFormArgs(
            plugin_ctx=self.plugin_ctx,
            maincorp=self.args.maincorp if self.args.maincorp else self.args.corpname,
            persist=True)
        ff_args.data.query_type = 'advanced'
        ff_args.data.query = elms[-1]
        ff_args.data.maincorp = self.args.maincorp if self.args.maincorp else self.args.corpname
        ff_args.data.pnfilter = elms[0].lower()
        ff_args.data.filfl = elms[5]
        ff_args.data.filfpos = elms[1]
        ff_args.data.filtpos = elms[3]
        ff_args.data.inclkwic = self._incl_kwic(elms[0])
        ff_args.data.qmcase = True
        return ff_args
