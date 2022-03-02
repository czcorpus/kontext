# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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


import os
import sys

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../scripts')))
import autoconf
import plugins
from action.plugin import initializer
initializer.init_plugin('db')

tmp_key = 'user_index:new'
uindex_key = 'user_index'

if __name__ == '__main__':
    db = plugins.runtime.DB.instance
    redis_db = getattr(db, 'redis')
    data = redis_db.hgetall(uindex_key)
    for k, v in list(data.items()):
        print(('%s -> %s' % (k, v)))
        db.hash_set(tmp_key, k, v)
    db.rename(uindex_key, 'user_index:old')
    db.rename(tmp_key, uindex_key)
