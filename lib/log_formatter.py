# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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

import hashlib
import logging
import os
import uuid
import time
from datetime import datetime
import zoneinfo
import traceback

from pythonjsonlogger import jsonlogger


class KontextLogFormatter(jsonlogger.JsonFormatter):

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record['date'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%f') + self._tz_offset()
        if log_record.get('level'):
            log_record['level'] = log_record['level'].upper()
        else:
            log_record['level'] = record.levelname
        log_record['logger'] = record.name
        if 'message' in log_record and not log_record['message']:
            del log_record['message']
        if 'exc_info' in log_record:
            del log_record['exc_info']

    def format(self, record: logging.LogRecord):
        if record.exc_info:
            _, ex, st = record.exc_info
            record.__dict__['exception'] = {
                'id': hashlib.sha1(str(uuid.uuid1()).encode('ascii')).hexdigest(),
                'type': type(ex).__name__,
                'stack': [ s.strip() for s2 in traceback.format_tb(st) for s in s2.split('\n')]
            }
        return super().format(record)

    @staticmethod
    def _tz_offset() -> str:
        try:
            z = zoneinfo.ZoneInfo(time.tzname[0])
        except:
            z = zoneinfo.ZoneInfo(os.environ.get('TZ', 'UTC'))
        tos = z.utcoffset(datetime.now()).seconds
        if tos == 0:
            return 'Z'
        elif tos < 0:
            sgn = '-'
            tos = abs(tos)
        else:
            sgn = '+'
        h, r = divmod(tos, 3600)
        m, _ = divmod(r, 60)
        return '{}{:02}:{:02}'.format(sgn, int(h), int(m))
