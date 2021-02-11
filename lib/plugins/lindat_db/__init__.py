# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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

"""
An extended implementation of RedisDb with support for multiple databases
accessible via get_instance() for individual plug-ins.

This plug-in should be able to handle high-load installations without any problems.

required XML: please see ./config.rng
"""

import redis
from plugins.redis_db import RedisDb


class LindatRedisDb(RedisDb):

    def __init__(self, host, port, shard_id):
        """
        arguments:
        conf -- a dictionary containing 'settings' module compatible configuration of the plug-in
        """
        self._host = host
        self._port = port
        self._shard_id = shard_id
        self.redis = redis.StrictRedis(host=self._host, port=self._port, db=self._shard_id)
        self._scan_chunk_size = 50

    def keys(self, pattern='*'):
        """Returns a list fo keys matching ``pattern``"""
        return self.redis.keys(pattern)


class RedisDbManager(LindatRedisDb):
    """
        Allow to specify different shards for different plugins.

        Note:
            Plugins have to support this by calling `db.get_instance("plugin_name")`.
    """

    def __init__(self, conf, host, port, default_shard_id):
        super(RedisDbManager, self).__init__(host, port, default_shard_id)
        self._shards = []
        if "shards" in conf:
            for shard in conf["shards"].split(","):
                plugin_name, shard = shard.split(":")
                self._shards.append([plugin_name, int(shard), None])

    def get_instance(self, plugin_name):
        """
            Return plugin specific shard.
        """
        for shard in self._shards:
            plg_name, shard_id, inst = shard
            if plg_name == plugin_name:
                if inst is None:
                    inst = LindatRedisDb(host=self._host, port=self._port, shard_id=shard_id)
                    shard[2] = inst
                return inst
        return self


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    db_conf = conf.get('plugins', 'db')
    return RedisDbManager(db_conf,
                          host=db_conf['host'],
                          port=int(db_conf['port']),
                          default_shard_id=int(db_conf['id']))
