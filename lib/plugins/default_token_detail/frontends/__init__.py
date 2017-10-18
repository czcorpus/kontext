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
This module contains supported frontends for default_token_detail.
Please note that each of the frontends is paired with a concrete React component
on the client-side (see plugins/defaultTokenDetail/init.py method selectRenderer()).
"""

from plugins.abstract.token_detail import AbstractFrontend


class RawHtmlFrontend(AbstractFrontend):

    def __init__(self, conf):
        super(RawHtmlFrontend, self).__init__(conf)

    def export_data(self, data, status, lang):
        response = super(RawHtmlFrontend, self).export_data(data, status, lang)
        response.renderer = 'raw-html'
        response.contents = [('__html', data)]
        return response
