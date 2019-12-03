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
import logging
import copy
from collections import OrderedDict

import plugins
from plugins.abstract.corpora import AbstractCorporaArchive, BrokenCorpusInfo, CorpusInfo, DefaultManateeCorpusInfo
from controller import exposed
from actions import corpora
import manatee


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
        except Exception as ex:
            logging.getLogger(__name__).warning(ex)
            # probably a misconfigured/missing corpus
            return DefaultManateeCorpusInfo(EmptyCorpus(corpname=corpus_id),
                                            corpus_id)


class EmptyCorpus(object):
    """
    EmptyCorpus serves as kind of a fake corpus to keep KonText operational
    in some special cases (= cases where we do not need any corpus to be
    instantiated which is a situation original Bonito code probably never
    count with).
    """

    def __init__(self, **kwargs):
        self.cm = object()
        self.corpname = ''
        for k, v in list(kwargs.items()):
            if hasattr(self, k):
                setattr(self, k, v)

    def compute_docf(self, *args, **kwargs):
        pass

    def count_ARF(self, *args, **kwargs):
        pass

    def count_rest(self, *args, **kwargs):
        pass

    def eval_query(self, *args, **kwargs):
        pass

    def filter_fstream(self, *args, **kwargs):
        pass

    def filter_query(self, *args, **kwargs):
        pass

    def get_attr(self, *args, **kwargs):
        pass

    def get_conf(self, param):
        return {'ENCODING': 'UTF-8'}.get(param, '')

    def get_conffile(self, *args, **kwargs):
        pass

    def get_confpath(self, *args, **kwargs):
        pass

    def get_info(self, *args, **kwargs):
        pass

    def get_sizes(self, *args, **kwargs):
        pass

    def get_struct(self, *args, **kwargs):
        pass

    def search_size(self):
        return 0

    def set_default_attr(self, *args, **kwargs):
        pass

    def size(self):
        return 0


class CorptreeParser(object):
    """
    Parses an XML specifying corpora hierarchy
    """

    def __init__(self):
        self._metadata = {}

    @staticmethod
    def _get_repo_citation(handle):
        """
        Format the handle into "citation string"
        In future this method will use repo api to fetch the citation (should be async on demand)
        :param handle:
        :return:
        """
        return '<a href="{0}">{0}</a>'.format(handle)

    @staticmethod
    def parse_node_metadata(elm):
        ans = CorpusInfo()
        ans.id = elm.attrib['ident'].lower()
        ans.name = elm.attrib['name'] if 'name' in elm.attrib else ans.id
        ans.web = elm.attrib['web'] if 'web' in elm.attrib else elm.attrib['repo'] if 'repo' in elm.attrib else None
        ans.sentence_struct = elm.attrib['sentence_struct'] if 'sentence_struct' in elm.attrib else None
        ans.tagset = elm.attrib.get('tagset', None)
        ans.speech_segment = elm.attrib.get('speech_segment', None)
        ans.bib_struct = elm.attrib.get('bib_struct', None)
        ans.collator_locale = elm.attrib.get('collator_locale', 'en_US')
        ans.sample_size = elm.attrib.get('sample_size', -1)
        ans.citation_info.default_ref = CorptreeParser._get_repo_citation(
            elm.attrib['repo']) if 'repo' in elm.attrib else None
        ans.token_connect.providers, ans.kwic_connect.providers = CorptreeParser.parse_tckc_providers(
            elm)
        return ans

    @staticmethod
    def parse_tckc_providers(node):
        tc_providers = []
        kc_providers = []
        token_connect_elm = node.find('token_connect')
        if token_connect_elm is not None:
            tc_providers = [p.text for p in token_connect_elm.findall('provider')]

        kwic_connect_elm = node.find('kwic_connect')
        if kwic_connect_elm is not None:
            kc_providers = [p.text for p in kwic_connect_elm.findall('provider')]
        return tc_providers, kc_providers

    def parse_node(self, elm):
        data = {}
        if elm.tag == 'corplist':
            data['name'] = elm.attrib['name']
        elif elm.tag == 'corpus':
            data['ident'] = elm.attrib['ident'].lower()
            data['name'] = elm.attrib['name'] if 'name' in elm.attrib else data['ident']
            data['features'] = elm.attrib['features']
            data['access'] = [group.strip()
                              for group in elm.attrib.get('access', 'anonymous').split(',')]
            data['repo'] = elm.attrib['repo'] if 'repo' in elm.attrib and elm.attrib['repo'] != '' else 'no'
            data['parallel'] = elm.attrib['parallel'] if 'parallel' in elm.attrib else 'other'
            data['pmltq'] = elm.attrib['pmltq'] if 'pmltq' in elm.attrib else 'no'
            data['tokenConnect'] = []
            token_connect_elm = elm.find('token_connect')
            if token_connect_elm is not None:
                for provider_elm in token_connect_elm.findall('provider'):
                    data['tokenConnect'].append(provider_elm.text)

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
def ajax_get_corptree_data(self, request):
    """
    An exposed HTTP action required by client-side widget.
    """
    return plugins.runtime.CORPARCH.instance.get_all(self.session_get('user', 'id'))


