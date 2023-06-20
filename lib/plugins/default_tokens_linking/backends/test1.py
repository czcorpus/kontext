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

from typing import Any, List, Tuple

import conclib

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
            corp_factory,
            corpus_id,
            token_id,
            token_length,
            token_ranges,
            lang,
            is_anonymous,
            cookies,
    ) -> Tuple[Any, bool]:
        selected_token = {}
        tokens = {}
        clicked_word = None
        for corp_id, tok_range in token_ranges.items():
            corp = await corp_factory.get_corpus(corp_id)
            data = conclib.get_detail_context(
                corp=corp, pos=tok_range[0], attrs=self.required_attrs(), structs='', hitlen=token_length,
                detail_left_ctx=0, detail_right_ctx=tok_range[1] - tok_range[0])
            tokens[corp_id] = data.get('content', [])
            if corp_id == corpus_id:
                for i, t in enumerate(tokens[corp_id]):
                    if tok_range[0] + i == token_id:
                        clicked_word = t['str']
                        break
        if clicked_word:
            first_letter = clicked_word[0].lower()
        else:
            first_letter = '-'

        selected_token['link'] = []
        for corpname, corp_tokens in tokens.items():
            for tok_idx, token in enumerate(corp_tokens):
                value = token['str'].lower()
                if value and value[0].lower() == first_letter:
                    selected_token['link'].append({
                        'corpname': corpname,
                        'tokenId': token_ranges[corpname][0] + tok_idx,
                        'highlightColor': self._conf['colors'][0],
                        'altColors': self._conf['colors'][1:],
                        'comment': 'Test1Backend highlights tokens with the same starting letter',
                    })
        return [selected_token], True
