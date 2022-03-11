# Copyright (c) 2015 Czech National Corpus
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
A module producing data required by tree-based corpus listing widget/page.
This is an alternative to the 'default_corparch' plug-in which provides
tag and search-based corpus listing.

Expected config.xml configuraiton:

element corparch {
    element module { "tree_corparch" }
    element js_file { "treeCorparch" }
    element file { text } # path to a file containing corpus tree XML data
}


Expected corplist xml structure:

grammar {
    start = CorporaList

    Corpus = element {
        attribute ident { text }
        attribute name { text }?
        attribute speech_segment { text }?
        attribute web { text }?
        attribute tagset { text }?
        attribute collator_locale { text }?
        attribute sentence_struct { text }?
    }

    CorporaList = element corplist {
        attribute name { text }
        Corpus+
        & CorporaList*
    }
}
"""


from lxml import etree
import copy
from dataclasses import dataclass, field
from dataclasses_json import dataclass_json
from typing import Union, List
import uuid
from sanic import Blueprint

import plugins
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.corparch.corpus import BrokenCorpusInfo, CorpusInfo, TagsetInfo
from plugin_types.corparch.error import CorparchError
from plugins.default_corparch import process_pos_categories
from action.plugin.ctx import PluginCtx
from action.model.authorized import UserActionModel
from action.decorators import http_action
from util import as_async

bp = Blueprint('tree_corparch')


@dataclass_json
@dataclass
class TreeNode:
    name: str = ''
    ident: str = field(default_factory=lambda: uuid.uuid1().hex)
    corplist: List[Union['TreeNode', CorpusInfo, BrokenCorpusInfo]] = field(default_factory=list)


class CorptreeParser(object):
    """
    Parses an XML specifying corpora hierarchy
    """

    def __init__(self):
        self._metadata = {}

    def _process_tagsets(self, node: etree.Element, corpus_name: str) -> List[TagsetInfo]:
        tagsets = []
        for tagset in node.findall('tagsets/tagset'):
            tinfo = TagsetInfo(
                corpus_name=corpus_name,
                ident=tagset.attrib.get('name', None),
                type=tagset.attrib.get('type', None),
                pos_attr=tagset.attrib.get('pos_attr', None),
                feat_attr=tagset.attrib.get('feat_attr', None))
            tinfo.pos_category = process_pos_categories(tagset)
            tagsets.append(tinfo)
        return tagsets

    def parse_corpus_node(self, elm) -> CorpusInfo:
        elm_id = elm.attrib['ident'].lower()
        corp_name = elm.attrib['name'] if 'name' in elm.attrib else elm_id
        return CorpusInfo(
            id=elm_id,
            name=corp_name,
            web=elm.attrib['web'] if 'web' in elm.attrib else None,
            sentence_struct=elm.attrib['sentence_struct'] if 'sentence_struct' in elm.attrib else None,
            tagsets=self._process_tagsets(elm, corp_name),
            speech_segment=elm.attrib.get('speech_segment', None),
            speaker_id_attr=elm.attrib.get('speaker_id_attr', None),
            speech_overlap_attr=elm.attrib.get('speech_overlap_attr', None),
            speech_overlap_val=elm.attrib.get('speech_overlap_val', None),
            bib_struct=elm.attrib.get('bib_struct', None),
            _collator_locale=elm.attrib.get('collator_locale', 'en_US'),
            sample_size=elm.attrib.get('sample_size', -1))

    def parse_node(self, elm, parent: TreeNode) -> TreeNode:
        curr_parent = parent
        if elm.tag == 'corplist':
            node = TreeNode()
            node.name = elm.attrib.get('name', '-')
            if parent:
                parent.corplist.append(node)
            curr_parent = node
        elif elm.tag == 'corpus':
            parent.corplist.append(self.parse_corpus_node(elm))
        else:
            return None
        for child in [x for x in list(elm) if x.tag in ('corplist', 'corpus')]:
            (self.parse_node(child, curr_parent))
        return curr_parent

    def parse_xml_tree(self, path):
        self._metadata = {}
        with open(path, 'rb') as f:
            doc = etree.parse(f)
            srch = doc.find('/corplist')
            if srch is None:
                raise CorparchError(f'Failed to process {path} - /corplist element not found')
            return self.parse_node(srch, None), self._metadata


@bp.route('/ajax_get_corptree_data')
@http_action(return_type='json', action_model=UserActionModel)
def ajax_get_corptree_data(amodel, req, resp):
    """
    An exposed HTTP action required by client-side widget.
    """
    return plugins.runtime.CORPARCH.instance.get_all(amodel.plugin_ctx)


class TreeCorparch(AbstractCorporaArchive):
    """
    This is a 'bare bones' version of the plug-in
    without user-specific tree filtering, language-specific
    item sorting etc.
    """

    _data: TreeNode

    def __init__(self, corplist_path):
        parser = CorptreeParser()
        self._data, self._metadata = parser.parse_xml_tree(corplist_path)

    def _srch_item(self, node: TreeNode, name):
        for item in node.corplist:
            if isinstance(item, TreeNode):
                ans = self._srch_item(item, name)
                if ans:
                    return ans
            elif item.id == name:
                return item
        return None

    def _localize_corpus_info(self, plugin_ctx: PluginCtx, data: Union[CorpusInfo, BrokenCorpusInfo]):
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = copy.deepcopy(data)
        lang_code = plugin_ctx.user_lang.split('_')[0]
        desc = ans.metadata.desc
        ans.metadata.desc = desc[plugin_ctx.user_lang] if lang_code in desc else ''
        if isinstance(data, BrokenCorpusInfo):
            ans.description = 'An uninitialized corpus'
        else:
            ans.description = plugin_ctx.corpus_manager.get_info(ans.id).description
        return ans

    def setup(self, controller_obj):
        pass

    async def get_corpus_info(self, plugin_ctx, corp_id):
        info = self._srch_item(self._data, corp_id)
        if info:
            return await self._localize_corpus_info(plugin_ctx, info)
        else:
            return await self._localize_corpus_info(plugin_ctx, BrokenCorpusInfo())

    @as_async
    def get_all(self, plugin_ctx):
        return self._data

    def initial_search_params(self, plugin_ctx, query, filter_dict=None):
        return {}


def create_instance(conf):
    plugin_conf = conf.get('plugins', 'corparch')
    return TreeCorparch(corplist_path=plugin_conf['file'])
