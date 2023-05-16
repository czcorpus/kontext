# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import abc
from typing import Iterable
from plugin_types.general_storage import KeyValueStorage

class AbstractBackend(abc.ABC):

    def __init__(self, provider_id: str, db: KeyValueStorage, ttl: int):
        self._db: KeyValueStorage = db
        self._ttl: int = ttl
        self._provider_id: str = provider_id


    def enabled_for_corpora(self, corpora: Iterable[str]) -> bool:
        # TODO
        return True
