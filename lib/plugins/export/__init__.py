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
from typing import Any, Callable, Dict, List, Union

from action.model.concordance import ConcActionModel
from bgcalc.coll_calc import CalculateCollsResult
from kwiclib import KwicPageData
from views.colls import SavecollArgs
from views.concordance import SaveConcArgs
from views.freqs import SavefreqArgs


class ExportPluginException(Exception):
    pass


class UnknownExporterException(Exception):
    pass


class AbstractConcExportMixin(object):

    def _merge_conc_line_parts(self, items: List[Dict[str, Any]]) -> str:
        """
        converts a list of dicts of the format [{'class': u'col0 coll', 'str': u' \\u0159ekl'},
            {'class': u'attr', 'str': u'/j\xe1/PH-S3--1--------'},...] to a CSV compatible form
        """
        ans: List[str] = []
        for item in items:
            if 'class' in item and item['class'] != 'attr':
                ans.append(str(item['str']).strip())
            else:
                ans.append(str(item['str']).strip())
            for tp in item.get('tail_posattrs', []):
                ans.append(f'/{tp}')
        return ''.join(ans).strip()

    def _process_lang(self, root: Union[List[Dict[str, Any]], Dict[str, Any]], left_key: str, kwic_key: str, right_key: str, add_linegroup: bool) -> List[Dict[str, str]]:
        if isinstance(root, dict):
            root = [root]

        ans: List[Dict[str, str]] = []
        for items in root:
            ans_item: Dict[str, str] = {}
            if 'ref' in items:
                ans_item['ref'] = items['ref']
            if add_linegroup:
                ans_item['linegroup'] = items.get('linegroup', '')
            ans_item['left_context'] = self._merge_conc_line_parts(items[left_key])
            ans_item['kwic'] = self._merge_conc_line_parts(items[kwic_key])
            ans_item['right_context'] = self._merge_conc_line_parts(items[right_key])
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


class AbstractExport(AbstractConcExportMixin, AbstractCollExportMixin, AbstractFreqExportMixin):

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


class Loader(object):

    def __init__(self, module_map):
        self._module_map = module_map

    def load_plugin(self, name: str, subtype: str=None, translate: Callable[[str], str]=lambda x: x) -> AbstractExport:
        """
        Loads an export module specified by passed name.
        In case you request non existing plug-in (= a plug-in
        not set in config.xml) ValueError is raised.

        arguments:
        name -- name of the module
        subtype -- additional type specification (e.g. main type is "XML export", subtype is "frequency distribution")

        returns:
        required module or nothing if module is not found
        """
        if name not in self._module_map:
            raise UnknownExporterException(translate(f'Export module [{name}] not configured'))
        module_name = self._module_map[name]
        module = __import__(f'plugins.export.{module_name}', fromlist=[module_name])
        plugin = module.create_instance(subtype=subtype, translate=translate)
        return plugin


def create_instance(settings):
    module_map = settings.get('plugins', 'export')
    return Loader(module_map)
