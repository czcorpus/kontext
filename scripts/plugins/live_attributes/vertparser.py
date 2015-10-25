# Copyright 2014 Institute of the Czech National Corpus
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""
A set of helper functions for parsing a vertical corpus file
"""
import re
from collections import defaultdict


class Parser(object):

    def __init__(self, encoding='utf-8'):
        self.encoding = encoding

    def parse_word(self, s):
        """
        Parses "word lemma tag ..." line and extracts the word
        """
        return re.split(r'\s+', s)[0]

    def parse_tag(self, s):
        """
        Parses SGML tag's attributes.

        arguments:
        s -- tag string representation

        returns:
        a dictionary attribute_name => attribute_value
        """
        return dict([(x, y.decode(self.encoding)) for x, y in re.findall(r'(\w+)="([^"]+)"', s)])

    def get_tag_name(self, s):
        """
        Parses tag name from tag string

        arguments:
        s -- tag string

        returns:
        tag name or None if nothing is found
        """
        ans = re.match(r'</?([\w]+)', s)
        if ans:
            return ans.groups()[0]
        return None

    def is_start_tag(self, s):
        """
        Tests whether the provided tag string corresponds to a start tag <....>

        arguments:
        s -- tag string
        """
        return s.startswith('<') and not s.startswith('</') and s.endswith('>')

    def is_end_tag(self, s):
        """
        Tests whether the provided tag string corresponds to an end tag <..../>

        arguments:
        s -- tag string
        """
        return s.startswith('</') and s.endswith('>')

    def parse_line(self, s):
        """
        Parses a line from a corpus vertical file

        arguments:
        s -- a string representing line content

        returns:
        2-tuple (tag_name, attr_dict)
        """
        s = s.strip()
        attrs = None

        if self.is_start_tag(s):
            name = self.get_tag_name(s)
            start = True
            attrs = self.parse_tag(s)
        elif self.is_end_tag(s):
            name = self.get_tag_name(s)
            start = False
        else:
            name = '#TEXT'
            start = None

        return name, start, attrs


class ValLengthCalculator(object):

    def __init__(self, conf):
        self._attr_lengths = defaultdict(lambda: 0)
        if 'calcAvgLen' in conf:
            self._measured_attrs = conf['calcAvgLen'] if hasattr(conf['calcAvgLen'], '__iter__') \
                else [conf['calcAvgLen']]
        else:
            self._measured_attrs = []
        self._measured_attrs = map(lambda x: x.replace('.', '_', 1), self._measured_attrs)

    def insert(self, item):
        for a in self._measured_attrs:
            self._attr_lengths[a] += len(item.get(a, ''))

    def finish(self, total_length):
        for k in self._attr_lengths.keys():
            self._attr_lengths[k] /= float(total_length)

    def format_result(self):
        ans = 'Attributes average lengths:\n'
        ans += '\n  '.join('%s: %s' % (k, round(v, 1)) for k, v in self._attr_lengths.items())
        ans += '\n'
        return ans
