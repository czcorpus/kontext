#
# MIT License
#
# Copyright (c) 2017 Suby Raman
# Copyright (c) 2018 Mikhail Kashkin
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

from sanic import HTTPResponse, Request, Sanic

from .aioredis import AIORedisSessionInterface
from .base import BaseSessionInterface
from .memcache import MemcacheSessionInterface
from .memory import InMemorySessionInterface
from .redis import RedisSessionInterface

__all__ = (
    "RedisSessionInterface",
    "AIORedisSessionInterface",
    "MemcacheSessionInterface",
    "InMemorySessionInterface",
    "Session",
)


class Session:
    def __init__(self, app: Sanic = None, interface: BaseSessionInterface = None):
        self.interface: BaseSessionInterface = None
        if app:
            self.init_app(app, interface)

    def init_app(self, app: Sanic, interface: BaseSessionInterface):
        self.interface = interface
        if not hasattr(app.ctx, "extensions"):
            app.ctx.extensions = {}

        app.ctx.extensions[self.interface.session_name] = self  # session_name defaults to 'session'

        # @app.middleware('request')
        async def add_session_to_request(request: Request):
            """Before each request initialize a session
            using the client's request."""
            await self.interface.open(request)

        # @app.middleware('response')
        async def save_session(request: Request, response: HTTPResponse):
            """After each request save the session, pass
            the response to set client cookies.
            """
            await self.interface.save(request, response)

        app.request_middleware.appendleft(add_session_to_request)
        app.response_middleware.append(save_session)
