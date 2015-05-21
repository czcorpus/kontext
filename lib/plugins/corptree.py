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

import cPickle
import os
import logging

try:
    from docutils.core import publish_string
except ImportError:
    publish_string = lambda s: s
from lxml import etree


class Cache(object):
    """
    cPickle-based key-value storage.
    Cache supports dict-like access to individual records (d = cache['foo'],
    cache['bar'] = ...).

    arguments:
    data_path -- path to a corptree XML file
    last_sys_change -- a timestamp or a function returning a timestamp specifying
    the last change in KonText (e.g. configuration update)
    """
    def __init__(self, data_path, last_sys_change=None):
        """
        arguments:
        data_path -- path to a serialized cache data; if it does not exist then a new file is created
        """
        self.data_path = data_path
        self.data = {}
        self.last_sys_change = last_sys_change if callable(last_sys_change) else lambda: last_sys_change
        try:
            if self._cache_is_valid():
                with open(self.data_path, 'rb') as f:
                    self.data = cPickle.load(f)
                    if type(self.data) is not dict:
                        self.data = {}
            else:
                os.unlink(self.data_path)
        except Exception as e:
            logging.getLogger(__name__).warning(e)
            self.data = {}

    def _cache_is_valid(self):
        return os.path.getmtime(self.data_path) >= self.last_sys_change()

    def save(self):
        """
        Saves cache to the 'self.data_path' file.
        """
        with open(self.data_path, 'wb') as f:
            cPickle.dump(self.data, f)

    def __getitem__(self, user_id):
        return self.data[user_id]

    def __setitem__(self, user_id, data):
        self.data[user_id] = data

    def __contains__(self, user_id):
        return self.data.__contains__(user_id)


class CorpTree(object):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format

    arguments:
    file_path -- path to an XML file containing corpora tree definition
    root_xpath -- where to start the search for corpora tree in terms of an XML structure
    cache_factory -- a function with parameter 'lang' which produces a language-dependent cache instance
    (or None if not supported)
    """

    def __init__(self, file_path, root_xpath, cache_factory=None):
        self.lang = 'en'
        self.list = None
        self.file_path = file_path
        self.root_xpath = root_xpath
        self.cache_factory = cache_factory
        self.cache = None

    def _translate_markup(self, s):
        """
        Transforms docutils markup into HTML subtree
        """
        if not s:
            return None
        html = publish_string(source=s, settings_overrides={'file_insertion_enabled': 0, 'raw_enabled': 0},
                              writer_name='html')
        html = html[html.find('<body>')+6:html.find('</body>')].strip()
        html = html.decode('utf-8')
        return html

    def get_corplist_title(self, elm):
        """
        Returns locale-correct title of a corpus group (= CORPLIST XML element)
        """
        ans = None

        if self.lang:
            lang = self.lang.split('_')[0]
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
                ans = {
                    'id': item.attrib['id'].lower(),
                    'path': path,
                    'sentence_struct': None,
                    # found 16 as default used before
                    'num_tag_pos': 16,
                    'speech_segment': None,
                    'citation_info': {
                        'default_ref': None,
                        'article_ref': None,
                        'other_bibliography': None
                    },
                    'keyboard_lang': None
                }

                for k, v in item.attrib.items():
                    if k in ('num_tag_pos', ):
                        ans[k] = int(v)
                    else:
                        ans[k] = v

                ref_elm = item.find('reference')
                if ref_elm is not None:
                    ans['citation_info']['default_ref'] = self._translate_markup(getattr(ref_elm.find('default'),
                                                                                         'text', None))
                    articles = [self._translate_markup(getattr(x, 'text', None)) for x in ref_elm.findall('article')]
                    ans['citation_info']['article_ref'] = articles
                    ans['citation_info']['other_bibliography'] = self._translate_markup(
                        getattr(ref_elm.find('other_bibliography'),
                                'text', None))
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

    def _load(self):
        """
        Loads data from a configuration file
        """
        if self.cache and 'corptree' in self.cache:
            self.list = self.cache['corptree']
        else:
            data = []
            with open(self.file_path) as f:
                xml = etree.parse(f)
                root = xml.find(self.root_xpath)
                if root is not None:
                    self._parse_corplist_node(root, data, path='/')
            self.list = data
            if self.cache:
                self.cache['corptree'] = self.list
                self.cache.save()

    def get(self):
        """
        Returns corpus tree data
        """
        return self.list

    def setup(self, **kwargs):
        """
        Interface method expected by KonText if a module wants to be set-up by
        some "late" information (like locales)
        """
        self.lang = kwargs.get('lang', None)
        self.cache = self.cache_factory(self.lang)
        self._load()


def create_instance(conf):
    """
    Interface function called by KonText creates new plugin instance
    """
    cache_path = conf.get('plugins', 'corptree').get('ucnk:cache_path', None)

    def cache_factory(lang):
        cache = None
        if cache_path:
            if not lang:
                lang = 'en'
            cache = Cache(cache_path % lang, last_sys_change=conf.get_mtime)
        return cache

    return CorpTree(file_path=conf.get('plugins', 'corptree')['file'],
                    root_xpath=conf.get('plugins', 'corptree')['root_elm_path'],
                    cache_factory=cache_factory)