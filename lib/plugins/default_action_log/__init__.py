# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import logging
import json
import datetime
import settings
from plugins.abstract.action_log import AbstractActionLog


class DefaultActionLog(AbstractActionLog):
    """
    DefaultActionLog stores action logs via standard 'logging' package as initialized and configured
    by KonText. Custom action arguments are stored in a nested dictionary under the 'args' key.

    The plug-in stores also - date, user_id, action (name), proc_time and some request properties (client IP,
    client user agent).
    """

    def log_action(self, request, action_log_mapper, full_action_name, err_desc, proc_time):
        log_data = {}
        if action_log_mapper:
            try:
                log_data['args'] = action_log_mapper(request)
            except Exception as ex:
                log_data['args'] = {}
                logging.getLogger(__name__).error('Failed to map request info to log: {}'.format(ex))
        if err_desc:
            log_data['error'] = dict(name=err_desc[0], anchor=err_desc[1])
        log_data['date'] = datetime.datetime.today().strftime('%s.%%f' % settings.DEFAULT_DATETIME_FORMAT)
        log_data['action'] = full_action_name
        log_data['user_id'] = request.session.get('user', {}).get('id')
        if proc_time is not None:
            log_data['proc_time'] = proc_time
        log_data['request'] = {
            'REMOTE_ADDR': request.environ.get('REMOTE_ADDR'),
            'HTTP_X_FORWARDED_FOR': request.environ.get('HTTP_X_FORWARDED_FOR'),
            'HTTP_USER_AGENT': request.environ.get('HTTP_USER_AGENT')
        }
        logging.getLogger('QUERY').info(json.dumps(log_data))


def create_instance(_):
    return DefaultActionLog()
