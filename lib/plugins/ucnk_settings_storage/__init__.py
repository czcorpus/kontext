# Copyright (c) 2013 Institute of the Czech National Corpus
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

import json

from plugins.abstract.settings_storage import AbstractSettingsStorage
import plugins
from plugins import inject


TABLE_NAME = 'noske_user_settings'


class SettingsStorage(AbstractSettingsStorage):

    def __init__(self, conf, db_provider):
        """
        arguments:
        conf -- the 'settings' module (or some compatible object)
        """
        self.db_provider = db_provider

    def save(self, user_id, data):
        """
        Save user settings

        arguments:
        user_id -- user identifier
        data -- a dictionary containing user settings
        """
        db = self.db_provider()
        db.execute("REPLACE INTO %s SET data = %%s, user_id = %%s, updated=UNIX_TIMESTAMP()" % TABLE_NAME,
                   (json.dumps(data), user_id))
        db.close()

    def load(self, user_id, current_settings=None):
        """
        Loads user individual settings.

        arguments:
        current_settings -- if provided then instead of returning new dictionary method updates this one
                            and returns it

        returns:
        new or updated settings dictionary provided as a parameter
        """
        if current_settings is None:
            current_settings = {}
        db = self.db_provider()
        row = db.execute('SELECT data FROM %s WHERE user_id = %%s' % TABLE_NAME, (user_id,)).fetchone()
        if row:
            current_settings.update(json.loads(row[0]))
        db.close()
        return current_settings


@inject(plugins.runtime.DB)
def create_instance(conf, db):
    return SettingsStorage(conf, db)
