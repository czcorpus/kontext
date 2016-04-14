# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
"""
This module implements a very simple parser for Manatee registry
files which detects defined structure names and their respective
attribute names. Other metadata are ignored.
"""

import re


def parse_simple_values(path):
    """
    Parses expressions conforming to the form
    KEY_NAME  "value name"
    KEY_NAME value_name
    """
    ans = {}
    with open(path, 'rb') as fin:
        for line in fin:
            if 'ATTRIBUTE' in line or 'STRUCTURE' in line:
                break
            m = re.match(r'(#\s*)?([A-Z]+)\s+"?(.+?)"?$', line)
            if m and not m.group(1):
                ans[m.group(2)] = m.group(3)
    return ans


class Attribute(object):
    def __init__(self):
        self.name = None

    def __repr__(self):
        return 'ATTRIBUTE %s {...}' % (self.name,)


class Structure(object):
    def __init__(self):
        self.name = None
        self.attributes = []

    def __repr__(self):
        return 'STRUCTURE %s { %s }' % (self.name, ', '.join(a.name for a in self.attributes))


class RegistryParser(object):

    def __init__(self):
        self._stack = []
        self._last_object = None
        self._last_token = None
        self._structures = []

    def _parse_line(self, s):
        tokens = self._tokenize(s.strip())
        for token in tokens:
            if token == 'STRUCTURE':
                self._last_object = Structure()
            elif token == 'ATTRIBUTE':
                self._last_object = Attribute()
            elif token == '{':
                self._stack.append(self._last_object)
            elif token in ('}', '@'):
                if token == '}':
                    p = self._stack.pop()
                else:
                    p = self._last_object
                if isinstance(p, Attribute) and len(self._stack) > 0 and isinstance(self._stack[-1], Structure):
                    self._stack[-1].attributes.append(p)
                self._last_object = None
                if isinstance(p, Structure):
                    self._structures.append(p)
            elif self._last_object is not None:
                self._last_object.name = token

    @staticmethod
    def _tokenize(s):
        return re.split(r'\s+', s) + ['@']

    def _parse_file(self, f):
        self._stack = []
        self._structures = []
        for line in f:
            self._parse_line(line)
        return self._structures

    def parse(self, reg_file):
        if type(reg_file) is file:
            return self._parse_file(reg_file)
        else:
            with open(reg_file, 'rb') as f:
                return self._parse_file(f)

