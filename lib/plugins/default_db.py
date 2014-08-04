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
A simple pickle-based implementation of a persistence mechanism
used by some of 'default_' modules. The plug-in stores only user-related
information (credentials, query history, settings). Each user has
her own pickle-encoded file. Files are accessed by user_id. Becase
of Bonito2-inherited code, it is also necessary to be able to search
by username. The plug-in creates a simple index for this purpose.

Please note that this solution is not suitable for environments with
hundreds or more concurrent users.
"""

import cPickle
import os
import logging

from plugins import PluginException


class DefaultDb(object):

    def __init__(self, conf):
        """
        arguments:
        conf -- a dictionary containing 'settings' module compatible configuration of the plug-in
        """
        self.data_root_path = conf.get('default:data_dir')
        index_path = self._mk_index_path()
        if os.path.exists(index_path):
            self._index = cPickle.load(open(index_path, 'rb'))
        else:
            self._index = None  # username -> id index

    def _mk_data_path(self, user_id):
        return '%s/user-%004d.pkl' % (self.data_root_path, user_id)

    def _mk_index_path(self):
        return '%s/username_idx.pkl' % self.data_root_path

    def _load_data(self, path):
        if os.path.exists(path):
            return cPickle.load(open(path, 'rb'))
        else:
            raise PluginException('User database %s not defined.' % path)

    def _save_data(self, data, path):
        return cPickle.dump(data, open(path, 'wb'))

    def load(self, user_id):
        """
        Loads user data. It should always contain 'user', 'settings' and 'query_history' keys.

        arguments:
        user_id -- a numeric ID of a user

        returns:
        a dictionary containing all user's data as found in his file
        """
        path = self._mk_data_path(user_id)
        return self._load_data(path)

    def save(self, data, user_id):
        """
        Saves user data.

        arguments:
        data -- a dictionary containing actual user's data
        user_id -- a numeric ID of a user
        """
        path = self._mk_data_path(user_id)
        self._save_data(data, path)

    def exists(self, user_id):
        """
        Tests whether user file exists.

        arguments:
        user_id -- a numeric ID of a user

        returns:
        boolean answer
        """
        return os.path.exists(self._mk_data_path(user_id))

    def find_by_username(self, username):
        """
        Searches for user's data by his username. We assume that username is unique.

        arguments:
        username -- log-in username of a user

        returns:
        a dictionary containing user data or None if nothing is found
        """
        if self._index is None or username not in self._index:
            self._index = {}
            for item in self._get_all():
                self._index[item['user']['username']] = item['user']['id']
            cPickle.dump(self._index, open(self._mk_index_path(), 'wb'))

        item_id = self._index[username]
        return self.load(item_id)

    def _get_all(self):
        ans = []
        for item in os.listdir(self.data_root_path):
            abs_path = '%s/%s' % (self.data_root_path, item)
            try:
                data = cPickle.load(open(abs_path, 'rb'))
                ans.append(data)
            except Exception as e:
                logging.getLogger(__name__).warning(e)
        return ans


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return DefaultDb(conf)
