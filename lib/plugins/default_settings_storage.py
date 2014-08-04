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

"""
A simple settings storage which relies on default_db plug-in.
"""


class SettingsStorage(object):

    def __init__(self, db):
        """
        arguments:
        conf -- the 'settings' module (or a compatible object)
        db -- the default_db plug-in
        """
        self.db = db

    def save(self, user_id, data):
        """
        saves user settings

        arguments:
        user_id -- a numeric ID of a user
        data -- a dictionary containing user data
        """
        user_data = self.db.load(user_id)
        user_data['settings'] = data
        self.db.save(user_data, user_id)

    def load(self, user_id, current_settings=None):
        """
        Loads user individual settings.

        arguments:
        current_settings -- if provided then instead of returning new dictionary method updates
        this one and returns it

        returns:
        new or updated settings dictionary provided as a parameter
        """
        user_data = self.db.load(user_id)
        data = user_data['settings']

        if current_settings is not None:
            current_settings.update(data)
            return current_settings
        else:
            return data


def create_instance(conf, db):
    return SettingsStorage(db)