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
from typing import Union, Dict, Any, Optional
import abc


class AbstractSettingsStorage(abc.ABC):

    @abc.abstractmethod
    def save(self, user_id: int, corpus_id: Union[str, None], data: Dict[str, Any]):
        """
        Save either general (if corpus_id is None) or corpus specific settings.
        Old user settings are expected to be rewritten.

        arguments:
        user_id -- user identifier
        corpus_id -- if provided then the 'data' are treated as corpus settings
        data -- a dictionary containing user settings
        """

    def load(self, user_id: int, corpus_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Load either general (if corpus_id is None) or corpus-specific settings

        arguments:
        user_id -- an ID of the user
        corpus_id -- if provided than corpus-related settings are loaded

        returns:
        a dict containing user settings
        """

    def get_excluded_users(self):
        """
        Returns a list of IDs of users whose settings should not be stored (e.g. anonymous user).
        """
        return []
