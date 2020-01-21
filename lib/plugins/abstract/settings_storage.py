# Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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
The 'settings storage' plug-in works as a backend for storing and
loading user settings.
"""

import abc


class AbstractSettingsStorage(abc.ABC):

    @abc.abstractmethod
    def save(self, user_id, data):
        """
        Save user settings. Old user settings are expected to be rewritten.

        arguments:
        user_id -- user identifier
        data -- a dictionary containing user settings
        """

    @abc.abstractmethod
    def load(self, user_id, current_settings=None):
        """
        Loads user individual settings.

        arguments:
        user_id -- an ID of the user
        current_settings -- dict-like object (JSON serializable); if provided then instead
                            of returning new dictionary the method updates this one by loaded
                            values and returns the same reference

        returns:
        new or updated settings dictionary provided as a parameter
        """

    def get_excluded_users(self):
        """
        Returns a list of IDs of users whose settings should not be stored (e.g. anonymous user).
        """
        return []
