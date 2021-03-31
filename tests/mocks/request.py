# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

from mocks import MultiDict
from mocks.manatee import CorpusManager


class PluginCtx(object):
    user_id = 3
    user_lang = 'en_US'


class Controller(object):

    def __init__(self):
        self.cm = CorpusManager()
        self._plugin_ctx = PluginCtx()


class Request(object):

    def __init__(self, url, args=None, form=None):
        self._url = url
        self._args = MultiDict(args if args is not None else {})
        self._form = MultiDict(form if form is not None else {})

    @property
    def args(self):
        return self._args

    @property
    def form(self):
        return self._form
