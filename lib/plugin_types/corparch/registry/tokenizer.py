# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import re
import io


class Token(object):
    """
    Token represents a lexical element of a parsed registry file
    """

    def __init__(self, type, value=None):
        self._type = type
        self._value = value


class Tokenizer(object):

    def __init__(self, infile: io.StringIO):
        self._fr = infile

    def __call__(self):
        ans = []
        for line in self._fr:
            items = re.split(r'\s+', line)
            line_ans = []
            is_q = False
            for item in items:
                if item == '':
                    continue
                if item[0] == '"' and item[-1] == '"' and len(item) > 1:
                    line_ans.append(item[1:-1])
                elif item[0] == '"' and not is_q:
                    line_ans.append([])
                    is_q = True
                    v = item[1:]
                    line_ans[-1].append(v)
                elif item[-1] == '"':
                    is_q = False
                    v = item[:-1]
                    if type(line_ans[-1]) is list and line_ans[-1][0] == '"' and v == '"':
                        line_ans[-1].append(' ')
                    else:
                        line_ans[-1].append(v)
                else:
                    if is_q:
                        line_ans[-1].append(item)
                    else:
                        line_ans.append(item)
            tmp = [' '.join(v) if type(v) is list else v for v in line_ans] + ['$']
            if len(tmp) > 0:
                ans.append(tmp)
        return [v for subl in ans for v in subl]
