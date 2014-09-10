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

import shutil

from translation import ugettext as _


def add_subcorpus(**kwargs):
    ans = {}
    for files in kwargs['files']:
        shutil.copy(files['src'] % kwargs, files['dst'] % kwargs)

    if not 'message' in kwargs:
        ans['message'] = _('A new sub-corpus has been added to your library')
    else:
        ans['message'] = kwargs['message']
    return ans


def show_message(**kwargs):
    return {
        'message': kwargs['message']
    }