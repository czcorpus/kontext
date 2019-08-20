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

from plugins.abstract.taghelper import AbstractTagsetInfoLoader
import collections
import json



class KeyvalTagVariantLoader(AbstractTagsetInfoLoader):

    def __init__(self):
        self.variations = self.load_variations('/opt/working/parser/vertikala_pdt')

    def get_variant(self, user_selection, lang):
        """
        """
        return {'keyval_tags': self.get_possible_values(user_selection)}  # TODO

    def get_initial_values(self, lang):
        return {'keyval_tags': self.get_possible_values([])}  # TODO

    def is_enabled(self):
        return True  # TODO

    def parse_word_line(self, line):
        ''' parses word line to get POS and features '''

        line_parts = line.split('\t', 5)
        pos, feature = line_parts[3: 5]
        data = [
            tuple(k_v.split('='))
            for k_v in feature.split('|')
            if k_v != '_'  # `_` denotes absence according to Universal Dependencies
        ]
        data.append(('POS', pos))

        # check multiple keys of the same kind
        if len([x[0] for x in data]) > len(set(x[0] for x in data)):
            print 'multiple keys in {}'.format(data)

        # return tuple of tuples (key, value) sorted by key
        return tuple(sorted(data, key=lambda x: x[0]))

    def get_possible_values(self, user_values):
        ''' get possible feature values from variations '''

        variations = self.variations
        filters = collections.defaultdict(list)
        # sort filter values by category
        for param, value in user_values:
            filters[param].append(value)
        # filter OR logic for values of the same category, AND logic accross categories
        for param, values in filters.items():
            variations = list(filter(lambda x: any((param, value) in x for value in values), variations))

        possible_values = collections.defaultdict(set)
        for variation in variations:
            for k, v in variation:
                possible_values[k].add(v)
        return {k: list(v) for k, v in possible_values.items()}

    def load_variations(self, src_path):
        # prepare all variations from vertical data
        variations = set()
        with open(src_path, 'r') as f:
            for line in f:
                if line.strip().startswith('<'):  # skip lines with xml tags
                    continue
                variations.add(self.parse_word_line(line))
        return list(variations)
