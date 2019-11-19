# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
This module contains supported frontends for default_token_connect.
Please note that each of the frontends is paired with a concrete React component
on the client-side (see plugins/defaultTokenConnect/init.py method selectRenderer()).
"""

import json
from plugins.abstract.token_connect import AbstractFrontend


class ErrorFrontend(AbstractFrontend):

    def __init__(self, conf):
        super(ErrorFrontend, self).__init__(conf)

    def export_data(self, data, status, lang, is_kwic_view):
        response = super(ErrorFrontend, self).export_data(data, status, lang, is_kwic_view)
        response.renderer = 'error'
        response.contents = data
        return response


class RawHtmlFrontend(AbstractFrontend):

    def __init__(self, conf):
        super(RawHtmlFrontend, self).__init__(conf)

    def export_data(self, data, status, lang, is_kwic_view):
        response = super(RawHtmlFrontend, self).export_data(data, status, lang, is_kwic_view)
        response.renderer = 'raw-html'
        response.contents = [('__html', data)]
        return response


class DatamuseFrontend(AbstractFrontend):

    def __init__(self, conf):
        super(DatamuseFrontend, self).__init__(conf)

    def export_data(self, data, status, lang, is_kwic_view):
        response = super(DatamuseFrontend, self).export_data(data, status, lang, is_kwic_view)
        response.renderer = 'datamuse-json'
        try:
            response.contents = json.loads(data)
        except ValueError:
            response.contents = []
        return response


class TreqFrontend(AbstractFrontend):

    def __init__(self, conf):
        super(TreqFrontend, self).__init__(conf)

    def export_data(self, data, status, lang, is_kwic_view):
        response = super(TreqFrontend, self).export_data(data, status, lang, is_kwic_view)
        response.renderer = 'treq-json'
        response.contents = json.loads(data)
        return response
