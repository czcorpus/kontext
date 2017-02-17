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
import manatee


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
    fn(*('(thread %s) --> %s' % (threading.current_thread().ident, stack),))


def manatee_min_version(ver):
    """
    Tests whether the provided version string represents a newer or
    equal version than the one currently configured.

    arguments:
    ver -- a version signature string 'X.Y.Z' (e.g. '2.130.7')
    """
    ver = int(''.join(map(lambda x: '%03d' % int(x), ver.split('.'))))
    actual = int(''.join(map(lambda x: '%03d' % int(x), manatee.version().split('-')[-1].split('.'))))
    return ver <= actual
