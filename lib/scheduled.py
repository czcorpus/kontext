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
A library containing functions and callable objects representing miscellaneous
tasks administrator can schedule. Each task requires specific JSON format.
"""


import shutil
import os
import re


class add_subcorpus(object):
    """
    A callable object representing a task of adding one or more subcorpora.
    Required JSON task specification:

    {
      "action": "add_subcorpus",
      "recipients": [...],
      "files": [
        {
          "src": "/path/to/a/source/subcorpus",
          "dst": "/destination/directory/or/file",
          "corpusName": "a name of the corpus"
        },
        {
          "src": "/another/src/...",
          "dst": "/another/dst/...",
          "corpusName": "a name of the another corpus"
        },
        ...
      ]
    }

    Notes: recipients: null means 'create the task for all the users'

    """

    @staticmethod
    def target_file_exists(src_path, dst_path):
        if os.path.isdir(dst_path):
            dst_path = '%s/%s' % (dst_path, os.path.basename(src_path))
        return os.path.isfile(dst_path)

    @staticmethod
    def extract_subcname(path):
        name = os.path.basename(path)
        srch = re.search(r'(.+)\.subc$', name)
        if srch:
            name = srch.groups()[0]
        return name

    @staticmethod
    def mk_alt_path(src_path, dst_path):
        if os.path.isdir(dst_path):
            dst_path = '%s/%s' % (dst_path, os.path.basename(src_path))
        srch = re.search(r'^(.+?)(_([\d]+))?\.subc$', dst_path)
        if srch:
            prefix = srch.groups()[0]
            num = srch.groups()[2]
            if num is None:
                num = 2
            else:
                num = int(num) + 1
            return '%s_%d.subc' % (prefix, num)
        return None

    def __call__(self, **kwargs):
        ans = {}
        subcorpora = []
        for files in kwargs['files']:
            src_path = files['src'] % kwargs
            dst_path = files['dst'] % kwargs
            corpname = files['corpusName']
            while self.target_file_exists(src_path, dst_path):
                dst_path = self.mk_alt_path(src_path, dst_path)
            subcorpora.append('%s:%s' % (corpname, self.extract_subcname(dst_path)))
            shutil.copy(src_path, dst_path)

        if not 'message' in kwargs:
            ans['message'] = kwargs['translate'](
                'new subcorpora in your library: %s') % ', '.join(subcorpora)
        else:
            ans['message'] = kwargs['message']
        return ans


def show_message(**kwargs):
    """
    A function representing a task of sending a message to a user.

    Required JSON task specification:

    {
      "action": "show_message",
      "recipients": [...],
      "message": "Hi %(username)s, this is a message for you!"
    }
    """
    return {
        'message': kwargs['message']
    }
