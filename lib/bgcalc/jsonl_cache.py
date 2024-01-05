# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

import aiofiles
import ujson as json


def load_cached_partial(path, offset, limit):
    """
    Load part of the file starting from 'offset' and ending
    at 'limit'. Typically, this can be used in case the request
    for data matches sorting column and sorting order.
    (most of the time, we start with data sorted by abs. freq.
    sorted in reverse).
    """
    with open(path, 'r') as fr:
        total = json.loads(fr.readline())['total']
        ans = []
        i = 0
        for row in fr:
            if i < offset:
                i += 1
                continue
            elif i == offset + limit:
                break
            else:
                ans.append(json.loads(row))
                i += 1
    return total, ans


def load_cached_full(path):
    """
    Load whole JSONL file into a list of rows
    """
    ans = []
    with open(path, 'r') as fr:
        total = json.loads(fr.readline())['total']
        for row in fr:
            ans.append(json.loads(row))
    return total, ans
