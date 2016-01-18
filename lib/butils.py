# Copyright (c) 2003-2013  Pavel Rychly, Milos Jakubicek, Jan Busta
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

import re


class CQLDetectWithin(object):
    """
    """
    def split_by_parentheses(self, s):
        if s is None:
            return [None]
        return [v1 for v2 in [re.split(r'(\])', x) for x in re.split(r'(\[)', s)] for v1 in v2]

    def parse_lex_elems(self, s):
        i = 0
        ans = []
        curr_piece = ''
        state = 0   # 1 = opened ", 2 = opened '
        while i < len(s):
            if s[i] == '\\':
                curr_piece += s[i+1]
                i += 2
                continue
            if s[i] == '"':
                if state == 0:
                    ans.extend(re.split(r'\s+', curr_piece))
                    curr_piece = ''
                    state = 1
                elif state == 1:
                    ans.append(None)  # use None instead of quoted text
                    curr_piece = ''
                    state = 0
                else:
                    raise Exception('syntax error')
            else:
                curr_piece += s[i]
            i += 1
        if len(curr_piece) > 0:
            ans.extend(re.split(r'\s+', curr_piece))
        return ans

    def empty_tag_next(self, struct, start_pos):
        return start_pos < len(struct) - 1 and re.match(r'\s*/>', struct[start_pos])

    def contains_within(self, s):
        struct = self.parse(s)
        last_p = None

        for i in range(len(struct)):
            item = struct[i]
            if item is None:
                continue
            if item in (']', '['):
                last_p = item
            elif 'within' in item:
                if i + 1 < len(struct) - 1 and re.match(r'\w+:',  struct[i + 1]):
                    return False
                elif i + 1 < len(struct) - 1 and re.match(r'<.+', struct[i + 1]):
                    return not self.empty_tag_next(struct, i + 2)
                elif last_p in (']', None):
                    return True
        return False

    def parse(self, s):
        result = []
        ans = self.parse_lex_elems(s)
        for item in ans:
            x = self.split_by_parentheses(item)
            result.extend(x)
        result = [x for x in result if x != '']
        return result


def get_stack(num_skip=1):
    """
    Returns a list of all function calls leading up to this one.

    arguments:
    num_skip -- number of items to be skipped (default = 1 which is the most recent one, i.e. the get_stack call itself)
    """
    import inspect
    import os
    c = []
    for item in inspect.stack()[num_skip:]:
        c.append('%s(%s): %s()' % (os.path.realpath(item[1]), item[2], item[3]))
    return c


def log_stack(level='debug'):
    """
    Works in the similar way as get_stack() but the result is logged instead.

    arguments:
    level -- logging level to be used (default is 'debug')
    """
    import threading
    import logging
    fn = getattr(logging.getLogger('STACK'), level)
    stack = '\n'.join([''] + ['    %s' % s for s in get_stack(num_skip=2)])
    apply(fn, ('(thread %s) --> %s' % (threading.current_thread().ident, stack),))
