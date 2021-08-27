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

from xml.sax.saxutils import escape


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
