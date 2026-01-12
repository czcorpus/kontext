# Copyright(c) 2016 Charles University, Faculty of Arts,
#                   Department of Linguistics
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
from typing import Callable, List, Optional

from .model import (
    AbstractMenuItem, ConcMenuItem, EventTriggeringItem, MainMenu,
    MenuItemInternal, OutData)


def _create_archive_conc_item(args):
    return EventTriggeringItem(
        MainMenu.CONCORDANCE('archive-conc'),
        'Permanent link', 'MAIN_MENU_MAKE_CONC_LINK_PERSISTENT'
    ).mark_indirect().enable_if(lambda d: d.get('user_owns_conc', False))


@dataclass
class ConcordanceDefault:

    curr_conc: ConcMenuItem = field(
        default_factory=lambda: ConcMenuItem(
            MainMenu.CONCORDANCE('current-concordance'), 'Show', 'view')
        .enable_if(lambda d: d.get('current_action', None) != 'view')
    )

    sorting: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('sorting'), 'Sorting', 'MAIN_MENU_SHOW_SORT', key_code=83, curr_conc=True).mark_indirect())

    shuffle: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('shuffle'), 'Shuffle', 'MAIN_MENU_APPLY_SHUFFLE', curr_conc=True))

    sample: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.CONCORDANCE('sample'), 'Sample', 'MAIN_MENU_SHOW_SAMPLE', key_code=77, curr_conc=True).mark_indirect())

    # we need lazy evaluation for archive_conc (all the result args must be ready)
    archive_conc: Callable[[OutData], Optional[EventTriggeringItem]] = field(
        default_factory=lambda: _create_archive_conc_item)


@dataclass
class ConcordancePquery:

    concordances: List[AbstractMenuItem] = field(default_factory=list)


@dataclass
class NewQuery:

    new_query: Callable[[OutData], MenuItemInternal] = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.NEW_QUERY('new-query'), 'Concordance', 'query').add_args(
                ('corpname', args['corpname']),
                ('usesubcorp', args['usesubcorp']),
                *[('align', v) for v in args['align']]
                if len(args['align']) else [('align', None)]).mark_indirect()
    )

    pquery: MenuItemInternal = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.NEW_QUERY('paradigmatic-query'), 'Paradigmatic query', 'pquery/index'
        ).add_args(
            ('corpname', args['corpname']),
            ('usesubcorp', args['usesubcorp'])
        ).mark_indirect()
    )

    word_list: MenuItemInternal = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.NEW_QUERY('wordlist'), 'Word List', 'wordlist/form'
        ).add_args(
            ('corpname', args['corpname']),
            ('usesubcorp', args['usesubcorp']),
            ('include_nonwords', 1)
        ).mark_indirect()
    )

    keywords_extraction: MenuItemInternal = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.NEW_QUERY('keywords'), 'Keyword analysis', 'keywords/form'
        ).add_args(
            ('corpname', args['corpname']),
            ('usesubcorp', args['usesubcorp']),
            ('ref_corpname', args['corpname'])
        ).mark_indirect()
    )

    recent_queries: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.NEW_QUERY('history'), 'Recent queries',
            'MAIN_MENU_SHOW_QUERY_HISTORY', key_code=72, key_mod='shift'  # key = 'h'
        ).mark_indirect()
    )


