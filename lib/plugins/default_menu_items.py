# Copyright (c) 2015 Institute of the Czech National Corpus
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

<plugins>
...
  <menu_items>
     <module>default_menu_items</module>
     <data_path extension-by="default">/path/to/a/json/file/containing/menu_items.json</data_path>
  </menu_items>
...
</plugins>


required menu data format (JSON):

{
 "menu-help": [
    {
        "en_US": {
            "url": "http://wiki.korpus.cz/manual/en",
            "label": "User manual"
        } ,
        "de_DE": {
            "url": "http://wiki.korpus.cz/de/manual",
            "label": "das Benutzerhandbuch"
        }
    },
    ...
 ],
 "menu-new-query": [
   ...
]

Note: currently only "menu-help" is supported.

"""

import json

from plugins.abstract.menu_items import AbstractMenuItems, MenuItem


class MenuItems(AbstractMenuItems):

    def __init__(self, conf):
        with open(conf['default:data_path'], 'rb') as f:
            self._data = json.load(f)

    def get_items(self, menu_section, lang):
        """
        """
        ans = []
        for item in self._data.get(menu_section, []):
            if lang in item:
                ans.append(MenuItem(item[lang], lang=lang))
            else:
                for lang_code, label in item.items():
                    if lang[:2] == lang_code[:2]:
                        ans.append(MenuItem(item[lang_code], lang=lang))
                        break
        return ans


def create_instance(settings, db):
    return MenuItems(settings.get('plugins', 'menu_items'))