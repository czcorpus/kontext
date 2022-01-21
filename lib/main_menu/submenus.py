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

from dataclasses import dataclass, field
from typing import Callable, Optional, List

from translation import ugettext as te
from .model import (
    AbstractMenuItem, ConcMenuItem, MainMenu, EventTriggeringItem, MenuItemInternal, HideOnCustomCondItem, OutData
)


def _create_archive_conc_item(args):
    if args['explicit_conc_persistence_ui']:
        return EventTriggeringItem(MainMenu.CONCORDANCE('archive-conc'),
                                   te('Permanent link'), 'MAIN_MENU_MAKE_CONC_LINK_PERSISTENT'
                                   ).mark_indirect().enable_if(lambda d: d.get('user_owns_conc', False))
    else:
        return None


@dataclass
class ConcordanceDefault:

    curr_conc: ConcMenuItem = field(
        default_factory=lambda: ConcMenuItem(
            MainMenu.CONCORDANCE('current-concordance'), te('Current concordance'), 'view'))

    sorting: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('sorting'), te('Sorting'), 'MAIN_MENU_SHOW_SORT', key_code=83).mark_indirect())

    shuffle: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('shuffle'), te('Shuffle'), 'MAIN_MENU_APPLY_SHUFFLE'))

    sample: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('sample'), te('Sample'), 'MAIN_MENU_SHOW_SAMPLE', key_code=77).mark_indirect())

    query_overview: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('query-overview'), te('Query overview'), 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO'))

    query_save_as: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('query-save-as'), te('Archive query'), 'MAIN_MENU_SHOW_SAVE_QUERY_AS_FORM'
                ).mark_indirect().enable_if(lambda d: d.get('user_owns_conc', False))
    )

    # we need lazy evaluation for archive_conc (all the result args must be ready)
    archive_conc: Callable[[OutData], Optional[EventTriggeringItem]] = field(
        default_factory=lambda: _create_archive_conc_item)

    query_undo: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('undo'), te('Undo'), 'MAIN_MENU_UNDO_LAST_QUERY_OP'
                ).enable_if(lambda d: len(d.get('undo_q', [])) > 0))


@dataclass
class ConcordancePquery:

    concordances: List[AbstractMenuItem] = field(default_factory=list)


@dataclass
class NewQuery:

    new_query: Callable[[OutData], MenuItemInternal] = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.NEW_QUERY('new-query'), te('Concordance'), 'query').add_args(
                ('corpname', args['corpname']),
                ('usesubcorp', args['usesubcorp']),
                *[('align', v) for v in args['align']]
                if len(args['align']) else [('align', None)]).mark_indirect()
    )

    recent_queries: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.NEW_QUERY('history'), te('Recent queries'),
            'MAIN_MENU_SHOW_QUERY_HISTORY', key_code=72, key_mod='shift'  # key = 'h'
        ).mark_indirect()
    )

    pquery: MenuItemInternal = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.NEW_QUERY('paradigmatic-query'), te('Paradigmatic query'), 'pquery/index'
        ).add_args(
            ('corpname', args['corpname']),
            ('usesubcorp', args['usesubcorp'])
        ).mark_indirect()
    )

    word_list: HideOnCustomCondItem = field(
        default_factory=lambda: lambda args: HideOnCustomCondItem(
            MainMenu.NEW_QUERY('wordlist'), te('Word List'), 'wordlist/form'
        ).add_args(
            ('corpname', args['corpname']),
            ('include_nonwords', 1)
        ).mark_indirect()
    )


@dataclass
class Corpora:

    avail_corpora: MenuItemInternal = field(
        default_factory=lambda: MenuItemInternal(
            MainMenu.CORPORA('avail-corpora'), te('Available corpora'), 'corpora/corplist'
        ).mark_indirect()
    )

    my_subcorpora: MenuItemInternal = field(
        default_factory=lambda: MenuItemInternal(
            MainMenu.CORPORA('my-subcorpora'), te('My subcorpora'), 'subcorpus/list'
        ).mark_indirect()
    )

    public_subcorpora: MenuItemInternal = field(
        default_factory=lambda: MenuItemInternal(
            MainMenu.CORPORA('public-subcorpora'), te('Public subcorpora'), 'subcorpus/list_published')
    )

    create_subcorpus: Callable[[OutData], MenuItemInternal] = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.CORPORA('create-subcorpus'), te('Create new subcorpus'), 'subcorpus/new'
        ).add_args(
            ('corpname', args['corpname'])
        ).mark_indirect()
    )


@dataclass
class Save:

    save_items: List[AbstractMenuItem] = field(default_factory=list)


