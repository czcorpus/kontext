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
from typing import Tuple, Union, Optional
from plugin_types.action_log import AbstractActionLog
from action.errors import UserActionException, ImmediateRedirectException


class DefaultActionLog(AbstractActionLog):
    """
    DefaultActionLog stores action logs via standard 'logging' package as initialized and configured
    by KonText. Custom action arguments are stored in a nested dictionary under the 'args' key.

    The plug-in stores also - date, user_id, action (name), proc_time and some request properties (client IP,
    client user agent).
    """

    @staticmethod
    def is_error(e: Optional[Tuple[Exception, str]]):
        return e is not None and not isinstance(e[0], ImmediateRedirectException)

    @staticmethod
    def expand_error_desc(e: Tuple[Exception, str]) -> Tuple[str, Union[str, None], Union[str, None]]:
        if not isinstance(e[0], Exception):  # this should normally not happen (= incorrect error processing)
            return f'Unknown Error [{e[0]}]', None, None
        elif isinstance(e[0], UserActionException):
            return e[0].__class__.__name__, e[0].internal_message, e[1]
        elif hasattr(e, 'message'):
            return e[0].__class__.__name__, e.message, e[1]
        else:
            return e[0].__class__.__name__, str(e[0]), e[1]

    def collect_args(self, request, args_map, action_log_mapper, full_action_name, err_desc, proc_time):
        log_data = {'args': {}}
        if action_log_mapper:
            try:
                log_data['args'] = action_log_mapper(request)
            except Exception as ex:
                logging.getLogger(__name__).error('Failed to map request info to log: {}'.format(ex))
        corpora = log_data['args'].get('corpora', [])
        if len(corpora) == 0:
            log_data['args']['corpora'] = [args_map.corpname] + args_map.align
        if self.is_error(err_desc):
            err_name, err_msg, err_anchor = self.expand_error_desc(err_desc)
            log_data['error'] = dict(name=err_name, message=err_msg, anchor=err_anchor)
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
        return log_data

    def write_action(self, data: str) -> None:
        logging.getLogger('QUERY').info(json.dumps(data))


def create_instance(_):
    return DefaultActionLog()
