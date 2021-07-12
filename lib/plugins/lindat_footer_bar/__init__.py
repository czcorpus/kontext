# Copyright (c) 2016 Charles University, Faculty of Arts,
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
Required plug-in configuration:

element footer_bar {
  element module { "lindat_footer_bar" }
  element js_module { "lindatFooterBar" }
  element template_cs {
}
"""
import logging
import os

from plugins.abstract.footer_bar import AbstractFootbar


class FootBar(AbstractFootbar):

    def __init__(self, templates=None):
        self._templates = templates if type(templates) is dict else {}

    def get_template(self, lang):
        if lang in self._templates:
            return self._templates[lang]
        else:
            return self._templates['en_US']

    def get_contents(self, plugin_ctx, return_url=None):
        tpl_path = self.get_template(plugin_ctx.user_lang)
        if not os.path.exists(tpl_path):
            return "template [%s] does not exist!" % tpl_path
        with open(tpl_path, mode='rb') as fin:
            return fin.read().decode('utf-8')

    def get_fallback_content(self):
        return ''


def create_instance(settings):
    plugin_conf = settings.get('plugins', 'footer_bar')
    tpl_langs = {}
    templates = {}
    for k, v in plugin_conf.items():
        if k.startswith('template_'):
            tpl_langs[k[len('template_'):]] = v
    for lang in settings.get('global', 'translations'):
        code = lang.split('-')[0]
        if code in tpl_langs:
            templates[lang] = tpl_langs[code]
        else:
            logging.getLogger(__name__).warning(f'no configured footer template for "{lang}" language')
    return FootBar(templates=templates)