class TreeCorparch(AbstractCorporaArchive):
    """
    This is a 'bare bones' version of the plug-in
    without user-specific tree filtering, language-specific
    item sorting etc.
    """

    def __init__(self, corplist_path):
        parser = CorptreeParser()
        self._manatee_corpora = ManateeCorpora()
        self._data, self._metadata = parser.parse_xml_tree(corplist_path)
        self._data['sort_corplist'] = []
        for group in self._data['corplist']:
            group['level'] = 'outer'
            for corpus_info in group['corplist']:
                if 'corplist' not in corpus_info:
                    corpus_info['name'] = self._manatee_corpora.get_info(corpus_info['ident']).name
                    corpus_info['description'] = self._manatee_corpora.get_info(
                        corpus_info['ident']).description
                    corpus_info['size'] = int(
                        self._manatee_corpora.get_info(corpus_info['ident']).size)
                    corpus_info['language'] = self._manatee_corpora.get_info(
                        corpus_info['ident']).lang
                    self._data['sort_corplist'].append(corpus_info)
                else:
                    for subcorpus_info in corpus_info['corplist']:
                        subcorpus_info['name'] = self._manatee_corpora.get_info(
                            subcorpus_info['ident']).name
                        subcorpus_info['description'] = self._manatee_corpora.get_info(
                            subcorpus_info['ident']).description
                        subcorpus_info['size'] = int(
                            self._manatee_corpora.get_info(subcorpus_info['ident']).size)
                        subcorpus_info['formatted_size'] = '{:,}'.format(subcorpus_info['size'])
                        subcorpus_info['language'] = self._manatee_corpora.get_info(
                            subcorpus_info['ident']).lang
                        if subcorpus_info['parallel'] == 'default':
                            self._data['sort_corplist'].append(subcorpus_info)
                            corpus_info.update(subcorpus_info)
                            del corpus_info['corplist']
                            break
                        elif subcorpus_info['parallel'] == 'other':
                            self._data['sort_corplist'].append(subcorpus_info)
                    else:
                        corpus_info['level'] = 'inner'

    def setup(self, controller_obj):
        pass

    @staticmethod
    def _localize_corpus_info(data, lang_code):
        ans = copy.deepcopy(data)
        lang_code = lang_code.split('_')[0]
        desc = ans.metadata.desc
        if lang_code in desc:
            ans.metadata.desc = desc[lang_code]
        else:
            ans.metadata.desc = ''

        translated_k = OrderedDict()
        for keyword, label in list(ans.metadata.keywords.items()):
            if type(label) is dict and lang_code in label:
                translated_k[keyword] = label[lang_code]
            elif type(label) is str:
                translated_k[keyword] = label
        ans.metadata.keywords = translated_k
        return ans

    def get_corpus_info(self, language, corp_id):
        if corp_id:
            # get rid of path-like corpus ID prefix
            corp_id = corp_id.split('/')[-1].lower()
            if corp_id in self._metadata:
                ans = self._localize_corpus_info(self._metadata[corp_id], language)
                ans.manatee = self._manatee_corpora.get_info(corp_id)
                return ans
            else:
                return BrokenCorpusInfo(name=corp_id)
        else:
            return BrokenCorpusInfo()

    def get_all(self, user_id):
        self._data['sort_corplist'].sort(key=lambda x: x['size'], reverse=True)
        return self._data

    def export_actions(self):
        return {corpora.Corpora: [ajax_get_corptree_data]}

    def initial_search_params(self, query, filter_dict=None):
        return {}


def create_instance(conf):
    plugin_conf = conf.get('plugins', 'corparch')
    return TreeCorparch(corplist_path=plugin_conf['lindat:file'])
