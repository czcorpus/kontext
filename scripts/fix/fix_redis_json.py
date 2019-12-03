import sys
import os

sys.path.insert(0, os.path.realpath('%s/..' % os.path.dirname(__file__)))
import autoconf
import plugins

from plugins import lindat_db
plugins.install_plugin('db', lindat_db, autoconf.settings)

if __name__ == '__main__':
    plugin_db = plugins.runtime.DB.instance
    redis = getattr(plugin_db, 'redis')
    # cleanup caches etc.
    redis.flushdb()
    auth_db = plugin_db.get_instance('auth')
    redis = getattr(auth_db, 'redis')
    keys = list([key for key in list(auth_db.keys()) if key != '__user_count'])
    for key in keys:
        try:
            auth_db.hash_get_all(key)
        except:
            data = redis.hgetall(key)
            for k, v in list(data.items()):
                if k == 'id':
                    v = int(v)
                auth_db.hash_set(key, k, v)
