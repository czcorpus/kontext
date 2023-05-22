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

from plugin_types.general_storage import KeyValueStorage

from .abstract import AbstractBackend

#
# Example provider conf:
# {
#     "attr": "word",
#     "highlightAttr": "word",
# }
#


class Test1Backend(AbstractBackend):

    def required_attrs(self) -> List[str]:
        return [self._conf['attr']]

    async def fetch(
            self,
            corpora: List[str],
            token_id: int,
            token_length: int,
            row: List[Dict[str, str]],
            lang: str,
    ) -> Tuple[Any, bool]:
        return (
            {
                'provider': self.provider_id,
                'highlight': row[token_id][self._conf['attr']][0] + '.*',
                'highlightAttr': self._conf['highlightAttr'],
            },
            True,
        )
