# Copyright (c) 2014 Institute of the Czech National Corpus
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
"""
A set of helper functions for parsing a vertical corpus file
"""
import re

ENCODING = 'utf-8'


def parse_word(s):
    """
    Parses "word lemma tag ..." line and extracts the word
    """
    return re.split(r'\s+', s)[0]


def parse_tag(s):
    """
    Parses SGML tag's attributes.

    arguments:
    s -- tag string representation

    returns:
    a dictionary attribute_name => attribute_value
    """
    return dict([(x, y.decode(ENCODING)) for x, y in re.findall(r'(\w+)="([^"]+)"', s)])


def get_tag_name(s):
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


def is_start_tag(s):
    """
    Tests whether the provided tag string corresponds to a start tag <....>

    arguments:
    s -- tag string
    """
    return s.startswith('<') and not s.startswith('</') and s.endswith('>')


def is_end_tag(s):
    """
    Tests whether the provided tag string corresponds to an end tag <..../>

    arguments:
    s -- tag string
    """
    return s.startswith('</') and s.endswith('>')


def parse_line(s):
    """
    Parses a line from a corpus vertical file

    arguments:
    s -- a string representing line content

    returns:
    2-tuple (tag_name, attr_dict)
    """
    s = s.strip()
    attrs = None

    if is_start_tag(s):
        name = get_tag_name(s)
        start = True
        attrs = parse_tag(s)
    elif is_end_tag(s):
        name = get_tag_name(s)
        start = False
    else:
        name = '#TEXT'
        start = None

    return name, start, attrs