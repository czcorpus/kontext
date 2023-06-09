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
from typing import Any, Dict, List, Tuple

from corplib import CorpusFactory
from plugin_types.providers import AbstractProviderBackend


class AbstractBackend(AbstractProviderBackend):

    @abc.abstractmethod
    def required_attrs(self) -> List[str]:
        pass

    def get_required_cookies(self) -> List[str]:
        return []

    @abc.abstractmethod
    async def fetch(
            self,
            corp_factory: CorpusFactory,
            corpus_id: str,
            token_id: int,
            token_length: int,
            token_ranges: Dict[str, Tuple[int, int]],
            lang: str,
            is_anonymous: bool,
    ) -> Tuple[Any, bool]:
        pass
