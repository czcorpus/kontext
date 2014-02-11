# Copyright (c) 2014  Institute of the Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.


def import_string(s, from_encoding):
    """
    Imports a string from Manatee to KonText
    """
    if type(s) is str:
        if from_encoding.lower() in ('utf-8', ''):
            return s.decode('utf-8')
        else:
            return s.decode(from_encoding)
    elif type(s) is unicode:
        return s
    else:
        return None  # TODO raise an exception


def export_string(s, from_encoding):
    """
    Exports a string from KonText to Manatee
    """
    if type(s) is unicode:
        return s.encode(from_encoding)
    else:
        return s.decode('utf-8').encode(from_encoding)