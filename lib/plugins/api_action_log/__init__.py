# Copyright (c) 2024 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
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

from plugins.default_action_log import DefaultActionLog

class APIActionLog(DefaultActionLog):
    """
    API action log adds isApi flag to the log and tests
    """

    def collect_args(self, request, args_map, action_log_mapper, full_action_name, err_desc):
        log_data = super().collect_args(request, args_map, action_log_mapper, full_action_name, err_desc)
        if 'x-is-web-app' in request.headers:
            log_data['request']['X_IS_WEB_APP'] = request.headers['x-is-web-app']
        log_data['is_api'] = True
        return log_data


def create_instance(_):
    return APIActionLog()
