# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Optional, Tuple, List, Any


class KontextError(Exception):

    def __init__(self, message: str, client_msg: Optional[Tuple[str, List[Any]]] = None):
        """
        Args:
            message:  is an internal (yet human-readable English) message
            client_msg: is a key and args used on the client side to translate messages
        """

        super().__init__(message, client_msg)
        self._message = message
        self._client_msg = client_msg

    @property
    def message(self):
        return self._message

    @property
    def client_msg(self):
        return self._client_msg
