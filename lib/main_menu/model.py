# Copyright(c) 2016 Charles University in Prague, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2016 Tomas Machalek <tomas.machalek @ gmail.com>
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

from typing import Callable


class MainMenuItemId:
    """
    A special menu item identifier used
    mainly to define menu items disabled
    in different actions. It is typically
    not instantiated directly. See
    class MainMenu below which contains
    whole menu structure with specific
    items already instantiated.
    """

    def __init__(self, name):
        self.name = name
        self.items = []

    def __call__(self, *items):
        new_obj = MainMenuItemId(name=self.name)
        new_obj.items = items
        return new_obj

    def __repr__(self):
        if len(self.items) > 0:
            return ', '.join(['%s:%s' % (self.name, item) for item in self.items])
        else:
            return self.name

    def get_sub_id(self):
        return self.items[0] if len(self.items) > 0 else None

    def matches(self, item_id):
        """
        Tests whether self matches provided item_id.
        Please note that the operation is not commutative
        (see 2) below)

        By matching we mean:
        1) both items are without sub-items and of a same name
        2) both have sub-items and the called instance's items
           are subset of item_id's ones

        Args:
        item_id (MainMenuItemId): (sub)menu item identifier
        """
        return self.name == item_id.name and (len(self.items) > 0 and set(self.items).issubset(item_id.items) or
                                              len(self.items) == 0 and len(item_id.items) == 0)


class MainMenu:
    """
    Specifies main menu items on KonText page. Items themselves are used
    to disable parts of the menu (whole sections or individual submenu items).

    Examples:
    1) to disable whole FILTER section just add MainMenu.FILTER to the list of
       disabled menu items (see kontext.Kontext).
    2) to disable the 'word list' and 'history' functionalities in 'new query' section
       just add MainMenu.NEW_QUERY('wordlist', 'history')
    """
    NEW_QUERY = MainMenuItemId('menu-new-query')
    VIEW = MainMenuItemId('menu-view')
    SAVE = MainMenuItemId('menu-save')
    CORPORA = MainMenuItemId('menu-corpora')
    CONCORDANCE = MainMenuItemId('menu-concordance')
    FILTER = MainMenuItemId('menu-filter')
    FREQUENCY = MainMenuItemId('menu-frequency')
    COLLOCATIONS = MainMenuItemId('menu-collocations')
    HELP = MainMenuItemId('menu-help')


def create_item(item_prototype):
    return MainMenuItemId(item_prototype.name)


class OutData:
    """
    A simple wrapper for accessing both
    HTML template data dictionary and
    controller's args object at the
    same time. The search order is the
    same as in Template(searchList=...)
    (i.e. tpl_data first then args)
    """

    def __init__(self, tpl_data, args):
        self._tpl_data = tpl_data
        self._args = args

    def __getitem__(self, item):
        return self.get(item, None)

    def __contains__(self, item):
        return item in self._tpl_data or hasattr(self._args, item)

    def get(self, item, default):
        if item in self._tpl_data:
            return self._tpl_data[item]
        elif hasattr(self._args, item):
            return getattr(self._args, item)
        else:
            return default


