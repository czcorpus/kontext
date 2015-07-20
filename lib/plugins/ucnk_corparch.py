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
A plug-in providing user's favorite and global featured corpora lists. The data
are passed through via the 'export' method which is recognized by KonText and then
interpreted via a custom JavaScript (which is an integral part of the plug-in).


Required config.xml/plugins entries:

<corparch>
    <module>corparch</module>
    <file>[a path to a configuration XML file]</file>
    <root_elm_path>
        [an XPath query leading to a root element where configuration can be found]
    </root_elm_path>
    <tag_prefix extension-by="default">
        [a spec. character specifying that the following string is a tag/label]
    </tag_prefix>
    <max_num_hints>
        [the maximum number of hints corpus selection widget shows (even if there are more results
         available]
    </max_num_hints>
</corparch>

How does the corpus list specification XML entry looks like:

<a_root_elm>
  <corpus sentence_struct="p" ident="SUSANNE" collator_locale="cs_CZ" tagset="pp_tagset"
      web="http://www.korpus.cz/syn2010.php">
    <metadata>
      <featured />
      <keywords>
        <item>foreign_language_corpora</item>
        <item>written_corpora</item>
      </keywords>
    </metadata>
  </corpus>
   ...
</a_root_elm>

"""

try:
    from markdown import markdown
except ImportError:
    markdown = lambda s: s


from plugins import inject
from plugins.default_corparch import CorpTree
import l10n

DEFAULT_LANG = 'en'


class UcnkCorpArch(CorpTree):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    FEATURED_KEY = 'featured'
    FAVORITE_KEY = 'favorite'

    def __init__(self, auth, user_items, file_path, root_xpath, tag_prefix, max_num_hints,
                 max_page_size):
        super(UcnkCorpArch, self).__init__(auth=auth, user_items=user_items, file_path=file_path,
                                           root_xpath=root_xpath, tag_prefix=tag_prefix,
                                           max_num_hints=max_num_hints, max_page_size=max_page_size)

    def get_list(self, user_allowed_corpora):
        """
        arguments:
        user_allowed_corpora -- a dict (corpus_canonical_id, corpus_id) containing corpora ids
                                accessible by the current user
        """
        simple_names = set(user_allowed_corpora.keys())
        cl = []
        for item in self._raw_list().values():
            canonical_id, path, web = item['id'], item['path'], item['sentence_struct']
            if canonical_id in simple_names:
                try:
                    corp_id = user_allowed_corpora[canonical_id]
                    corp_info = self._manatee_corpora.get_info(corp_id)

                    cl.append({'id': corp_id,
                               'canonical_id': canonical_id,
                               'name': l10n.import_string(corp_info.name,
                                                          from_encoding=corp_info.encoding),
                               'desc': l10n.import_string(corp_info.description,
                                                          from_encoding=corp_info.encoding),
                               'size': corp_info.size,
                               'path': path
                               })
                except Exception, e:
                    import logging
                    logging.getLogger(__name__).warn(
                        u'Failed to fetch info about %s with error %s (%r)' % (corp_info.name,
                                                                               type(e).__name__, e))
                    cl.append({
                        'id': corp_id, 'canonical_id': canonical_id, 'name': corp_id,
                        'path': path, 'desc': '', 'size': None})
        return cl


@inject('auth', 'user_items')
def create_instance(conf, auth, user_items):
    """
    Interface function called by KonText creates new plugin instance
    """
    return CorpTree(auth=auth,
                    user_items=user_items,
                    file_path=conf.get('plugins', 'corparch')['file'],
                    root_xpath=conf.get('plugins', 'corparch')['root_elm_path'],
                    tag_prefix=conf.get('plugins', 'corparch')['default:tag_prefix'],
                    max_num_hints=conf.get('plugins', 'corparch')['default:max_num_hints'],
                    max_page_size=conf.get('plugins', 'corparch').get(
                        'default:default_page_list_size', None))
