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

"""
A simple settings storage which relies on default_db plug-in.
"""

import plugins
from plugins.abstract.settings_storage import AbstractSettingsStorage
from plugins import inject


class SettingsStorage(AbstractSettingsStorage):

    def __init__(self, db, excluded_users):
        """
        arguments:
        conf -- the 'settings' module (or a compatible object)
        db -- the default_db plug-in
        excluded_users -- a list of user IDs to be excluded from storing settings
        """
        self.db = db
        self._excluded_users = excluded_users

    def _mk_key(self, user_id):
        return 'settings:user:%d' % user_id

    def save(self, user_id, data):
        """
        saves user settings

        arguments:
        user_id -- a numeric ID of a user
        data -- a dictionary containing user data
        """
        self.db.set(self._mk_key(user_id), data)

    def load(self, user_id, current_settings=None):
        """
        Loads user individual settings.

        arguments:
        current_settings -- if provided then instead of returning new dictionary method updates
        this one and returns it

        returns:
        new or updated settings dictionary provided as a parameter
        """
        data = self.db.get(self._mk_key(user_id))
        if data is None:
            data = {}
        if current_settings is not None:
            current_settings.update(data)
            return current_settings
        else:
            return data

    def get_excluded_users(self):
        return self._excluded_users


@inject(plugins.runtime.DB)
def create_instance(conf, db):
    conf = conf.get('plugins', 'settings_storage')
    excluded_users = conf.get('default:excluded_users', None)
    if excluded_users is None:
        excluded_users = []
    else:
        excluded_users = [int(x) for x in excluded_users]
    return SettingsStorage(db, excluded_users=excluded_users)
