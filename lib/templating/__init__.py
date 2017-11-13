# Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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


from collections import defaultdict
import codecs
codecs.register_error('replacedot', lambda err: (u'.', err.end))


class StateGlobals(object):
    """
    A simple wrapper for $Globals template variable.
    StateGlobals is internally a multi-value dictionary
    to support URL multi-value args correctly.
    """

    def __init__(self, data):
        self._data = defaultdict(lambda: [])
        if isinstance(data, defaultdict):
            self._data = data
        elif type(data) is dict:
            self._data.update(data)
        else:
            for item in data:
                self._data[item[0]].append(item[1])

    def __iter__(self):
        return iter(self._data)

    def items(self):
        return self._data.items()

    def export(self):
        ans = []
        for k, v in self._data.items():
            for item in v:
                ans.append((k, item))
        return ans

    def _copy_data(self):
        return [(k, v[:]) for k, v in self._data.items()]

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
        new_data = defaultdict(lambda: [])
        for k, v in self._copy_data():
            new_data[k] = v
        if type(args[0]) is dict:
            for k, v in args[0].items():
                new_data[k].append(v)
        elif len(args) == 2:
            new_data[args[0]].append(args[1])
        return StateGlobals(data=new_data)

    def set(self, k, v):
        if hasattr(v, '__iter__'):
            self._data[k] = v
        else:
            self._data[k] = [v]


class CheetahResponseFile(object):
    """
    Provides utf-8 compatible output for Cheetah renderer
    """

    def __init__(self, outfile):
        self._outfile = codecs.getwriter('utf-8')(outfile)

    def response(self):
        return self._outfile
