# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import logging
import time
from dataclasses import asdict

import aiomysql
import pymysql
import pymysql.cursors
from plugins.common.mysql import MySQLOps

from plugin_types.integration_db import IntegrationDatabase



class MySqlIntegrationDb(MySQLOps, IntegrationDatabase[aiomysql.Connection, aiomysql.Cursor, pymysql.Connection, pymysql.cursors.Cursor]):
    """
    MySqlIntegrationDb is a variant of integration_db plug-in providing access
    to MySQL/MariaDB instances. It is recommended for:
     1) integration with existing MySQL/MariaDB information systems,
     2) self-contained production installations with many registered users and
        thousands or more search requests per day where most of the search
        requests are archived

    Please make sure scripts/schema.sql is applied to your database. Otherwise
    the plug-in fails to start. In case of a Dockerized installation, this
    is done automatically.
    """

    def __init__(self, host, database, user, password, pool_size, autocommit, retry_delay, retry_attempts,
                 environment_wait_sec: int):
        super().__init__(host, database, user, password, pool_size, autocommit, retry_delay, retry_attempts)
        self._environment_wait_sec = environment_wait_sec

    async def _init_pool(self):
        if self._pool is None:
            self._pool = await aiomysql.create_pool(**asdict(self._conn_args), **asdict(self._pool_args))

    @property
    def is_active(self):
        return True

    @property
    def is_autocommit(self):
        return self._conn_args.get('autocommit', False)

    @property
    def info(self):
        return f'{self._conn_args.host}:{self._conn_args.port}/{self._conn_args.db}'

    def wait_for_environment(self):
        t0 = time.time()
        logging.getLogger(__name__).info(
            f'Going to wait {self._environment_wait_sec}s for integration environment')
        while (time.time() - t0) < self._environment_wait_sec:
            with self.cursor_sync() as cursor:
                try:
                    cursor.execute(
                        'SELECT COUNT(*) as env_count FROM kontext_integration_env LIMIT 1')
                    row = cursor.fetchone()
                    if row and row['env_count'] == 1:
                        return None
                except Exception as ex:
                    logging.getLogger(__name__).warning(
                        f'Integration environment still not available. Reason: {ex}')
            time.sleep(0.5)
        return Exception(
            f'Unable to confirm integration environment within defined interval {self._environment_wait_sec}s.',
            'Please check table kontext_integration_env')


def create_instance(conf):
    pconf = conf.get('plugins', 'integration_db')
    return MySqlIntegrationDb(
        host=pconf['host'], database=pconf['db'], user=pconf['user'], password=pconf['passwd'],
        pool_size=int(pconf['pool_size']), autocommit=True,
        retry_delay=int(pconf['retry_delay']), retry_attempts=int(pconf['retry_attempts']),
        environment_wait_sec=int(pconf['environment_wait_sec']))
