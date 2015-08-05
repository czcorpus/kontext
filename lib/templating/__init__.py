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
import json
import copy


class StateGlobals(object):
    """
    A simple wrapper for $Globals template variable. Unfortunately,
    current code (which comes from Bonito2 operates with $globals
    (see the difference: [g]lobals vs. [G]lobals) which is an escaped,
    hard to update string.

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

    def to_json(self):
        return json.dumps(self._data)

    def update(self, *args):
        """
        Creates a new (deep) copy with updated values
        according to passed args.

        arguments:
         - if a single argument is passed then a dict is expected
         - if two arguments are passed then (key, value) is expected

        returns:
        updated copy of the called object
        """
        new_data = copy.deepcopy(self._data)
        if type(args[0]) is dict:
            new_data.update(args[0])
        elif len(args) == 2:
            new_data[args[0]] = args[1]
        StateGlobals(data=new_data)
