# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
A simple customizable footer plug-in implementation.
It expects you to define a single directory containing
Markdown text files named 'text-[2-char lang code].md'
(e.g. text-en.md). File 'text-en.md' should be always
present unless you are sure that other defined
languages are always applicable.

Required plug-in configuration:

element footer_bar {
  element module { "default_footer_bar" }
  element js_module { "defaultFooterBar" }
  element content_dir {
    attribute extension-by { "default" }
    text
  }
}
"""

import os
import logging

try:
    from markdown import markdown
except ImportError:
    def markdown(s): return s

from plugins.abstract.footer_bar import AbstractFootbar


class FooterBar(AbstractFootbar):

    def __init__(self, content_dir):
        self._content_dir = content_dir
        self._lang_text_map = dict((item.split('.')[0].split('-')[1], self._get_text_path(item))
                                   for item in os.listdir(self._content_dir))
        if 'en' not in self._lang_text_map:
            logging.getLogger(__name__).warning('Missing *en* version of a footer text. Found: %s' % (
                ', '.join(self._lang_text_map)))

    def _get_text_path(self, filename):
        return os.path.join(self._content_dir, filename)

    def get_contents(self, plugin_api, return_url=None):
        lang = plugin_api.user_lang[:2]
        if lang not in self._lang_text_map:
            lang = 'en'
        with open(self._lang_text_map[lang], mode='rb') as fin:
            return markdown(fin.read().decode('utf-8'))


def create_instance(conf):
    return FooterBar(content_dir=conf.get('plugins', 'footer_bar')['content_dir'])
