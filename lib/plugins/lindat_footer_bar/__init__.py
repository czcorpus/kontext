# Copyright (c) 2016 Czech National Corpus
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

    def get_contents(self, plugin_api, return_url=None):
        tpl_path = self.get_template(plugin_api.user_lang)
        if not os.path.exists(tpl_path):
            return "template [%s] does not exist!" % tpl_path
        with open(tpl_path, mode='rb') as fin:
            return fin.read().decode('utf-8')

    def get_fallback_content(self):
        return ''


def create_instance(settings):
    plugin_conf = settings.get('plugins', 'footer_bar')
    templates = {
        'cs_CZ': plugin_conf['lindat:template_cs'],
        'en_US': plugin_conf['lindat:template_en'],
        'sl_SI': plugin_conf['lindat:template_sl']
    }
    return FootBar(templates=templates)
