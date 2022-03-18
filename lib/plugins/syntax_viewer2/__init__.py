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
An improved default_syntax viewer with rewritten tree rendering
"""

import logging
import plugins
import plugins.default_syntax_viewer as dsv
from .backend.manatee import ManateeBackend2


@plugins.inject(plugins.runtime.AUTH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, auth, integ_db):
    plugin_conf = conf.get('plugins', 'syntax_viewer')
    if integ_db.is_active and 'config_path' not in plugin_conf:
        logging.getLogger(__name__).info(
            f'syntax_viewer2 uses integration_db[{integ_db.info}]')
        corpora_conf = dsv.load_plugin_conf_from_db(integ_db)
    else:
        logging.getLogger(__name__).info(
            f'syntax_viewer2 uses JSON configuration file {plugin_conf["config_path"]}')
        corpora_conf = dsv.load_plugin_conf_from_file(plugin_conf)
    return dsv.SyntaxDataProvider(corpora_conf, ManateeBackend2(corpora_conf), auth)
