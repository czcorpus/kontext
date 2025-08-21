# Copyright (c) 2014 Czech National Corpus
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
This is kind of a meta-plug-in which loads modules intended for
exporting concordance data to a file. The plug-in itself cannot be
changed/configured. On the other side, concrete export modules are
free to be replaced/changed.
"""

import abc
from typing import Any, Dict, List, Tuple, Union

from action.argmapping.wordlist import WordlistSaveFormArgs
from action.model.concordance import ConcActionModel
from action.model.keywords import KeywordsActionModel
from action.model.pquery import ParadigmaticQueryActionModel
from action.model.wordlist import WordlistActionModel
from babel import Locale
from bgcalc.coll_calc import CalculateCollsResult
from bgcalc.keywords import KeywordsResult
from bgcalc.pquery.storage import PqueryDataLine
from kwiclib import AttrRole
from kwiclib.common import KwicPageData
from views.colls import SavecollArgs
from views.concordance import SaveConcArgs
from views.freqs import SavefreqArgs
from views.keywords import SaveKeywordsArgs
from views.pquery import SavePQueryArgs


class ExportPluginException(Exception):
    pass


class UnknownExporterException(Exception):
    pass


class AbstractConcExportMixin(object):

    def _merge_conc_line_parts(self, items: List[Dict[str, Any]], merged_attrs: List[Tuple[str, int]], add_tail: bool = True) -> str:
        """
        converts a list of dicts of the format [{'class': u'col0 coll', 'str': u' \\u0159ekl'},
            {'class': u'attr', 'str': u'/j\xe1/PH-S3--1--------'},...] to a CSV compatible form
        """
        ans: List[List[str]] = []
        for item in items:
            if 'class' in item and item['class'] != 'attr':
                ans.append([str(item['str']).strip()])
            else:
                ans.append([str(item['str']).strip()])

            if add_tail:
                # in case of single additional attr, all posattrs parts are in fact one attr
                posattrs = ['/'.join(item.get('posattrs', []))
                            ] if len(merged_attrs) == 2 else item.get('posattrs', [])
                # there can be tokens containing `/` like `km/h`
                # and stock version Manatee also uses `/` as separator of attrs
                # in this case there will be more items in `item.possattrs` after splitting the attr string
                # we can not confidently assign values to its requested attributes
                if len(merged_attrs) - 1 != len(posattrs):
                    ans[-1].append(
                        f'UNPARSEABLE TOKENS {"/".join(attr[0] for attr in merged_attrs[1:])}:{"/".join(posattrs)}')

                else:
                    # enumerate from 1, merged_attrs[0] corresponds to item['str']
                    for i, posattr in enumerate(posattrs, 1):
                        # display only user set attrs, filter out internals
                        if AttrRole.is_role(merged_attrs[i][1], AttrRole.USER):
                            ans[-1].append(posattr)

        return ' '.join('/'.join(x) for x in ans).strip()

    def _process_lang(
            self,
            root: Union[List[Dict[str, Any]], Dict[str, Any]],
            left_key: str,
            kwic_key: str,
            right_key: str,
            add_linegroup: bool,
            attr_vmode: str,
            merged_attrs: List[Tuple[str, int]],
            merged_ctxattrs: List[Tuple[str, int]],
    ) -> List[Dict[str, str]]:

        if isinstance(root, dict):
            root = [root]

        ans: List[Dict[str, str]] = []
        for items in root:
            ans_item: Dict[str, str] = {}
            if 'ref' in items:
                ans_item['ref'] = items['ref']
            if add_linegroup:
                ans_item['linegroup'] = items.get('linegroup', '')
            ans_item['left_context'] = self._merge_conc_line_parts(
                items[left_key], merged_ctxattrs, attr_vmode not in ['visible-kwic', 'mouseover'])
            ans_item['kwic'] = self._merge_conc_line_parts(
                items[kwic_key], merged_attrs, attr_vmode not in ['mouseover'])
            ans_item['right_context'] = self._merge_conc_line_parts(
                items[right_key], merged_ctxattrs, attr_vmode not in ['visible-kwic', 'mouseover'])
            ans.append(ans_item)
        return ans

    @abc.abstractmethod
    async def write_conc(self, amodel: ConcActionModel, data: KwicPageData, args: SaveConcArgs):
        """
        write concordance data
        """


class AbstractCollExportMixin(object):

    @abc.abstractmethod
    async def write_coll(self, amodel: ConcActionModel, data: CalculateCollsResult, args: SavecollArgs):
        """
        write collocation data
        """


class AbstractFreqExportMixin(object):

    @abc.abstractmethod
    async def write_freq(self, amodel: ConcActionModel, data: Dict[str, Any], args: SavefreqArgs):
        """
        write frequency data
        TODO make implement frequency data dataclass
        """


class AbstractPqueryExportMixin(object):

    @abc.abstractmethod
    async def write_pquery(self, amodel: ParadigmaticQueryActionModel, data: List[PqueryDataLine], args: SavePQueryArgs):
        """
        write pquery data
        TODO make implement frequency data dataclass
        """


class AbstractKeywordsExportMixin(object):

    @abc.abstractmethod
    async def write_keywords(self, amodel: KeywordsActionModel, result: KeywordsResult, args: SaveKeywordsArgs):
        """
        write keywords data
        """


class AbstractWordlistExportMixin(object):

    @abc.abstractmethod
    async def write_wordlist(self, amodel: WordlistActionModel, data: Tuple[int, List[Tuple[str, int]]], args: WordlistSaveFormArgs):
        """
        write wordlist data
        """


class AbstractExport(AbstractConcExportMixin, AbstractCollExportMixin, AbstractFreqExportMixin, AbstractPqueryExportMixin, AbstractKeywordsExportMixin, AbstractWordlistExportMixin):

    def __init__(self, locale: Locale) -> None:
        self._locale = locale

    @abc.abstractmethod
    def content_type(self) -> str:
        pass

    @abc.abstractmethod
    def raw_content(self) -> str:
        pass


def lang_row_to_list(row):
    ans = []
    if 'linegroup' in row:
        ans.append(row['linegroup'])
    if 'ref' in row:
        for item in row['ref']:
            ans.append(item)
    for key in ('left_context', 'kwic', 'right_context'):
        if key in row:
            ans.append(row[key])
    return ans


class Loader:

    def __init__(self, module_map):
        self._module_map = module_map

    def load_plugin(self, name: str, locale: Locale) -> AbstractExport:
        """
        Loads an export module specified by passed name.
        In case you request non-existing plug-in (= a plug-in
        not set in config.xml) ValueError is raised.

        arguments:
        name -- name of the module
        subtype -- additional type specification (e.g. main type is "XML export", subtype is "frequency distribution")

        returns:
        required module or nothing if module is not found
        """
        if name not in self._module_map:
            raise UnknownExporterException(f'Export module [{name}] not configured')
        module_name = self._module_map[name]
        module = __import__(f'plugins.export.{module_name}', fromlist=[module_name])
        plugin = module.create_instance(locale)
        return plugin


def create_instance(settings):
    module_map = settings.get('plugins', 'export')
    return Loader(module_map)
