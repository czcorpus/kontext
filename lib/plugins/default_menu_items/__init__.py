# Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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
A default menu_items plug-in implementation. Please note that
KonText currently understands only "menu-help" section.

required XML structure:

element menu_items {
  element module { "default_menu_items" }
  element data_path {
    text # path to a json file containing menu_items.json
  }
}

required menu data format (JSON):

{
 "menu-help": [
    {
        "type": "static",
        "data": {
            "en_US": {
                "url": "http://wiki.korpus.cz/manual/en",
                "label": "User manual"
            } ,
            "de_DE": {
                "url": "http://wiki.korpus.cz/de/manual",
                "label": "das Benutzerhandbuch"
            }
        }
    },
    ...
 ],
 "menu-new-query": [
   ...
]

For the list of main menu section identifiers please refer 
to the main_menu.MainMenu class.

"""

import json

from plugins.abstract.menu_items import AbstractMenuItems, StaticMenuItem, DynamicMenuItem


class MenuItems(AbstractMenuItems):

    def __init__(self, conf):
        with open(conf['data_path'], 'rb') as f:
            self._data = json.load(f)

    def get_items(self, menu_section, lang):
        """
        """
        ans = []
        for item in self._data.get(menu_section, []):
            if item['type'] == 'static':
                entry = item['data']
                if lang in item:
                    ans.append(StaticMenuItem(entry[lang], lang=lang))
                else:
                    for lang_code, label in list(entry.items()):
                        if lang[:2] == lang_code[:2]:
                            ans.append(StaticMenuItem(entry[lang_code], lang=lang))
                            break
            elif item['type'] == 'dynamic':
                ans.append(DynamicMenuItem(item['ident']))
        return ans


def create_instance(settings):
    return MenuItems(settings.get('plugins', 'menu_items'))
