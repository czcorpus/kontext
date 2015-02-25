# Copyright (c) 2015 Institute of the Czech National Corpus
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

import urllib


class StateGlobals(object):
    """
    A simple wrapper for $Globals template variable. Unfortunately,
    current code (which comes from Bonito 2) operates with $globals
    (see the difference: g vs. G) which is escaped, hard to update
    string.

    This object should replace $globals in the future because it
    allows easier updates: $Globals.update('corpname', 'bar').to_s()
    """
    def __init__(self, data):
        self._data = {}
        if type(data) is dict:
            data = data.items()
        for k, v in data:
            if type(v) is unicode:
                v = v.encode('utf-8')
            self._data[k] = v

    def __iter__(self):
        return iter(self._data)

    def items(self):
        return self._data.items()

    def to_s(self):
        return urllib.urlencode(self._data)

    def update(self, *args):
        if type(args[0]) is dict:
            self._data.update(args[0])
        elif len(args) == 2:
            self._data[args[0]] = args[1]
        return self
