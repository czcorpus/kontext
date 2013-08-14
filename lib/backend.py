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
This module acts as an interface to all non-manatee services.
Initially, it sets all services to fallback mode (i.e. they
respond but do nothing and log a warning (unless explicitly
disabled)).
"""

import logging


class DummyService():

    def __init__(self, varname, warn=True):
        self.varname = varname
        self.warn = warn

    def __repr__(self):
        return "[DummyService for %s]" % self.varname

    def __getattr__(self, *args, **kwargs):
        def fallback(*args, **kwargs):
            print(type(self))
            if self.warn:
                logging.getLogger(__name__).warn('Using uninitialized service for [%s] module' % self.varname)
        return fallback


auth = DummyService(varname='auth')

query_storage = DummyService(varname='query_storage')

application_bar = DummyService(varname='application_bar')