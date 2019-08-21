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
import collections
import pickle

from plugins.abstract.taghelper import AbstractTagsetInfoLoader


class KeyvalTagVariantLoader(AbstractTagsetInfoLoader):

    def __init__(self, corpus_name, tagset_name, tags_src_dir):
        self.corpus_name = corpus_name
        self.tagset_name = tagset_name
        self.variants_file_path = os.path.join(tags_src_dir, corpus_name)
        self.initial_values = None if self.is_enabled() else []

    def _initialize_tags(self):
        with open(self.variants_file_path, 'r') as f:
            self.initial_values = pickle.load(f)

    def get_variant(self, user_selection, lang):
        if self.initial_values is None:
            self._initialize_tags()
        return self.get_possible_values(user_selection)

    def get_initial_values(self, lang):
        if self.initial_values is None:
            self._initialize_tags()
        return self.get_possible_values()

    def is_enabled(self):
        return os.path.exists(self.variants_file_path)

    def get_possible_values(self, user_values=None):
        ''' Filter possible feature values from initial_values according to user selection'''

        variations = self.initial_values
        if user_values is not None:
            filters = collections.defaultdict(list)
            # sort filter values by category
            for key, value in user_values:
                filters[key].append(value)
            # filter OR logic for values of the same category, AND logic across categories
            variations = list(
                filter(
                    # all filter keys present for any of its value
                    lambda x: all(any((key, value) in x for value in values) for key, values in filters.items()),
                    variations
                )
            )

        possible_values = collections.defaultdict(set)
        for variation in variations:
            for key, value in variation:
                possible_values[key].add(value)
        return {'keyval_tags': {k: list(v) for k, v in possible_values.items()}}
