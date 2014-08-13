# Copyright (c) 2013 Czech National Corpus
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
Required config.xml/plugins entries:

<corptree>
    <module>corptree</module>
    <file>[a path to a configuration XML file]</file>
    <root_elm_path>[an XPath query leading to a root element where configuration can be found]</root_elm_path>
</corptree>
"""

import threading

try:
    from markdown import markdown
except ImportError:
    markdown = lambda s: s
from lxml import etree


thread_local = threading.local()
thread_local.lang = 'en'  # default language must be set
thread_local.corplist = []


def translate_markup(s):
    """
    Transforms markdown markup into HTML
    """
    if not s:
        return None
    return markdown(s.strip())


class CorpTree(object):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    def __init__(self, file_path, root_xpath):
        self.file_path = file_path
        self.root_xpath = root_xpath

    def get_corplist_title(self, elm):
        """
        Returns locale-correct title of a corpus group (= CORPLIST XML element)
        """
        ans = None

        if self._lang():
            lang = self._lang().split('_')[0]
        else:
            lang = 'en'
        if 'title' in elm.attrib:
            if elm.attrib['title']:
                ans = elm.attrib['title']
            else:
                ans = None
        else:
            titles = elm.findall('title')
            if len(titles) > 0:
                matching = [s.text for s in titles if 'lang' in s.attrib and s.attrib['lang'] == lang]
                if len(matching) > 0:
                    ans = matching[0]
        return ans

    def _parse_corplist_node(self, root, data, path='/'):
        """
        """
        if not hasattr(root, 'tag') or not root.tag == 'corplist':
            return data
        title = self.get_corplist_title(root)
        if title:
            path = "%s%s/" % (path, title)
        for item in root:
            if not hasattr(item, 'tag'):
                continue
            elif item.tag == 'corplist':
                self._parse_corplist_node(item, data, path)
            elif item.tag == 'corpus':
                web_url = item.attrib['web'] if 'web' in item.attrib else None
                sentence_struct = item.attrib['sentence_struct'] if 'sentence_struct' in item.attrib else None

                ans = {
                    'id': item.attrib['ident'].lower(),
                    'path': path,
                    'web': web_url,
                    'sentence_struct': sentence_struct,
                    'tagset': item.attrib.get('tagset', None),
                    'speech_segment': item.attrib.get('speech_segment', None),
                    'bib_struct': item.attrib.get('bib_struct', None),
                    'citation_info': {'default_ref': None, 'article_ref': None, 'other_bibliography': None},
                    'metadata': {'database': None, 'label_attr': None, 'id_attr': None}
                }

                ref_elm = item.find('reference')
                if ref_elm is not None:
                    ans['citation_info']['default_ref'] = translate_markup(getattr(ref_elm.find('default'),
                                                                                   'text', None))
                    articles = [translate_markup(getattr(x, 'text', None)) for x in ref_elm.findall('article')]
                    ans['citation_info']['article_ref'] = articles
                    ans['citation_info']['other_bibliography'] = translate_markup(
                        getattr(ref_elm.find('other_bibliography'), 'text', None))

                meta_elm = item.find('metadata')
                if meta_elm is not None:
                    ans['metadata']['database'] = getattr(meta_elm.find('database'), 'text', None)
                    ans['metadata']['label_attr'] = getattr(meta_elm.find('label_attr'), 'text', None)
                    ans['metadata']['id_attr'] = getattr(meta_elm.find('id_attr'), 'text', None)

                data.append(ans)

    def get_corpus_info(self, corp_name):
        """
        Returns an information related to provided corpus name and contained within
        the configuration XML file (i.e. not the data from the registry file). It is
        able to handle names containing the '/' character.

        Parameters
        ----------
        corp_name : str, name of the corpus

        Returns
        -------
        a dictionary containing following keys:
        path, web
        or None if no such item is found
        """
        tmp = corp_name.split('/')
        if len(tmp) > 1:
            corp_name = tmp[1]
        else:
            corp_name = tmp[0]
        for item in self.get():
            if item['id'].lower() == corp_name.lower():
                return item
        return {}

    def _load(self, force_load=False):
        """
        Loads data from a configuration file
        """
        if len(self._list()) == 0 or force_load:
            data = []
            with open(self.file_path) as f:
                xml = etree.parse(f)
                root = xml.find(self.root_xpath)
                if root is not None:
                    self._parse_corplist_node(root, data, path='/')
            self._list(data)

    def _lang(self, v=None):
        """
        Sets or gets UI language. Values are stored in a thread-local storage so
        its ok to serve many clients with different languages via a single plug-in
        instance.

        arguments:
        v -- (optional) if not None then current language is set to [v] else current
        language is returned

        returns:
        current language if called in 'get mode'
        """
        if v is None:
            return thread_local.lang
        else:
            thread_local.lang = v

    def _list(self, v=None):
        """
        Sets or gets parsed data list.

        arguments:
        v -- (optional) if not None then current corpus list is set to the passed value else current
        list is returned

        returns:
        current corpus list if called in 'get mode'
        """
        if v is None:
            return thread_local.corplist
        else:
            thread_local.corplist = v

    def get(self):
        """
        Returns corpus tree data
        """
        return self._list()

    def setup(self, **kwargs):
        """
        Interface method expected by KonText if a module wants to be set-up by
        some "late" information (like locales).

        Please note that each request calls this method on the same instance
        which means that any client-specific data must be thread-local.
        """
        self._lang(kwargs.get('lang', None))
        self._list([])
        self._load()


def create_instance(conf):
    """
    Interface function called by KonText creates new plugin instance
    """
    return CorpTree(file_path=conf.get('plugins', 'corptree')['file'],
                    root_xpath=conf.get('plugins', 'corptree')['root_elm_path'])