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

"""
Configuration JSON:
{
  "corpora": {
    "syn2010": {
      "path": "/var/local/corpora/syntax-tree/syn2010.syntax.db",
      "sentenceUniqueAttributes": ["opus.id", "doc.id", "s.id"]
    }
  }
}
"""

import json

import plugins
from plugins.abstract.syntax_viewer import SyntaxViewerPlugin
from actions import concordance
from controller import exposed
from backend import Sqlite3SearchBackend


@exposed(return_type='json')
def get_syntax_data(ctrl, request):
    data = plugins.get('syntax_viewer').search_by_token_id(ctrl._corp(), int(request.args.get('kwic_id')))
    return data


class SyntaxDataProviderError(Exception):
    pass


class SyntaxDataProvider(SyntaxViewerPlugin):

    def __init__(self, corpora_conf, backend):
        self._conf = corpora_conf
        self._backend = backend

    def get_corpus_sent_keys(self, corpname):
        try:
            return self._conf[corpname]['sentenceUniqueAttributes']
        except KeyError:
            raise SyntaxDataProviderError('Corpus %s not found in the configuration' % (corpname,))

    def get_sent_keys_values(self, corp, token_id):
        keys = self.get_corpus_sent_keys(corp.corpname)
        ans = []
        for k in keys:
            attr = corp.get_attr(k)
            ans.append(attr.pos2str(token_id))
        return tuple(ans)

    def search_by_token_id(self, corp, token_id):
        id_keys = self.get_sent_keys_values(corp, token_id)
        return self._backend.get_data(corp.corpname, ':'.join(id_keys))

    def export_actions(self):
        return {concordance.Actions: [get_syntax_data]}


@plugins.inject()
def create_instance(conf):
    """
    """
    conf_path = conf.get('plugins', 'syntax_viewer', {}).get('default:config_path')
    with open(conf_path, 'rb') as f:
        conf_data = json.load(f)
        corpora_conf = conf_data.get('corpora', {})
    return SyntaxDataProvider(corpora_conf, Sqlite3SearchBackend(corpora_conf))
