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
from xml.sax.saxutils import escape


class DummyGlobals(object):

    def export(self):
        return []


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
        return list(self._data.items())

    def export(self):
        ans = {}
        for k, v in self._data.items():
            if len(v) == 0:
                continue
            elif len(v) == 1:
                ans[k] = v[0]
            else:
                ans[k] = v[:]
        return ans

    def _copy_data(self):
        return [(k, v[:]) for k, v in list(self._data.items())]

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
            for k, v in list(args[0].items()):
                new_data[k].append(v)
        elif len(args) == 2:
            new_data[args[0]].append(args[1])
        return StateGlobals(data=new_data)

    def set(self, k, v):
        if type(v) is list:
            self._data[k] = v
        elif type(v) is tuple:
            self._data[k] = list(v)
        else:
            self._data[k] = [v]


class Type2XML(object):

    @staticmethod
    def _list_to_xml(d, indent):
        out = []
        for item in d:
            out.append(('<item>', indent))
            out += Type2XML._item_to_xml(item, indent + 1)
            out.append(('</item>', indent))
        return out

    @staticmethod
    def _dict_to_xml(d, indent):
        out = []
        for k, v in list(d.items()):
            out.append(('<{0}>'.format(k), indent))
            out += Type2XML._item_to_xml(v, indent + 1)
            out.append(('</{0}>'.format(k), indent))
        return out

    @staticmethod
    def _item_to_xml(d, indent):
        out = []
        if type(d) is dict:
            out += Type2XML._dict_to_xml(d, indent + 1)
        elif type(d) is list or type(d) is tuple:
            out += Type2XML._list_to_xml(d, indent + 1)
        else:
            out.append((escape('{0}'.format(d if d is not None else '')), indent - 1))
        return out

    @staticmethod
    def to_xml(d):
        out = [('<kontext>', 0)]
        out += Type2XML._item_to_xml(d, 0)
        out.append(('</kontext>', 0))
        buff = []
        prev_ind = 0
        for item in out:
            if item[1] == prev_ind and (item[0].startswith('</') or not item[0].startswith('<')):
                buff.append('')
            else:
                buff.append('\n' + ('  ' * item[1]))
            buff.append(item[0])
            prev_ind = item[1]
        return ''.join(buff)
