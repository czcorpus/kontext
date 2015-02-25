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

"""
All the custom sessions must inherit from werkzeug.contrib.sessions.Session
and inherit or implement the interface of this class.
"""


class AbstractSessions(object):

    def get_cookie_name(self):
        """
        Returns name of a cookie used to store session ID
        """
        raise NotImplementedError()
