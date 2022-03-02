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

from typing import Callable, Any, Tuple, Optional, Dict
from sanic.request import Request
import abc
from action.argmapping import Args


class AbstractActionLog:
    """
    Action log stores information about user actions (= requests handled by one of the "exposed" methods)
    into a defined location (typically a file or a database).

    Some action methods provide additional parameters via 'action_log_mapper' function which produces
    a dict (with possibly nested values).
    """

    def log_action(
            self, request: Request, args_map: Args, action_log_mapper: Callable[[Request], Any],
            full_action_name: str, err_desc: Optional[Tuple[Exception, Optional[str]]],
            proc_time: Optional[float]) -> str:
        self.write_action(
            self.collect_args(request, args_map, action_log_mapper, full_action_name, err_desc, proc_time))

    @abc.abstractmethod
    def collect_args(self, request: Request, args_map: Args, action_log_mapper: Callable[[Request], Any],
                     full_action_name: str, err_desc: Optional[Tuple[Exception, Optional[str]]],
                     proc_time: Optional[float]) -> Dict[str, Any]:
        """
        A custom implementation transforming passed arguments into a dictionary with possibly nested values.
        The only restriction regarding the structure is that the write_action() method should be able
        to write it to a target location.

        params:
            request -- a HTTP request leading to the logged action
            args_map -- normalized (mostly) concordance-related arg mapping
            action_log_mapper -- a function which fetches some arguments out of a query, this can be
                                 used for more detailed and action-specific logging
            full_action_name -- full name of the called method - i.e. including controller prefix separated
                                by the slash character - e.g. wordlist/form
            err_desc -- a 2-tuple (Exception and a unique ID/anchor for searching the error in a log file).
                        In case of no error, None should be used (i.e. no (None, None) tuple).
            proc_time -- time taken by the action method to process a respective request
        """

    @abc.abstractmethod
    def write_action(self, data: Dict[str, Any]) -> None:
        """
        Write logged data to a desired location.
        """
