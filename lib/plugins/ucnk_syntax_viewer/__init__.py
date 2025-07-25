# Copyright (c) 2016 Charles University, Faculty of Arts,
#                    Department of Linguistics
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
A customized version of syntax_viewer2 as used by the CNC
(no new features here)

Please note that for the client-side, the configuration should
be: <js_module>syntaxViewer2</js_module>
"""

import logging

import plugins
import plugins.default_syntax_viewer as dsv
from plugin_types.auth import AbstractAuth
from plugin_types.integration_db import IntegrationDatabase
from plugins.syntax_viewer2.backend.manatee import ManateeBackend2


@plugins.inject(plugins.runtime.AUTH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, auth: AbstractAuth, integ_db: IntegrationDatabase):
    plugin_conf = conf.get('plugins', 'syntax_viewer')
    if integ_db.is_active and 'config_path' not in plugin_conf:
        logging.getLogger(__name__).info(
            f'ucnk_syntax_viewer uses integration_db[{integ_db.info}]')
        corpora_conf = dsv.load_plugin_conf_from_db(integ_db, corp_table='corpora')
    else:
        corpora_conf = dsv.load_plugin_conf_from_file(plugin_conf)
    return dsv.SyntaxDataProvider(corpora_conf, ManateeBackend2(corpora_conf), auth)
