# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

from plugins.abstract.dispatch_hook import AbstractDispatchHook
import plugins
from plugins import inject


class UcnkDispatchHook(AbstractDispatchHook):
    """
    A super-simple dispatch hook used to write KonText
    logs to a Redis queue where they are fetched by
    [Klogproc](https://github.com/czcorpus/klogproc)
    utility.
    """

    def __init__(self, db, queue_key):
        self._db = db
        self._queue_key = queue_key

    def post_dispatch(self, plugin_api, methodname, action_metadata, log_data):
        self._db.list_append(self._queue_key, log_data)


@inject(plugins.runtime.DB)
def create_instance(conf, db):
    plg_conf = conf.get('plugins', 'dispatch_hook')
    queue_key = plg_conf['ucnk:queue_key']
    return UcnkDispatchHook(db, queue_key)
