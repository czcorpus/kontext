# Copyright (c) 2016 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

import logging

import plugins
from plugin_types.general_storage import KeyValueStorage
from plugins import inject
from plugins.default_conc_cache import CacheMappingFactory


@inject(plugins.runtime.DB)
def create_instance(settings, db: KeyValueStorage):
    logging.getLogger(__name__).warning('Plug-in redis_conc_cache has been renamed to default_conc_cache '
                                        '- please update your config.xml. The old name will be removed '
                                        'in future versions')
    return CacheMappingFactory(cache_dir=settings.get('plugins', 'conc_cache')['cache_dir'], db=db)
