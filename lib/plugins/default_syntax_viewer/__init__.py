# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
A plug-in providing syntax tree display. Its client-side part
is based on the 'js-treex-view' library (https://github.com/ufal/js-treex-view).
The tree data are extracted from Manatee where it is expected from
a token to contain an attribute with a relative reference to its parent.
All the properties are configured via an external JSON file.

Required config.xml/plugins entries (RelaxNG compact format):

element syntax_viewer {
    element module { "default_syntax_viewer" }
    element js_module { "defaultSyntaxViewer" }
    element config_path {
        text # a path to JSON config file (see below)
    }
}

Configuration JSON:

{
  "corpora": {
    ... this is backend dependent, see backend modules for details ...
  }
}
"""

import json
import logging
import os
from typing import Dict

import plugins
from plugins.abstract.integration_db import IntegrationDatabase
from plugins.abstract.syntax_viewer import AbstractSyntaxViewerPlugin, MaximumContextExceeded
from actions import concordance
from controller import exposed
from controller.errors import UserActionException
from .manatee_backend import ManateeBackend
from translation import ugettext as _


@exposed(return_type='json')
def get_syntax_data(ctrl, request):
    """
    This is the actual controller method exported by the plug-in.
    To be able to export a JSON with custom encoder this method
    returns a callable which ensures that controller.Controller
    skips its simple JSON serialization.
    """
    try:
        with plugins.runtime.SYNTAX_VIEWER as sv:
            return sv.search_by_token_id(ctrl.corp, ctrl.corp.corpname,
                                         int(request.args.get('kwic_id')),
                                         int(request.args.get('kwic_len')))
    except MaximumContextExceeded:
        raise UserActionException(
            _('Failed to get the syntax tree due to limited KWIC context (too long sentence).'))


class SyntaxDataProviderError(Exception):
    pass


class SyntaxDataProvider(AbstractSyntaxViewerPlugin):

    def __init__(self, corpora_conf, backend, auth):
        self._conf = corpora_conf
        self._backend = backend
        self._auth = auth

    def search_by_token_id(self, corp, corpname, token_id, kwic_len):
        data, encoder = self._backend.get_data(corp, corpname, token_id, kwic_len)
        # we must return a callable to force our custom JSON encoding
        return lambda: json.dumps(data, cls=encoder)

    def is_enabled_for(self, plugin_ctx, corpname):
        return corpname in self._conf

    def export_actions(self):
        return {concordance.Actions: [get_syntax_data]}

    def export(self, plugin_ctx):
        return dict(detail_attr_orders=self._backend.get_detail_attr_orders(plugin_ctx.current_corpus.corpname,
                                                                            plugin_ctx.current_corpus))


def load_plugin_conf_from_file(plugin_conf):
    conf_path = plugin_conf.get('config_path')
    if not conf_path or not os.path.isfile(conf_path):
        raise SyntaxDataProviderError('Plug-in configuration file [%s] not found. Please check config_path.' %
                                      (conf_path,))
    with open(conf_path, 'rb') as f:
        conf_data = json.load(f)
        return conf_data.get('corpora', {})


def load_plugin_conf_from_db(db: IntegrationDatabase, corp_table='kontext_corpus') -> Dict[str, str]:

    def parse_conf(corp, src):
        try:
            return json.loads(src)
        except Exception as ex:
            logging.getLogger(__name__).warning(f'Failed to load syntax viewer conf for {corp}: {ex}')
            return None

    cursor = db.cursor()
    cursor.execute(
        'SELECT name, syntax_viewer_conf_json '
        f'FROM {corp_table} '
        'WHERE syntax_viewer_conf_json IS NOT NULL')
    return {row['name']: parse_conf(row['name'], row['syntax_viewer_conf_json']) for row in cursor}


@plugins.inject(plugins.runtime.AUTH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, auth, integ_db: IntegrationDatabase):
    plugin_conf = conf.get('plugins', 'syntax_viewer')
    if integ_db.is_active and 'config_path' not in plugin_conf:
        logging.getLogger(__name__).info(
            f'default_syntax_viewer uses integration_db[{integ_db.info}]')
        corpora_conf = load_plugin_conf_from_db(integ_db)
    else:
        logging.getLogger(__name__).info(f'default_syntax_viewer uses config_path configuration')
        corpora_conf = load_plugin_conf_from_file(plugin_conf)

    return SyntaxDataProvider(corpora_conf, ManateeBackend(corpora_conf), auth)
