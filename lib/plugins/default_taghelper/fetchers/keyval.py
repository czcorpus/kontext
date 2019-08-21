# Copyright (c) 2019 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2019 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2019 Tomas Machalek <tomas.machalek@gmail.com>
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

from collections import defaultdict
from plugins.abstract.taghelper import AbstractValueSelectionFetcher

UD_KEYS = {  # taken from `universaldependencies.org` specification
    'POS': 'part of speech',  # added artificially
    'Abbr': 'abbreviation',
    'AbsErgDatNumber': 'number agreement with absolutive / ergative / dative argument',
    'AbsErgDatPerson': 'person agreement with absolutive / ergative / dative argument',
    'AbsErgDatPolite': 'politeness agreement with absolutive / ergative / dative argument',
    'AdpType': 'adposition type',
    'AdvType': 'adverb type',
    'Animacy': 'animacy',
    'Aspect': 'aspect',
    'Case': 'case',
    'Clusivity': 'clusivity',
    'ConjType': 'conjunction type',
    'Definite': 'definiteness or state',
    'Degree': 'degree of comparison',
    'Echo': 'is this an echo word or a reduplicative?',
    'ErgDatGender': 'gender agreement with ergative / dative argument',
    'Evident': 'evidentiality',
    'Foreign': 'is this a foreign word?',
    'Gender': 'gender',
    'Hyph': 'hyphenated compound or part of it',
    'Mood': 'mood',
    'NameType': 'type of named entity',
    'NounClass': 'noun class',
    'NounType': 'noun type',
    'NumForm': 'numeral form',
    'NumType': 'numeral type',
    'NumValue': 'numeric value',
    'Number': 'number',
    'PartType': 'particle type',
    'Person': 'person',
    'Polarity': 'polarity',
    'Polite': 'politeness',
    'Poss': 'possessive',
    'PossGender': "possessor's gender",
    'PossNumber': "possessor's number",
    'PossPerson': "possessor's person",
    'PossedNumber': "possessed object's number",
    'Prefix': 'Word functions as a prefix in a compund construction',
    'PrepCase': 'case form sensitive to prepositions',
    'PronType': 'pronominal type',
    'PunctSide': 'which side of paired punctuation is this?',
    'PunctType': 'punctuation type',
    'Reflex': 'reflexive',
    'Style': 'style or sublanguage to which this word form belongs',
    'Subcat': 'subcategorization',
    'Tense': 'tense',
    'Typo': 'is this a misspelled word?',
    'VerbForm': 'form of verb or deverbative',
    'VerbType': 'verb type',
    'Voice': 'voice',
}


class KeyvalSelectionFetcher(AbstractValueSelectionFetcher):

    def fetch(self, request):
        # using startswith, because some features can be layered using [], like `Gender[psor]`

        filters = defaultdict(list)
        # sort filter values by category into lists
        for key, value in request.args.items(multi=True):
            if any(key.startswith(ud_key) for ud_key in UD_KEYS):
                filters[key].append(value)

        # we don't want it to be defaultdict anymore so it can raise KeyError
        return dict(filters)

    def is_empty(self, val):
        return len(val) == 0
