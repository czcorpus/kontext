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
All the custom settings_storage plug-ins should inherit from AbstractSettingsStorage
"""


class AbstractSettingsStorage(object):

    def save(self, user_id, data):
        """
        Save user settings

        arguments:
        user_id -- user identifier
        data -- a dictionary containing user settings
        """
        raise NotImplementedError()

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
        raise NotImplementedError()