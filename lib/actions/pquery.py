# Copyright(c) 2021 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

from controller import exposed
from controller.kontext import Kontext

"""
This module contains HTTP actions for the "Paradigmatic query" functionality
"""


class ParadigmaticQuery(Kontext):

    def get_mapping_url_prefix(self):
        return '/pquery/'

    @exposed(template='pquery/index.html', http_method='GET', page_model='pquery')
    def index(self, request):
        return {
            'view': 'form',
            'corpname': self.args.corpname
        }

    @exposed(http_method='POST', page_model='pquery', return_type='json')
    def submit(self, request):
        self._status = 201
        return {}

    @exposed(template='pquery/index.html', http_method='GET', page_model='pquery')
    def result(self, request):
        return {
            'view': 'result',
            'corpname': self.args.corpname
        }
