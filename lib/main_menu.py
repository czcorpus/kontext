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

from collections import OrderedDict


class MenuItemNotFoundException(Exception):
    pass


class MainMenuItem(object):
    def __init__(self, name):
        self.name = name
        self.items = OrderedDict()

    def __call__(self, *items):
        for item in items:
            if type(item) is tuple:
                self.items[item[0]] = item[1]
            else:
                self.items[item] = None
        return self

    def __repr__(self):
        if len(self.items) > 0:
            return ', '.join(['%s:%s' % (self.name, item) for item in self.items.keys()])
        else:
            return self.name

    def matches(self, s):
        """
        Tests whether a provided template menu identifier
        (based on convention main_menu_item:submenu_item)
        matches this one.

        arguments:
        s -- (sub)menu item string identifier
        """
        s2 = s.split(':')
        if len(s2) == 2:
            return self.name == s2[0] and s2[1] in self.items
        else:
            return self.name == s2[0] and len(self.items) == 0

    def get_link(self, s):
        if s in self.items:
            return self.items[s]
        else:
            raise MenuItemNotFoundException('Menu item %s not found' % (s,))


class MainMenu(object):
    """
    Specifies main menu items on KonText page. Items themselves are used
    to disable parts of the menu (whole sections or individual submenu items).

    Examples:
    1) to disable whole FILTER section just add MainMenu.FILTER to the list of
       disabled menu items (see kontext.Kontext).
    2) to disable the 'word list' and 'history' functionalities in 'new query' section
       just add MainMenu.NEW_QUERY('wordlist', 'history')
    """
    NEW_QUERY = MainMenuItem('menu-new-query')
    VIEW = MainMenuItem('menu-view')
    SAVE = MainMenuItem('menu-save')
    CORPORA = MainMenuItem('menu-corpora')
    CONCORDANCE = MainMenuItem('menu-concordance')
    FILTER = MainMenuItem('menu-filter')
    FREQUENCY = MainMenuItem('menu-frequency')
    COLLOCATIONS = MainMenuItem('menu-collocations')
    HELP = MainMenuItem('menu-help')