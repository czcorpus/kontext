# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

from sanic import Blueprint, Request, Websocket

bp = Blueprint('websocket', 'ws')


@bp.websocket('/test')
async def test(req: Request, ws: Websocket):
    while True:
        data = "hello!"
        logging.debug("Sending: " + data)
        await ws.send(data)
        data = await ws.recv()
        logging.debug("Received: " + data)
