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
This module acts as a WSGI-compatible wrapper around gettext.

The module must be initialized first by calling the load_translations()
function. It is sufficient to do this just once (when KonText service
starts).

Each request must call the activate() function to ensure that
the client has a proper language set.

To use common underscore function just make the following:

from translation import ugettext as _
"""

# TODO integrate with babel, sanic_babael

def load_translations():
    pass

def ugettext(s):
    """
    Translates a string according to the current (thread local) translation
    """
    return s
