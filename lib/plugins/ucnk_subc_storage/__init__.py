# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
This is a slightly modified version of mysql_subc_storage conforming some peculiarities
of CNC's information schema.
"""


import logging

from plugin_types.corparch import AbstractCorporaArchive
from plugins.errors import PluginCompatibilityException
import plugins
from plugins.mysql_integration_db import MySqlIntegrationDb
from plugins.mysql_subc_storage import BackendConfig, MySQLSubcArchive


@plugins.inject(plugins.runtime.CORPARCH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, corparch: AbstractCorporaArchive, integ_db: MySqlIntegrationDb):
    plugin_conf = conf.get('plugins', 'subc_storage')
    if integ_db.is_active:
        logging.getLogger(__name__).info(f'ucnk_subc_storage uses integration_db[{integ_db.info}]')
        bconf = BackendConfig(
            user_table='user',
            subccorp_table='kontext_subcorpus',
            user_table_firstname_col='firstName',
            user_table_lastname_col='surname'
        )
        return MySQLSubcArchive(plugin_conf, corparch, integ_db, bconf)
    else:
        raise PluginCompatibilityException('ucnk_subc_storage works only with integration_db enabled')
