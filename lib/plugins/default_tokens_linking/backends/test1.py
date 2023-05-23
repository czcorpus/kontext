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

from typing import Any, Dict, List, Tuple

from .abstract import AbstractBackend

#
# Example provider conf:
# {
#     "attr": "word"
# }
#


class Test1Backend(AbstractBackend):

    def required_attrs(self) -> List[str]:
        return [self._conf['attr']]

    async def fetch(
            self,
            corpus_id: str,
            token_id: int,
            token_length: int,
            tokens: Dict[str, List[Dict[str, Any]]],
            lang: str,
    ) -> Tuple[Any, bool]:
        token = None
        for t in tokens[corpus_id]:
            if t['tokenId'] == token_id:
                token = t
                break

        token['link'] = [
            {
                'corpname': corpus_id,
                'tokenId': token_id,
                'highlightCategory': 1,
                'comment': 'Test1Backend highlighted clicked token',
            }
        ]

        return [token], True
