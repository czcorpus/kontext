# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import os

import plugins
from texttypes.model import TextTypesCache

from .templating import TplEngine


class ApplicationContext:

    def __init__(self, templating: TplEngine, tt_cache: TextTypesCache):
        self._templating = templating
        self._installed_langs = {
            x.split('_')[0]: x
            for x in os.listdir(os.path.join(os.path.dirname(__file__), '..', '..', 'locale'))
        }
        self._tt_cache = tt_cache

    @property
    def templating(self):
        return self._templating

    @property
    def tt_cache(self):
        return self._tt_cache

    @property
    def installed_langs(self):
        return self._installed_langs
