# Copyright(c) 2013 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import asyncio
import math
from dataclasses import dataclass
from typing import List, NamedTuple, Optional, Tuple
from action.argmapping.wordlist import WordlistFormArgs

import kwiclib
import plugins
import settings
from l10n import get_lang_code
from action.krequest import KRequest
from action.model import ModelsSharedData
from action.model.user import UserActionModel, UserPluginCtx
from action.props import ActionProps
from action.response import KResponse
from bgcalc.wordlist import wordlist
from conclib.calc import find_cached_conc_base
from conclib.search import get_bg_conc
from corplib.corpus import AbstractKCorpus


@dataclass
class FCSResourceInfo:
    title: str
    landing_page_uri: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None


class FCSSearchRow(NamedTuple):
    left: str
    kwic: str
    right: str
    ref: str


@dataclass
class FCSSearchResult:
    rows: List[FCSSearchRow]
    size: int


class FCSError(Exception):
    def __init__(self, code: int, ident: str, msg: str):
        self.code = code
        self.ident = ident
        self.msg = msg


class FCSActionModel(UserActionModel):
    """
    An action controller providing services related to the Federated Content Search support
    """

    BASE_ARGS = ['operation', 'stylesheet', 'version', 'extraRequestData']

    def __init__(
            self, req: KRequest, resp: KResponse, action_props: ActionProps, shared_data: ModelsSharedData):
        super().__init__(req, resp, action_props, shared_data)
        self.search_attrs = settings.get('fcs', 'search_attributes', ['word'])

    def check_args(self, specific_args: List[str]):
        allowed = self.BASE_ARGS + specific_args
        for arg in self._req.args.keys():
            if arg not in allowed:
                raise FCSError(8, arg, 'Unsupported parameter')

    async def corpora_info(self, value: str, max_items: int) -> List[FCSResourceInfo]:
        resources: List[FCSResourceInfo] = []
        if value == 'root':
            corpora_d = settings.get('fcs', 'corpora')
        else:
            corpora_d = [value]

        with plugins.runtime.CORPARCH as ca:
            for i, corpus_id in list(enumerate(corpora_d))[:max_items]:
                cinfo = await ca.get_corpus_info(self.plugin_ctx, corpus_id)
                if cinfo.manatee.lang:
                    lang_code = get_lang_code(name=cinfo.manatee.lang)
                else:
                    lang_code = get_lang_code(a2=cinfo.collator_locale.split('_')[0])
                resources.append(
                    FCSResourceInfo(
                        title=corpus_id,
                        description=cinfo.localized_desc('en'),
                        landing_page_uri=cinfo.web,
                        language=lang_code
                    )
                )
        return resources

    async def fcs_scan(self, corpname: str, scan_query: str, max_ter: int, start: int):
        """
        aux function for federated content search: operation=scan
        """
        query = scan_query.replace('+', ' ')  # convert URL spaces
        exact_match = False
        if 'exact' in query.lower() and '=' not in query:  # lemma ExacT "dog"
            pos = query.lower().index('exact')  # first occurence of EXACT
            query = query[:pos] + '=' + query[pos + 5:]  # 1st exact > =
            exact_match = True
        corp = await self.cf.get_corpus(corpname)
        attrs = corp.get_posattrs()
        try:
            if '=' in query:
                attr, value = query.split('=')
                attr = attr.strip()
                value = value.strip()
            else:  # must be in format attr = value
                raise Exception
            if '"' in attr:
                raise Exception
            if '"' in value:
                if value[0] == '"' and value[-1] == '"':
                    value = value[1:-1].strip()
                else:
                    raise Exception
        except Exception:
            raise FCSError(10, scan_query, 'Query syntax error')
        if attr not in attrs:
            raise FCSError(16, attr, 'Unsupported index')

        if exact_match:
            wlpattern = '^' + value + '$'
        else:
            wlpattern = '.*' + value + '.*'

        args = WordlistFormArgs(wlattr=attr, wlpat=wlpattern)
        wl = await wordlist(corp, args, max_ter)
        return [(d['str'], d['freq']) for d in wl][start:][:max_ter]

    async def fcs_search(
            self,
            corp: AbstractKCorpus,
            fcs_query: str,
            max_rec: int,
            start: int
    ) -> Tuple[FCSSearchResult, str]:
        """
        aux function for federated content search: operation=searchRetrieve
        """
        query = fcs_query.replace('+', ' ')  # convert URL spaces
        exact_match = True  # attr=".*value.*"
        if 'exact' in query.lower() and '=' not in query:  # lemma EXACT "dog"
            pos = query.lower().index('exact')  # first occurrence of EXACT
            query = query[:pos] + '=' + query[pos + 5:]  # 1st exact > =
            exact_match = True

        attrs = corp.get_posattrs()  # list of available attrs
        try:  # parse query
            if '=' in query:  # lemma=word | lemma="word" | lemma="w1 w2" | word=""
                attr, term = query.split('=')
                attr = attr.strip()
                term = term.strip()
            else:  # "w1 w2" | "word" | word
                attr = 'word'
                # use one of search attributes if in corpora attributes
                # otherwise use `word` - fails below if not valid
                for sa in self.search_attrs:
                    if sa in attrs:
                        attr = sa
                        break
                term = query.strip()
            if '"' in attr:
                raise Exception
            if '"' in term:  # "word" | "word1 word2" | "" | "it is \"good\""
                if term[0] != '"' or term[-1] != '"':  # check q. marks
                    raise Exception
                term = term[1:-1].strip()  # remove quotation marks
                if ' ' in term:  # multi-word term
                    if exact_match:
                        rq = ' '.join(f'[{attr}="{t}"]' for t in term.split())
                    else:
                        rq = ' '.join(f'[{attr}=".*{t}.*"]' for t in term.split())
                elif term.strip() == '':  # ""
                    raise Exception  # empty term
                else:  # one-word term
                    if exact_match:
                        rq = f'[{attr}="{term}"]'
                    else:
                        rq = f'[{attr}=".*{term}.*"]'
            else:  # must be single-word term
                if ' ' in term:
                    raise Exception
                if exact_match:  # build query
                    rq = f'[{attr}="{term}"]'
                else:
                    rq = f'[{attr}=".*{term}.*"]'
        except Exception:  # there was a problem when parsing
            raise FCSError(10, query, 'Query syntax error')
        if attr not in attrs:
            raise FCSError(16, attr, 'Unsupported index')

        fromp = int(math.floor((start - 1) / max_rec)) + 1
        # try to get concordance
        try:
            with plugins.runtime.AUTH as auth:
                anon_id = auth.anonymous_user(self.plugin_ctx)['id']
            q = ['q' + rq]

            # try to locate concordance in cache
            lock = asyncio.Lock()
            async with lock:
                # 1st coroutine goes through (there is no conc cache yet)
                # 2nd goes through, but it already finds an open cache entry so it 'wait_for_conc()' inside the lock
                # >= 3 cannot enter but once it can the concordance is already avail. so there is no unnecessary lag here
                # (it doesn't matter whether a coroutine waits here or in 'wait_for_conc()')
                calc_from, conc = await find_cached_conc_base(corp, q, max_rec, 0)
            conc = await get_bg_conc(corp, anon_id, q=q, corp_cache_key=None, calc_from=calc_from, cutoff=max_rec, minsize=0, force_wait=True)
        except Exception as e:
            raise FCSError(10, repr(e), 'Query syntax error')

        if start - 1 > conc.size():
            raise FCSError(61, 'startRecord', 'First record position out of range')

        kwic = kwiclib.Kwic(corp, conc)
        kwic_args = kwiclib.KwicPageArgs({'structs': ''}, base_attr=self.BASE_ATTR)
        kwic_args.fromp = fromp
        kwic_args.pagesize = max_rec
        kwic_context = settings.get_int('fcs', 'kwic_context', 5)
        kwic_args.leftctx = f'-{kwic_context}'
        kwic_args.rightctx = f'{kwic_context}'
        page = kwic.kwicpage(kwic_args)

        local_offset = (start - 1) % max_rec
        rows = []
        for kwicline in page.Lines[local_offset:local_offset + max_rec]:
            rows.append(FCSSearchRow(
                ' '.join([x['str'] for x in kwicline['Left']]),
                ' '.join([x['str'] for x in kwicline['Kwic']]),
                ' '.join([x['str'] for x in kwicline['Right']]),
                kwicline['ref']))
        return FCSSearchResult(rows, conc.size()), rq

    @property
    def plugin_ctx(self):
        if self._plugin_ctx is None:
            self._plugin_ctx = UserPluginCtx(self, self._req, self._resp, self._plg_shared)
        return self._plugin_ctx