@dataclass
class Corpora:

    avail_corpora: MenuItemInternal = field(
        default_factory=lambda: MenuItemInternal(
            MainMenu.CORPORA('avail-corpora'), 'Available corpora', 'corpora/corplist'
        ).mark_indirect()
    )

    my_subcorpora: MenuItemInternal = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.CORPORA('my-subcorpora'), 'My subcorpora', 'subcorpus/list'
        ).add_args(
            ('corpname', args['corpname'])
        ).mark_indirect()
    )

    public_subcorpora: MenuItemInternal = field(
        default_factory=lambda: MenuItemInternal(
            MainMenu.CORPORA('public-subcorpora'), 'Public subcorpora', 'subcorpus/list_published')
    )

    create_subcorpus: Callable[[OutData], MenuItemInternal] = field(
        default_factory=lambda: lambda args: MenuItemInternal(
            MainMenu.CORPORA('create-subcorpus'), 'Create new subcorpus', 'subcorpus/new'
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
            # key = 'f'
            MainMenu.FILTER('positive'), 'Positive', 'MAIN_MENU_SHOW_FILTER', key_code=70, curr_conc=True
        ).add_args(('pnfilter', 'p'))
        .mark_indirect()
    )

    filter_neg: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FILTER('negative'), 'Negative', 'MAIN_MENU_SHOW_FILTER', curr_conc=True
        ).add_args(('pnfilter', 'n'))
        .mark_indirect()
    )

    filter_subhits: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FILTER('subhits'), 'Remove nested matches', 'MAIN_MENU_FILTER_APPLY_SUBHITS_REMOVE', curr_conc=True
        ).enable_if(lambda d: len(d.get('aligned_corpora', [])) == 0)
    )

    filter_each_first_doc: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FILTER('each-first-doc'),
            'First hits in documents',
            'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES_IN_DOCS',
            curr_conc=True,
        ).enable_if(lambda d: len(d.get('aligned_corpora', [])) == 0 and d.get('doc_struct', None))
    )

    filter_each_first_sent: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FILTER('each-first-sent'),
            'First hits in sentences',
            'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES_IN_SENTENCES',
            curr_conc=True,
        ).enable_if(lambda d: bool(d.get('sentence_struct', None)))
    )


@dataclass
class Frequency:

    freq_lemmas: Callable[[OutData], ConcMenuItem] = field(
        default_factory=lambda: lambda args: ConcMenuItem(
            MainMenu.FREQUENCY('lemmas'), 'Lemmas', 'freqs'
        ).add_args(
            ('fcrit', 'lemma/e 0~0>0'),
            ('freq_type', 'tokens')
        ).enable_if(lambda d: 'lemma' in [x['n'] for x in args.get('AttrList', ())])
    )

    freq_node_forms_i: ConcMenuItem = field(
        default_factory=lambda: ConcMenuItem(
            MainMenu.FREQUENCY('node-forms'), 'Node forms [A=a]', 'freqs', hint='case insensitive'
        ).add_args(
            ('fcrit', 'word/ie 0~0>0'),
            ('freq_type', 'tokens'))
    )

    freq_doc_ids: Callable[[OutData], ConcMenuItem] = field(
        default_factory=lambda: lambda args: ConcMenuItem(
            MainMenu.FREQUENCY('doc-ids'), 'Doc IDs', 'freqs'
        ).add_args(
            ('fcrit', args['fcrit_shortref']),
            ('freq_type', 'tokens')
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
            MainMenu.FREQUENCY('text-types'), 'Text Types', 'freqs'
        ).add_args(
            *fcrit_args
        ).add_args(
            *fcrit_async_args
        ).add_args(
            ('freq_type', 'text-types')
        ).enable_if(lambda d: bool(d['ttcrit']))

    freq_text_types: Callable[[OutData], ConcMenuItem] = field(
        default_factory=lambda: Frequency._create_text_types)

    freq_custom: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.FREQUENCY('custom'), 'Custom', 'MAIN_MENU_SHOW_FREQ_FORM',
            key_code=70, key_mod='shift', curr_conc=True  # key = 'f'
        ).mark_indirect()
    )


@dataclass
class Collocations:
    colloc_custom: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.COLLOCATIONS('custom'), 'Custom',
            'MAIN_MENU_SHOW_COLL_FORM', key_code=67, key_mod='shift', curr_conc=True  # key = 'c'
        ).mark_indirect()
    )


@dataclass
class View:
    view_mode_switch: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.VIEW('kwic-sent-switch'), 'KWIC/Sentence',
            'CONCORDANCE_SWITCH_KWIC_SENT_MODE', key_code=86)  # key = 'v'
    )

    view_structs_attrs: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.VIEW('structs-attrs'), 'Corpus-specific settings',
            'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS', key_code=79  # key = 'o'
        ).mark_corpus_dependent()
        .mark_indirect()
    )

    view_global: EventTriggeringItem = field(
        default_factory=lambda: EventTriggeringItem(
            MainMenu.VIEW('global-options'), 'General view options',
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
