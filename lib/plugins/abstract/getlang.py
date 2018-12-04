# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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
All the custom getlang plug-in implementations should inherit from AbstractGetLang
"""


class AbstractGetLang(object):
    """
    This plug-in customizes a way how KonText finds out what language user
    wants for the user interface. E.g. data from cookies/session/local storage can
    be used for this but it is up to this plug-in how to process it.
    """

    def fetch_current_language(self, cookies):
        """
        Return a currently selected language

        arguments:
        cookies -- any Cookie.BaseCookie compatible implementation

        returns:
        underscore-separated ISO 639 language code and ISO 3166 country code
        of the detected language or None in case no value was found
        """
        raise NotImplementedError()
