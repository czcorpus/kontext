# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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


from plugins.abstract.kwic_connect import AbstractKwicConnect
import plugins
from actions import concordance
from controller import exposed


@exposed(return_type='json')
def fetch_external_kwic_info(self, request):
    items = request.args.getlist('w')
    return {'data': {'words': [(item, item + '-xx') for item in items], 'note': 'testing stuff'}}  # TODO


class DefaultKwicConnect(AbstractKwicConnect):

    def __init__(self, corparch):
        self._corparch = corparch

    def is_enabled_for(self, plugin_api, corpname):
        corpus_info = self._corparch.get_corpus_info(plugin_api.user_lang, corpname)
        return len(corpus_info.token_detail.providers) > 0

    def export_actions(self):
        return {concordance.Actions: [fetch_external_kwic_info]}


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    return DefaultKwicConnect(corparch)
