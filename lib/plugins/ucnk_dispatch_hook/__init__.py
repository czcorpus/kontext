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


from plugin_types.dispatch_hook import AbstractDispatchHook
from plugin_types.general_storage import KeyValueStorage
from action.plugin.ctx import PluginCtx
from action.errors import ServiceUnavailableException
from action import ActionProps
import plugins
from plugins import inject
import logging
import time
from dataclasses import dataclass
from dataclasses_json import dataclass_json, LetterCase


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class ActivityReport:
    num_requests: int
    time_window_secs: int
    mean: float
    stdev: float
    created: str
    total_reports: int


class UcnkDispatchHook(AbstractDispatchHook):
    """
    """

    def __init__(self, db: KeyValueStorage, bot_clients_key: str, num_reports_threshold: int, ban_length_hours: int):
        self._db = db
        self.bot_clients_key = bot_clients_key
        self.num_reports_threshold = num_reports_threshold
        self.ban_length_hours = ban_length_hours

    def _check_client(self, plugin_ctx: PluginCtx):
        """
        """
        client_ip = plugin_ctx.client_ip
        rec = self._db.hash_get(self.bot_clients_key, client_ip)
        if rec:
            report: ActivityReport = ActivityReport.from_dict(rec)
            logging.getLogger(__name__).warning(
                f'client reported (IP: {client_ip}, num req.: {report.num_requests}, created: {report.created})')
            if report.total_reports >= self.num_reports_threshold:
                if plugin_ctx.user_dict['api_key']:
                    return  # we don't want to restrict users who registered for API use
                created_dt = time.mktime(time.strptime(report.created, '%Y-%m-%dT%H:%M:%Sz'))
                if (time.time() - created_dt) / 3600 < self.ban_length_hours:
                    raise ServiceUnavailableException('Service unavailable due to bot-like activity')
                else:
                    logging.getLogger(__name__).warning(f'client ban expired for IP {client_ip}')
                    self._db.hash_del(self.bot_clients_key, client_ip)

    def pre_dispatch(self, plugin_ctx, action_props: ActionProps, request):
        self._check_client(plugin_ctx)


@inject(plugins.runtime.DB)
def create_instance(conf, db):
    plg_conf = conf.get('plugins', 'dispatch_hook')
    return UcnkDispatchHook(
        db=db,
        bot_clients_key=plg_conf['bot_clients_key'],
        num_reports_threshold=int(plg_conf['num_reports_threshold']),
        ban_length_hours=int(plg_conf['ban_length_hours']))
