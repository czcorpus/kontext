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
#     "attr": "word",
#     "color": "rgba(255, 99, 71, 0.5)"
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
        selected_token = None
        for token in tokens[corpus_id]:
            if token['tokenId'] == token_id:
                selected_token = token
                break
        first_letter = selected_token['attrs'][self._conf['attr']][0].lower()
        selected_token['link'] = []
        user_attr = self._conf['attr']
        for corpname, corp_tokens in tokens.items():
            for token in corp_tokens:
                if token['attrs'].get(user_attr, [''])[0].lower() == first_letter:
                    selected_token['link'].append({
                        'corpname': corpname,
                        'tokenId': token['tokenId'],
                        'highlightColor': self._conf['color'],
                        'comment': 'Test1Backend highlights tokens with the same starting letter',
                    })
        return [selected_token], True