@dataclass
class Filter:

    filter_pos: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FILTER('positive'), te('Positive'), 'MAIN_MENU_SHOW_FILTER', key_code=70  # key = 'f'
        ).add_args(('pnfilter', 'p'))
        .mark_indirect()
    )

    filter_neg: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FILTER('negative'), te('Negative'), 'MAIN_MENU_SHOW_FILTER'
        ).add_args(('pnfilter', 'n'))
        .mark_indirect()
    )

    filter_subhits: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FILTER('subhits'), te('Remove nested matches'), 'MAIN_MENU_FILTER_APPLY_SUBHITS_REMOVE')
    )

    filter_each_first: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FILTER('each-first'), te('First hits in documents'), 'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES'
        ).enable_if(lambda d: len(d.get('aligned_corpora', [])) == 0)
    )


@dataclass
class Frequency:

    freq_lemmas: Callable[[OutData], ConcMenuItem] = field(
        default_factory=lambda: lambda args: ConcMenuItem(
            MainMenu.FREQUENCY('lemmas'), te('Lemmas'), 'freqs'
        ).add_args(
            ('fcrit', 'lemma/e 0~0>0'),
            ('ml', 0)
        ).enable_if(lambda d: 'tag' in [x['n'] for x in args.get('AttrList', ())])
    )

    freq_node_forms_i: ConcMenuItem = field(
        default_factory=lambda: ConcMenuItem(
            MainMenu.FREQUENCY('node-forms'), te('Node forms') + ' [A=a]', 'freqs', hint=te('case insensitive')
        ).add_args(
            ('fcrit', 'word/ie 0~0>0'),
            ('ml', 0))
    )

    freq_doc_ids: Callable[[OutData], ConcMenuItem] = field(
        default_factory=lambda: lambda args: ConcMenuItem(
            MainMenu.FREQUENCY('doc-ids'), te('Doc IDs'), 'freqs'
        ).add_args(
            ('fcrit', args['fcrit_shortref']),
            ('ml', 0)
        ).enable_if(lambda d: 'fcrit_shortref' in args and '.' in args['fcrit_shortref'].split('/')[0])
    )

    @staticmethod
    def _create_text_types(args):
        fcrit_tmp = args.get('ttcrit', [])
        if len(fcrit_tmp) > 0:
            fcrit_args = [('fcrit', fcrit_tmp[0])]
            fcrit_async_args = [('fcrit_async', f) for f in fcrit_tmp[1:]]
        else:
            fcrit_args = []
            fcrit_async_args = []
        return ConcMenuItem(
            MainMenu.FREQUENCY('text-types'), te('Text Types'), 'freqs'
        ).add_args(
            *fcrit_args
        ).add_args(
            *fcrit_async_args
        ).add_args(
            ('ml', 0)
        ).enable_if(lambda d: bool(d['ttcrit']))

    freq_text_types: Callable[[OutData], ConcMenuItem] = field(
        default_factory=lambda: Frequency._create_text_types)

    freq_custom: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FREQUENCY('custom'), te('Custom'), 'MAIN_MENU_SHOW_FREQ_FORM',
            key_code=70, key_mod='shift'  # key = 'f'
        ).mark_indirect()
    )


@dataclass
class Collocations:
    colloc_custom: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.COLLOCATIONS('custom'), te('Custom'),
            'MAIN_MENU_SHOW_COLL_FORM', key_code=67, key_mod='shift'  # key = 'c'
        ).mark_indirect()
    )


@dataclass
class View:
    view_mode_switch: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.VIEW('kwic-sent-switch'), te('KWIC/Sentence'),
            'CONCORDANCE_SWITCH_KWIC_SENT_MODE', key_code=86)  # key = 'v'
    )

    view_structs_attrs: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.VIEW('structs-attrs'), te('Corpus-specific settings'),
            'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS', key_code=79  # key = 'o'
        ).mark_corpus_dependent()
        .mark_indirect()
    )

    view_global: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.VIEW('global-options'), te('General view options'),
            'MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS', key_code=79, key_mod='shift'  # key = 'o'
        ).mark_indirect()
    )


@dataclass
class Help:

    how_to_cite_corpus: Callable[[OutData], EventTriggeringItem] = field(
        default_factory=lambda: lambda args: EventTriggeringItem(
            MainMenu.HELP('how-to-cite'), 'global__how_to_cite_corpus', 'OVERVIEW_SHOW_CITATION_INFO'
        ).add_args(
            ('corpusId', args['corpname'])
        ).enable_if(
            lambda d: d['uses_corp_instance']
        ).mark_corpus_dependent()
    )

    keyboard_shortcuts: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.HELP('keyboard-shortcuts'), 'global__keyboard_shortcuts',
            'OVERVIEW_SHOW_KEY_SHORTCUTS', key_code=75, key_mod='shift')  # key = 'k')
    )
