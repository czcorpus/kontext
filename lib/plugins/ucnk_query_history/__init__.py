# Copyright (c) 2024 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2024 Martin Zimandl <martin.zimandl@gmail.com>
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
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import logging

import plugins
from plugin_types.query_persistence import AbstractQueryPersistence
from plugin_types.subc_storage import AbstractSubcArchive
from plugin_types.auth import AbstractAuth
from plugins import inject
from plugins.mysql_query_history import MySqlQueryHistory
from plugins.mysql_integration_db import MySqlIntegrationDb
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.common.mysql import MySQLConf


class UcnkQueryHistory(MySqlQueryHistory):

    def supports_fulltext_search(self):
        return True


@inject(
    plugins.runtime.INTEGRATION_DB,
    plugins.runtime.QUERY_PERSISTENCE,
    plugins.runtime.SUBC_STORAGE,
    plugins.runtime.AUTH
)
def create_instance(
        conf,
        integ_db: MySqlIntegrationDb,
        query_persistence: AbstractQueryPersistence,
        subc_archive: AbstractSubcArchive,
        auth: AbstractAuth
):
    plugin_conf = conf.get('plugins', 'auth')
    if integ_db and integ_db.is_active and 'mysql_host' not in plugin_conf:
        db = integ_db
        logging.getLogger(__name__).info(f'ucnk_query_history uses integration_db[{integ_db.info}]')
    else:
        db = AdhocDB(MySQLConf.from_conf(plugin_conf))
    return UcnkQueryHistory(conf, db, query_persistence, subc_archive, auth)
