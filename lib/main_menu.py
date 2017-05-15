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

from translation import ugettext as _
from templating import join_params
import plugins


class MainMenuItemId(object):
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


class OutData(object):
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


class AbstractMenuItem(object):
    """
    A general menu item without specified
    action/URL
    """
    def __init__(self, ident, label):
        """
        Args:
            ident (MainMenuItemId): menu item identifier
            label (str): menu label presented to a user
        """
        self._ident = ident
        self._label = label
        self._args = []
        self._indirect = False
        self._corpus_dependent = False
        self._disabled = False

    def add_args(self, *args):
        """
        By a single argument here we understand a 2-tuple (name, value)
        """
        self._args += args
        return self

    def filter_empty_args(self):
        self._args = filter(lambda x: x[1] is not None and x[1] != '', self._args)
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

    def create(self, out_data):
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
    by its action identifier (e.g. 'first_form',
    'corpora/corplist').
    """

    def __init__(self, ident, label, action):
        super(MenuItemInternal, self).__init__(ident, label)
        self._action = action

    def create(self, out_data):
        return dict(
            ident=self._ident.get_sub_id(),
            label=self._label,
            action=self._action,
            indirect=self._indirect,
            currConc=False,
            args=self._args,
            disabled=self._disabled
        )


class MenuItemExternal(AbstractMenuItem):
    """
    Specifies a menu item containing a URL
    leading out of the application.
    """

    def __init__(self, ident, label, url):
        super(MenuItemExternal, self).__init__(ident, label)
        self._url = url

    def create(self, out_data):
        return dict(
            ident=self._ident.get_sub_id(),
            label=self._label,
            indirect=False,
            url=self._url,
            currConc=False,
            args=join_params(self._args),
            disabled=self._disabled
        )


class HideOnCustomCondItem(MenuItemInternal):
    """
    Specifies a concordance-related menu item
    with custom function specifying its activation
    based on output data.
    """
    def __init__(self, ident, label, action):
        super(HideOnCustomCondItem, self).__init__(ident, label, action)
        self._fn = lambda x: True

    def enable_if(self, fn):
        self._fn = fn
        return self

    def create(self, out_data):
        ans = super(HideOnCustomCondItem, self).create(out_data)
        if not self._fn(out_data):
            ans['disabled'] = True
        return ans


class ConcMenuItem(HideOnCustomCondItem):
    """
    Specifies an action based on the current
    concordance arguments.
    """

    def __init__(self, ident, label, action):
        super(ConcMenuItem, self).__init__(ident, label, action)
        self._q = []

    def create(self, out_data):
        ans = super(ConcMenuItem, self).create(out_data)
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


class KwicSenModeSwitchItem(ConcMenuItem):
    """
    A specific menu item for switching between
    concordance display modes (KWIC, sentence, alignment)
    """

    def __init__(self):
        super(KwicSenModeSwitchItem, self).__init__(MainMenu.VIEW('kwic-sentence'), 'Kwic/Sentence', 'view')

    def create(self, out_data):
        if not out_data['align']:
            if out_data['viewmode'] == 'sen':
                self._label = _('KWIC/Sentence')
                self._args = [('viewmode', 'kwic')]
            else:
                self._label = _('KWIC/Sentence')
                self._args = [('viewmode', 'sen')]
        else:
            if out_data['viewmode'] == 'kwic':
                self._label = _('KWIC/Sentence/Alignment')
                self._args = [('viewmode', 'sen')]
            elif out_data['viewmode'] == 'sen':
                self._label = _('KWIC/Sentence/Alignment')
                self._args = [('viewmode', 'align')]
            elif out_data['viewmode'] == 'align':
                self._label = _('KWIC/Sentence/Alignment')
                self._args = [('viewmode', 'kwic')]
        return super(KwicSenModeSwitchItem, self).create(out_data)


class EventTriggeringItem(HideOnCustomCondItem):
    """
    Represents a menu item which triggers a Flux event.
    Please note that 'args' are converted into a dict which means
    that keys with multiple values are not supported.
    """
    def __init__(self, ident, label, message):
        super(EventTriggeringItem, self).__init__(ident, label, None)
        self._message = message

    def create(self, out_data):
        ans = super(EventTriggeringItem, self).create(out_data)
        ans['message'] = self._message
        ans['args'] = dict(ans['args'])
        ans.pop('action')
        return ans


class MenuGenerator(object):

    def __init__(self, tpl_data, args):
        self._args = OutData(tpl_data, args)

        # -------------------------- menu-new-query -------------------------------------

        self.new_query = (
            MenuItemInternal(MainMenu.NEW_QUERY('new-query'), _('Enter new query'), 'first_form')
            .add_args(
                ('corpname', self._args['corpname']),
                ('usecubcorp', self._args['usesubcorp']),
                ('align', self._args['align']))
            .mark_indirect()
        )

        self.recent_queries = (
            HideOnCustomCondItem(MainMenu.NEW_QUERY('history'), _('Recent queries'), 'user/query_history')
            .add_args(
                ('corpname', self._args['corpname']))
            .mark_indirect()
        )

        self.word_list = (
            HideOnCustomCondItem(MainMenu.NEW_QUERY('wordlist'), _('Word List'), 'wordlist_form')
            .add_args(
                ('corpname', self._args['corpname']),
                ('include_nonwords', 1))
            .mark_indirect()
        )

        # ---------------------------- menu-corpora -------------------------------------

        self.avail_corpora = (
            MenuItemInternal(MainMenu.CORPORA('avail-corpora'), _('Available corpora'), 'corpora/corplist')
            .mark_indirect()
        )

        self.my_subcorpora = (
            MenuItemInternal(MainMenu.CORPORA('my-subcorpora'), _('My subcorpora'), 'subcorpus/subcorp_list')
            .mark_indirect()
        )

        self.create_subcorpus = (
            MenuItemInternal(MainMenu.CORPORA('create-subcorpus'), _('Create new subcorpus'), 'subcorpus/subcorp_form')
            .add_args(
                ('corpname', self._args['corpname']))
            .mark_indirect()
        )

        # -------------------------------- menu-save ------------------------------------

        # save items are generated dynamically during action processing
        # (see Kontext._add_save_menu_item())

        # ----------------------------- menu-concordance --------------------------------

        self.curr_conc = (
            ConcMenuItem(MainMenu.CONCORDANCE('current-concordance'), _('Current concordance'), 'view')
        )

        self.sorting = (
            EventTriggeringItem(MainMenu.CONCORDANCE('sorting'), _('Sorting'), 'MAIN_MENU_SHOW_SORT').mark_indirect()
        )

        self.shuffle = (
            EventTriggeringItem(MainMenu.CONCORDANCE('shuffle'), _('Shuffle'), 'MAIN_MENU_APPLY_SHUFFLE')
        )

        self.sample = EventTriggeringItem(MainMenu.CONCORDANCE('sample'),
                                          _('Sample'), 'MAIN_MENU_SHOW_SAMPLE').mark_indirect()

        self.query_overview = (
            EventTriggeringItem(MainMenu.CONCORDANCE('query-overview'), _
                                ('Query overview'), 'OVERVIEW_SHOW_QUERY_INFO')
        )

        self.query_undo = (
            EventTriggeringItem(MainMenu.CONCORDANCE('undo'), _('Undo'), 'MAIN_MENU_UNDO_LAST_QUERY_OP')
            .enable_if(lambda d: len(d.get('undo_q', [])) > 0)
        )

        # ------------------------------------ menu-filter ------------------------------

        self.filter_pos = (
            EventTriggeringItem(MainMenu.FILTER('positive'), _('Positive'), 'MAIN_MENU_SHOW_FILTER')
            .add_args(('pnfilter', 'p'))
            .mark_indirect()
        )

        self.filter_neg = (
            EventTriggeringItem(MainMenu.FILTER('negative'), _('Negative'), 'MAIN_MENU_SHOW_FILTER')
            .add_args(('pnfilter', 'n'))
            .mark_indirect()
        )

        # ----------------------------------- menu-frequency ----------------------------

        self.freq_lemmas = (
            ConcMenuItem(MainMenu.FREQUENCY('lemmas'), _('Lemmas'), 'freqs')
            .add_args(
                ('fcrit', 'lemma/e 0~0>0'),
                ('ml', 0))
            .enable_if(lambda d: 'tag' in [x['n'] for x in self._args.get('AttrList', ())])
        )

        self.freq_node_forms = (
            ConcMenuItem(MainMenu.FREQUENCY('node-forms'), _('Node forms'), 'freqs')
            .add_args(
                ('fcrit', 'word/e 0~0>0'),
                ('ml', 0))
        )

        self.freq_doc_ids = (
            ConcMenuItem(MainMenu.FREQUENCY('doc-ids'), _('Doc IDs'), 'freqs')
            .add_args(
                ('fcrit', self._args['fcrit_shortref']),
                ('ml', 0))
            .enable_if(lambda d: 'fcrit_shortref' in self._args and
                       '.' in self._args['fcrit_shortref'].split('/')[0])
        )

        self.freq_text_types = (
            ConcMenuItem(MainMenu.FREQUENCY('text-types'), _('Text Types'), 'freqs')
            .add_args(*self._args.get('ttcrit', []))
            .add_args(('ml', 0))
            .enable_if(lambda d: bool(d['ttcrit']))
        )

        self.freq_custom = EventTriggeringItem(MainMenu.FREQUENCY('custom'), _('Custom'), 'MAIN_MENU_SHOW_FREQ_FORM').mark_indirect()

        # -------------------------------- menu-collocations ----------------------------

        self.colloc_custom = EventTriggeringItem(MainMenu.COLLOCATIONS('custom'), _('Custom'), 'MAIN_MENU_SHOW_COLL_FORM').mark_indirect()

        # -------------------------------- menu-view ------------------------------------

        self.view_mode_switch = KwicSenModeSwitchItem()

        self.view_structs_attrs = (
            EventTriggeringItem(MainMenu.VIEW('structs-attrs'), _('Corpus-specific settings'),
                                'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS')
            .mark_corpus_dependent()
            .mark_indirect()
        )

        self.view_global = (
            ConcMenuItem(MainMenu.VIEW('global-options'), _('General view options'), 'options/viewopts')
            .mark_indirect()
        )

        # -------------------------------- menu-help ------------------------------------

        self.how_to_cite_corpus = (
            EventTriggeringItem(MainMenu.HELP('how-to-cite'), 'global__how_to_cite_corpus', 'OVERVIEW_SHOW_CITATION_INFO')
            .add_args(('corpusId', self._args['corpname']))
            .enable_if(lambda d: d['uses_corp_instance'])
            .mark_corpus_dependent()
        )

        # -------------------------------------------------------------------------------

    def generate(self, disabled_items, save_items, corpus_dependent, ui_lang):
        """
        Generate menu items based on current
        action and user state.

        Args:

        disabled_items (list of MainMenuItemId): a list of items
        save
        """

        def custom_menu_items(section):
            return map(
                lambda item: dict(label=item.label, url=item.url, openInBlank=item.open_in_blank),
                plugins.get('menu_items').get_items(section.name, lang=ui_lang)
            )

        def is_disabled(menu_item):
            if isinstance(menu_item, MainMenuItemId):
                item_id = menu_item
                item = None
            elif isinstance(menu_item, AbstractMenuItem):
                item_id = menu_item.ident
                item = menu_item
            else:
                raise ValueError()
            if corpus_dependent is False and item is not None and item.corpus_dependent is True:
                return True
            for item in disabled_items:
                if item_id.matches(item):
                    return True
            return False

        def exp(*args):
            return [item.filter_empty_args().set_disabled(is_disabled(item)).create(self._args) for item in args]

        items = [
            (MainMenu.NEW_QUERY.name, dict(
                label=_('Query'),
                fallback_action='first_form',
                items=exp(self.new_query, self.recent_queries, self.word_list),
                disabled=is_disabled(MainMenu.NEW_QUERY)
            )),
            (MainMenu.CORPORA.name, dict(
                label=_('Corpora'),
                fallback_action='corpora/corplist',
                items=exp(self.avail_corpora, self.my_subcorpora, self.create_subcorpus),
                disabled=is_disabled(MainMenu.CORPORA)
            )),
            (MainMenu.SAVE.name, dict(
                label=_('Save'),
                items=exp(*save_items),
                disabled=is_disabled(MainMenu.SAVE)
            )),
            (MainMenu.CONCORDANCE.name, dict(
                label=_('Concordance'),
                items=exp(self.curr_conc, self.sorting, self.shuffle, self.sample, self.query_overview,
                          self.query_undo),
                disabled=is_disabled(MainMenu.CONCORDANCE)
            )),
            (MainMenu.FILTER.name, dict(
                label=_('Filter'),
                items=exp(self.filter_pos, self.filter_neg),
                disabled=is_disabled(MainMenu.FILTER)
            )),
            (MainMenu.FREQUENCY.name, dict(
                label=_('Frequency'),
                items=exp(self.freq_lemmas, self.freq_node_forms, self.freq_doc_ids, self.freq_text_types,
                          self.freq_custom),
                disabled=is_disabled(MainMenu.FREQUENCY)
            )),
            (MainMenu.COLLOCATIONS.name, dict(
                label=_('Collocations'),
                items=exp(self.colloc_custom),
                disabled=is_disabled(MainMenu.COLLOCATIONS)
            )),
            (MainMenu.VIEW.name, dict(
                label=_('View'),
                items=exp(self.view_mode_switch, self.view_structs_attrs, self.view_global),
                disabled=is_disabled(MainMenu.VIEW)
            )),
            (MainMenu.HELP.name, dict(
                label=_('Help'),
                items=custom_menu_items(MainMenu.HELP) + exp(self.how_to_cite_corpus),
                disabled=is_disabled(MainMenu.HELP)
            ))
        ]
        return dict(submenuItems=items)
