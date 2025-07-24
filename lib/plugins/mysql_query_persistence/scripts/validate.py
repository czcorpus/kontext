# Copyright (c) 2024 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2024 Martin Zimandl <martin.zimandl@gmail.com>
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


import argparse
import asyncio
import hashlib
import os
import sys
import urllib.parse
from datetime import datetime
from enum import Enum
from typing import Any, Dict

import aiohttp

sys.path.insert(0, os.path.realpath('%s/../' % os.path.dirname(os.path.realpath(__file__))))
sys.path.insert(0, os.path.realpath('%s/../../../../scripts/' %
                                    os.path.dirname(os.path.realpath(__file__))))

from dataclasses import asdict, dataclass

import autoconf
from action.plugin import initializer

initializer.init_plugin('integration_db')
import plugins


class Severity(Enum):
    Info = 'info'
    Warning = 'warning'
    Critical = 'critical'
    Recovery = 'recovery'


@dataclass
class SourceId:
    app: str
    instance: str
    tag: str


@dataclass
class ConomiReport:
    sourceId: SourceId
    severity: str
    subject: str
    body: str
    args: Dict[str, Any]


async def check_new_entries(conomi_url: str, auth_header: str, api_token: str, hours: int):
    with plugins.runtime.INTEGRATION_DB as mysql_db:
        async with mysql_db.cursor() as cursor:
            await cursor.execute('SELECT COUNT(*) AS count FROM kontext_conc_persistence WHERE TIMESTAMPDIFF(HOUR, created, NOW()) < %s', (hours,))
            count = (await cursor.fetchone())['count']

    report = ConomiReport(
        SourceId('kontext', '', 'query-persistence-check'),
        Severity.Info.value,
        f'Query persistence entries check',
        f'There are {count} new entries in last {hours} hours',
        {'count': count},
    )

    if count == 0 and (22 > datetime.now().hour > 7):
        report.subject = f'No new query persistence entries in {hours} hours!'
        report.body = f'There were no new query persistence entries in daytime window (7-22h)'
        report.severity = Severity.Warning.value

    headers = {auth_header: hashlib.sha256(api_token.encode()).hexdigest()}
    req_url = urllib.parse.urljoin(conomi_url, 'api/report')
    async with aiohttp.ClientSession() as session:
        async with session.post(req_url, json=asdict(report), headers=headers) as response:
            if response.ok:
                print(await response.json())
            else:
                raise Exception('Request failed', await response.text())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Check new entries in previous N hours')
    parser.add_argument('conomi_url', type=str, help='Conomi url')
    parser.add_argument('auth_header', type=str, help='Conomi auth header')
    parser.add_argument('api_token', type=str, help='Conomi api token')
    parser.add_argument('hours', type=int, help='Time duration')
    args = parser.parse_args()
    asyncio.get_event_loop().run_until_complete(check_new_entries(
        args.conomi_url, args.auth_header, args.api_token, args.hours))
