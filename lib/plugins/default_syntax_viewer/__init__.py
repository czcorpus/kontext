# Copyright (c) 2016 Institute of the Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import plugins
from plugins.abstract.syntax_viewer import SyntaxViewerPlugin
from actions import concordance
from controller import exposed
from backend import ElasticSearchBackend


@exposed(return_type='json')
def get_syntax_data(ctrl, request):
    data = plugins.get('syntax_viewer').search_by_kwic_id(ctrl._corp(), request.args.get('kwic_id'))
    return data


class SyntaxDataProvider(SyntaxViewerPlugin):

    def __init__(self, backend):
        self._backend = backend

    def search_by_kwic_id(self, corp, kwic_id):
        attr = corp.get_attr('s.id')  # TODO s.id <= configurable
        sent_id = attr.pos2str(int(kwic_id))
        import logging
        logging.getLogger(__name__).debug('sentence id: %s' % (sent_id,))
        return self._backend.get_data(sent_id)

    def export_actions(self):
        return {concordance.Actions: [get_syntax_data]}


@plugins.inject()
def create_instance(conf):
    return SyntaxDataProvider(ElasticSearchBackend())
