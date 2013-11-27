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


class SettingsStorage(object):

    def __init__(self, conf, db):
        """
        Parameters
        ----------

        conf : the 'settings' module (or some compatible object)
        """
        self.conn = db.get()

    def save(self, user_id, data):
        cursor = self.conn.cursor()
        cursor.execute("REPLACE INTO noske_user_settings SET data = %s, user_id = %s, updated=UNIX_TIMESTAMP()",
                       (json.dumps(data), user_id))
        self.conn.commit()

    def load(self, user_id, current_settings=None):
        """
        Loads user individual settings.

        Parameters
        ----------
        current_settings : dict
          if provided then instead of returning new dictionary method updates this one
          and returns it

        Returns
        -------
        current_settings : dict
          new or updated settings dictionary provided as a parameter
        """
        if current_settings is None:
            current_settings = {}
        cursor = self.conn.cursor()
        cursor.execute('SELECT data FROM noske_user_settings WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        if row:
            current_settings.update(json.loads(row[0]))
        return current_settings


def create_instance(conf, db):
    return SettingsStorage(conf, db)