class AbstractMenuItem:
    """
    A general menu item without specified
    action/URL
    """

    def __init__(self, ident, label, hint):
        """
        Args:
            ident (MainMenuItemId): menu item identifier
            label (str): menu label presented to a user
        """
        self._ident = ident
        self._label = label
        self._hint = hint  # an additional info (typically visible on mouse-over)
        self._args = {}
        self._indirect = False
        self._corpus_dependent = False
        self._disabled = False

    def add_args(self, *args) -> 'AbstractMenuItem':
        """
        By a single argument here we understand a 2-tuple (name, value)
        """
        for k, v in args:
            if k in self._args:
                if type(self._args[k]) is list:
                    self._args[k].append(v)
                else:
                    self._args[k] = [self._args[k], v]
            else:
                self._args[k] = v
        return self

    def filter_empty_args(self):
        self._args = {k: v for k, v in self._args.items() if v not in (None, '')}
        return self

    def mark_indirect(self):
        """
        Sets an 'indirect' flag which is typically
        rendered as 'horizontal ellipsis' character
        and which denotes that the item is followed
        by some intermediate view (i.e. there is
        no direct 'real' action attached to the item).
        """
        self._indirect = True
        return self

    def mark_corpus_dependent(self):
        """
        If set then the item will be disabled
        as long as an action does not use a corpus
        instance (e.g. corpora list).
        """
        self._corpus_dependent = True
        return self

    def set_disabled(self, v):
        self._disabled = v
        return self

    @property
    def ident(self):
        """
        Returns (MainMenuItemId): this item identifier
        """
        return self._ident

    @property
    def corpus_dependent(self):
        """
        Returns (bool): True if the item makes sense only if there is a 'current corpus'
        """
        return self._corpus_dependent

    def create(self, out_data, translate: Callable[[str], str]):
        """
        Export menu item.

        Each menu item should implement its
        own way of exporting its data.

        Args:
             out_data(dict): a dictionary used to produce output template
                             (and thus containing any data we can possibly need)

        Returns (dict): a dict-encoded menu item (must be JSON-exportable)
        """
        raise NotImplementedError()


class MenuItemInternal(AbstractMenuItem):
    """
    Internal menu item is identified also
    by its action identifier (e.g. 'query',
    'corpora/corplist').
    """

    def __init__(self, ident, label, action, hint=None):
        super(MenuItemInternal, self).__init__(ident, label, hint)
        self._action = action

    def create(self, out_data, translate: Callable[[str], str]):
        return dict(
            ident=self._ident.get_sub_id(),
            label=translate(self._label),
            hint=translate(self._hint),
            action=self._action,
            indirect=self._indirect,
            currConc=False,
            args=self._args,
            disabled=self._disabled
        )


class HideOnCustomCondItem(MenuItemInternal):
    """
    Specifies a concordance-related menu item
    with custom function specifying its activation
    based on output data.
    """

    def __init__(self, ident, label, action, hint=None):
        super(HideOnCustomCondItem, self).__init__(ident, label, action, hint)
        self._fn = lambda x: True

    def enable_if(self, fn):
        self._fn = fn
        return self

    def create(self, out_data, translate: Callable[[str], str]):
        ans = super(HideOnCustomCondItem, self).create(out_data, translate)
        if not self._fn(out_data):
            ans['disabled'] = True
        return ans


class ConcMenuItem(HideOnCustomCondItem):
    """
    Specifies an action based on the current
    concordance arguments.
    """

    def __init__(self, ident, label, action, hint=None):
        super(ConcMenuItem, self).__init__(ident, label, action, hint)
        self._q = []

    def create(self, out_data, translate: Callable[[str], str]):
        ans = super(ConcMenuItem, self).create(out_data, translate)
        ans['currConc'] = True
        ans['q'] = self._q
        return ans

    def add_query_modifiers(self, *args):
        """
        This adds one or more specially handled 'q' arguments
        which are expected to be appended to the existing
        ones (as opposed to add_args).

        If you want to rewrite an existing 'q' argument
        by new value(s) then just use
        add_args(('q', 'some_value'),...).
        """
        self._q += [('q', a) for a in args]
        return self


class EventTriggeringItem(HideOnCustomCondItem):
    """
    Represents a menu item which triggers a Flux event.
    Please note that 'args' are converted into a dict which means
    that keys with multiple values are not supported.
    """

    def __init__(self, ident, label, message, key_code=None, key_mod=None, hint=None):
        super(EventTriggeringItem, self).__init__(ident, label, None, hint)
        self._message = message
        self._key_code = key_code
        self._key_mod = key_mod

    def create(self, out_data, translate: Callable[[str], str]):
        ans = super(EventTriggeringItem, self).create(out_data, translate)
        ans['message'] = self._message
        ans['keyCode'] = self._key_code
        ans['keyMod'] = self._key_mod
        ans.pop('action')
        return ans
