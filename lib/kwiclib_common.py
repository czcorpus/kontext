# Copyright (c) 2003-2009  Pavel Rychly
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


def tokens2strclass(tokens):
    """
    Converts internal data structure produced by KwicLine and CorpRegion containing tokens and
    respective HTML classes into a more suitable form.

    arguments:
    tokens -- a tuple of the following format: ('a token', '{class1 class2}', 'another token', '{class3}',...)

    returns:
    a list of dicts {'str': '[token]', 'class': '[classes]'}
    """
    return [{'str': tokens[i], 'class': tokens[i + 1].strip('{}')}
            for i in range(0, len(tokens), 2)]
