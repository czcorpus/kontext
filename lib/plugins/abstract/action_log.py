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

from typing import Callable, Any, Tuple, Optional
from werkzeug import Request


class AbstractActionLog:
    """
    Action log stores information about user actions (= requests handled by one of the "exposed" methods)
    into a defined location (typically a file or a database).

    Some action methods provide additional parameters via 'action_log_mapper' function which produces
    a dict (with possibly nested values).
    """

    def log_action(self, request: Request, action_log_mapper: Callable[[None], Any], action_name: str,
                   err_desc: Tuple[str, str], proc_time: Optional[float]) -> None:
        """
        params:
            request -- a HTTP request leading to the logged action
            action_log_mapper -- a function which fetches some arguments out of a query, this can be
                                 used for more detailed and action-specific logging
            action_name -- name of the called method
            err_desc -- a message type and a message text
            proc_time -- time taken by the action method to process a respective request

        """
        pass
