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

import abc


class AbstractGetLang(abc.ABC):
    """
    This plug-in customizes a way how KonText finds out what language user
    wants for the user interface. E.g. data from cookies/session/local storage can
    be used for this but it is up to this plug-in how to process it.
    """

    @abc.abstractmethod
    def fetch_current_language(self, cookies):
        """
        Return a currently selected language

        arguments:
        cookies -- any Cookie.BaseCookie compatible implementation

        returns:
        underscore-separated ISO 639 language code and ISO 3166 country code
        of the detected language or None in case no value was found
        """

    def allow_default_lang_switch_ui(self) -> bool:
        """
        In case a different way of language switching is expected
        to be used (e.g. via a footer/header UI), the default links
        rendered as part of the footer can be disabled by overriding
        this method.

        Please note that in case a non-default footer_bar plug-in is
        used, the method has no effect as the whole footer content
        is replaced by the one provided by the footer_bar plug-in.
        """
        return True
