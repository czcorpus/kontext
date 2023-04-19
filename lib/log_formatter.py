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
import uuid
import time
from datetime import datetime
import zoneinfo
import traceback

from pythonjsonlogger import jsonlogger


def get_exc_info(exc: Exception):
    return {
        'id': hashlib.sha1(str(uuid.uuid1()).encode('ascii')).hexdigest(),
        'type': type(exc).__name__,
        'stack': traceback.format_exception(None, exc, exc.__traceback__),
    }


class KontextLogFormatter(jsonlogger.JsonFormatter):

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record['date'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f') + self._tz_offset()
        if log_record.get('level'):
            log_record['level'] = log_record['level'].upper()
        else:
            log_record['level'] = record.levelname
        log_record['logger'] = record.name
        if 'message' in log_record and not log_record['message']:
            del log_record['message']
        del log_record['exc_info']


    def format(self, record: logging.LogRecord):
        if record.exc_info:
            _, _, st = record.exc_info
            record.__dict__['exception'] = [s.strip() for s in traceback.format_tb(st)]
        return super().format(record)

    @staticmethod
    def _tz_offset() -> str:
        z = zoneinfo.ZoneInfo(time.tzname[0])
        tos = z.utcoffset(datetime.now()).seconds
        if tos < 0:
            sgn = '-'
            tos = abs(tos)
        else:
            sgn = '+'
        h, r = divmod(tos, 3600)
        m, _ = divmod(r, 60)
        return '{}{:02}:{:02}'.format(sgn, int(h), int(m))
