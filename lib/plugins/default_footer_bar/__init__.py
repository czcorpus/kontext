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

please see ./config.rng
"""

import os
import logging

try:
    from markdown import markdown
except ImportError:
    def markdown(s): return s

from plugins.abstract.footer_bar import AbstractFootbar


class ImplicitFooterBar(AbstractFootbar):
    """
    Implicit footer bar return nothing which
    forces KonText template document.tmpl to
    use default variant.
    """

    def get_contents(self, plugin_api, return_url=None):
        return None


class CustomContentFooterBar(AbstractFootbar):
    """
    CustomContentFooterBar loads localized Markdown files from
    a specified directory and passes them to document.tmpl
    template. The only forced contents is 'debugging mode'
    box in case debugging mode is on.
    """

    def __init__(self, content_dir, avail_langs, default_lang):
        self._content_dir = content_dir
        self._avail_langs = avail_langs
        self._default_lang = default_lang
        self._lang_text_map = {}
        for item in os.listdir(self._content_dir):
            key = item.split('.')[0].split('-')[1]
            if not self._is_in_avail_langs(key):
                logging.getLogger(__name__).warning(
                    'Footer bar file {0} not compatible with installed translations.'.format(item))
            self._lang_text_map[key] = self._get_text_path(item)

        if self._default_lang not in self._lang_text_map:
            logging.getLogger(__name__).warning(
                'Missing default version ({0}) of a footer text. Found: {1}'.format(
                    self._default_lang, ', '.join(self._lang_text_map)))

    def _is_in_avail_langs(self, v):
        for a in self._avail_langs:
            if a.startswith(v):
                return True
        return False

    def _get_text_path(self, filename):
        return os.path.join(self._content_dir, filename)

    def get_contents(self, plugin_api, return_url=None):
        lang = plugin_api.user_lang[:2]
        if lang not in self._lang_text_map:
            lang = self._default_lang
        with open(self._lang_text_map[lang], mode='rb') as fin:
            return markdown(fin.read().decode('utf-8'))


def create_instance(conf):
    plg_conf = conf.get('plugins', 'footer_bar')
    content_dir = plg_conf.get('default:content_dir', None)
    if content_dir:
        return CustomContentFooterBar(content_dir=content_dir, avail_langs=conf.get('global', 'translations'),
                                      default_lang=plg_conf['default:default_lang'])
    return ImplicitFooterBar()
