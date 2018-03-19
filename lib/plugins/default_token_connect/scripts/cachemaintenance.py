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

import os
import sys

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../../lib')))
import settings
from plugins.default_token_connect.cache_man import CacheMan

conf_path = os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../../conf/config.xml'))
settings.load(conf_path)

conf = settings.get('plugins', 'token_connect')
cache_path = conf.get('default:cache_db_path')
if cache_path:
    cache_rows_limit = conf.get('default:cache_rows_limit')
    cache_ttl_days = conf.get('default:cache_ttl_days')
    cacheMan = CacheMan(cache_path, cache_rows_limit, cache_ttl_days)
    cacheMan.clear_extra_rows()
