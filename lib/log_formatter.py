# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import logging_json


def get_exc_info(exc):
    import traceback
    return {
        'id': hashlib.sha1(str(uuid.uuid1()).encode('ascii')).hexdigest(),
        'type': type(exc).__name__,
        'stack': traceback.format_exception(None, exc, exc.__traceback__),
    }


class KontextLogFormatter(logging_json.JSONFormatter):
    def format(self, record: logging.LogRecord):
        if record.exc_info is not None:
            record.__dict__['exception'] = get_exc_info(record.exc_info)
            record.exc_info = None
        elif isinstance(record.msg, Exception):
            record.__dict__['exception'] = get_exc_info(record.msg)
        return super().format(record)
