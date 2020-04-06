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

import plugins
from plugins.abstract.corpora import AbstractCorporaArchive, BrokenCorpusInfo, CorpusInfo, DefaultManateeCorpusInfo
from fallback_corpus import EmptyCorpus
from controller import exposed
from actions import corpora
import manatee


class CorptreeParser(object):
    """
    Parses an XML specifying corpora hierarchy
    """

    def __init__(self):
        self._metadata = {}

    @staticmethod
    def parse_node_metadata(elm):
        ans = CorpusInfo()
        ans.id = elm.attrib['ident'].lower()
        ans.name = elm.attrib['name'] if 'name' in elm.attrib else ans.id
        ans.web = elm.attrib['web'] if 'web' in elm.attrib else None
        ans.sentence_struct = elm.attrib['sentence_struct'] if 'sentence_struct' in elm.attrib else None
        ans.tagset = elm.attrib.get('tagset', None)
        ans.tagset_type = elm.attrib.get('tagset_type', None)
        ans.tagset_pos_attr = elm.attrib.get('tagset_pos_attr', None)
        ans.tagset_feat_attr = elm.attrib.get('tagset_feat_attr', None)
        ans.speech_segment = elm.attrib.get('speech_segment', None)
        ans.speaker_id_attr = elm.attrib.get('speaker_id_attr', None)
        ans.speech_overlap_attr = elm.attrib.get('speech_overlap_attr', None)
        ans.speech_overlap_val = elm.attrib.get('speech_overlap_val', None)
        ans.bib_struct = elm.attrib.get('bib_struct', None)
        ans.collator_locale = elm.attrib.get('collator_locale', 'en_US')
        ans.sample_size = elm.attrib.get('sample_size', -1)
        ans.metadata = None
        ans.citation_info = None
        return ans

    def parse_node(self, elm):
        data = {}
        if elm.tag == 'corplist':
            data['name'] = elm.attrib['name']
        elif elm.tag == 'corpus':
            data['ident'] = elm.attrib['ident'].lower()
            data['name'] = elm.attrib['name'] if 'name' in elm.attrib else data['ident']
            self._metadata[data['ident']] = self.parse_node_metadata(elm)
        for child in [x for x in list(elm) if x.tag in ('corplist', 'corpus')]:
            if 'corplist' not in data:
                data['corplist'] = []
            data['corplist'].append(self.parse_node(child))
        return data

    def parse_xml_tree(self, path):
        self._metadata = {}
        with open(path, 'rb') as f:
            doc = etree.parse(f)
            return self.parse_node(doc.getroot()), self._metadata


@exposed(return_type='json', skip_corpus_init=True)
def ajax_get_corptree_data(ctrl, request):
    """
    An exposed HTTP action required by client-side widget.
    """
    return plugins.runtime.CORPARCH.instance.get_all(ctrl._plugin_api)


class ManateeCorpora(object):
    """
    A caching source of ManateeCorpusInfo instances.
    """

    def __init__(self):
        self._cache = {}

    def get_info(self, corpus_id):
        try:
            if corpus_id not in self._cache:
                self._cache[corpus_id] = DefaultManateeCorpusInfo(
                    manatee.Corpus(corpus_id), corpus_id)
            return self._cache[corpus_id]
        except:
            # probably a misconfigured/missing corpus
            return DefaultManateeCorpusInfo(EmptyCorpus(corpname=corpus_id),
                                            corpus_id)


class TreeCorparch(AbstractCorporaArchive):
    """
    This is a 'bare bones' version of the plug-in
    without user-specific tree filtering, language-specific
    item sorting etc.
    """

    def __init__(self, corplist_path):
        parser = CorptreeParser()
        self._data, self._metadata = parser.parse_xml_tree(corplist_path)
        self._manatee_corpora = ManateeCorpora()

    def _srch_item(self, node, name):
        for item in node.get('corplist', []):
            if 'corplist' in item:
                ans = self._srch_item(item, name)
                if ans:
                    return ans
            elif item.get('ident') == name:
                return item
        return None

    def _localize_corpus_info(self, data, lang_code):
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = copy.deepcopy(data)
        lang_code = lang_code.split('_')[0]
        desc = ans.metadata.desc
        ans.metadata.desc = desc[lang_code] if lang_code in desc else ''
        ans.description = self._manatee_corpora.get_info(ans.id).description
        return ans

    def setup(self, controller_obj):
        pass

    def get_corpus_info(self, user_lang, corp_id):
        info = self._srch_item(self._data, corp_id)
        if info:
            ans = CorpusInfo()
            ans.id = info.get('id')
            ans.name = info.get('name')
            ans.manatee = self._manatee_corpora.get_info(corp_id)
            return self._localize_corpus_info(ans, user_lang)
        else:
            return self._localize_corpus_info(BrokenCorpusInfo(), user_lang)

    def get_all(self, plugin_api):
        return self._data

    def export_actions(self):
        return {corpora.Corpora: [ajax_get_corptree_data]}

    def initial_search_params(self, plugin_api, query, filter_dict=None):
        return {}


def create_instance(conf):
    plugin_conf = conf.get('plugins', 'corparch')
    return TreeCorparch(corplist_path=plugin_conf['file'])
