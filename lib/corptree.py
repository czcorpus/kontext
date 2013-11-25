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

try:
    from docutils.core import publish_string
except ImportError:
    publish_string = lambda s: s
from lxml import etree


class CorpTree(object):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    def __init__(self, file_path, root_xpath):
        self.lang = 'en'
        self.list = None
        self.file_path = file_path
        self.root_xpath = root_xpath

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
                web_url = item.attrib['web'] if 'web' in item.attrib else None
                sentence_struct = item.attrib['sentence_struct'] if 'sentence_struct' in item.attrib else None
                num_tag_pos = int(item.attrib['num_tag_pos']) if 'num_tag_pos' in item.attrib else 16

                ans = {
                    'id': item.attrib['id'].lower(),
                    'path': path,
                    'web': web_url,
                    'sentence_struct': sentence_struct,
                    'num_tag_pos': num_tag_pos,
                    'citation_info': {'default_ref': None, 'article_ref': None, 'other_bibliography': None}
                }

                ref_elm = item.find('reference')
                if ref_elm is not None:
                    ans['citation_info']['default_ref'] = self._translate_markup(getattr(ref_elm.find('default'), 'text', None))
                    ans['citation_info']['article_ref'] = self._translate_markup(getattr(ref_elm.find('article'), 'text', None))
                    ans['citation_info']['other_bibliography'] = self._translate_markup(getattr(ref_elm.find('other_bibliography'),
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
        data = []
        with open(self.file_path) as f:
            xml = etree.parse(f)
            root = xml.find(self.root_xpath)
            if root is not None:
                self._parse_corplist_node(root, data, path='/')
        self.list = data

    def get(self):
        """
        Returns corpus tree data
        """
        return self.list

    def setup(self, lang):
        """
        Interface method expected by KonText if a module wants to be set-up by
        some "late" information (like locales)
        """
        self.lang = lang
        self._load()