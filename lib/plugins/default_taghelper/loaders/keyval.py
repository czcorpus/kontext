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

import os
import json
from collections import defaultdict

from plugins.abstract.taghelper import AbstractTagsetInfoLoader


class KeyvalTagVariantLoader(AbstractTagsetInfoLoader):

    def __init__(self, corpus_name, tagset_name, tags_src_dir):
        self.corpus_name = corpus_name
        self.tagset_name = tagset_name
        self.variants_file_path = os.path.join(tags_src_dir, tagset_name, corpus_name)
        self.initial_values = None if self.is_available() else []

    def _initialize_tags(self):
        with open(self.variants_file_path, 'r') as f:
            self.initial_values = json.load(f)
            for item in self.initial_values:
                for i, v in enumerate(item):
                    item[i] = tuple(v)

    def get_variant(self, filter_values, lang):
        if self.initial_values is None:
            self._initialize_tags()

        # possible values with all filters applied
        possible_values = self.get_possible_values(filter_values)
        # resolving possible filter values for applied filter features
        for filter_key in filter_values:
            derived_filter = {k: v for k, v in list(filter_values.items()) if k != filter_key}
            possible_values[filter_key] = self.get_possible_values(derived_filter)[filter_key]

        return {'keyval_tags': possible_values}

    def get_initial_values(self, lang):
        if self.initial_values is None:
            self._initialize_tags()
        return {'keyval_tags': self.get_possible_values()}

    def is_available(self):
        return os.path.exists(self.variants_file_path)

    def get_possible_values(self, filter_values=None):
        """
        Filter possible feature values from initial_values according to user selection
        """

        if filter_values is not None:
            # filter OR logic for values of the same category, AND logic across categories
            variations = list([x for x in self.initial_values if all(
                any(
                    (key, value) in x
                    for value in values
                )
                for key, values in list(filter_values.items())
            )])

            # we can allow only keyval features, that are supported by all possible filter combinations
            # for this we use set intersection
            possible_keyval_indexed = defaultdict(set)
            for variation in variations:
                index = tuple(sorted(x for x in variation if x[0] in filter_values))
                values = set([x for x in variation if x[0] not in filter_values])
                possible_keyval_indexed[index].update(values)
            possible_keyval = set.intersection(*possible_keyval_indexed.values())

            # transformation to dict of lists
            possible_values = defaultdict(list)
            for key, value in possible_keyval:
                possible_values[key].append(value)
        else:
            # transformation of initial values to dict of lists of unique values
            possible_values = defaultdict(set)
            for variation in self.initial_values:
                for key, value in variation:
                    possible_values[key].add(value)

        return {k: list(v) for k, v in list(possible_values.items())}
