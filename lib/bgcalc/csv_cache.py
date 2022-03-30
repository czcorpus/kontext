# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import aiocsv
import aiofiles

from util import aenumerate, anext


async def load_cached_partial(path, offset, limit):
    async with aiofiles.open(path, 'r') as fr:
        csv_reader = aiocsv.AsyncReader(fr)
        _, total_str = await anext(csv_reader)
        for i in range(0, offset):
            await anext(csv_reader)
        ans = []
        async for i, row in aenumerate(csv_reader, offset):
            if i == offset + limit:
                break
            ans.append((row[0], ) + tuple(int(x) for x in row[1:]))
    return int(total_str), ans


async def load_cached_full(path):
    ans = []
    async with aiofiles.open(path, 'r') as fr:
        csv_reader = aiocsv.AsyncReader(fr)
        _, total_str = await anext(csv_reader)
        async for row in csv_reader:
            ans.append((row[0], ) + tuple(int(x) for x in row[1:]))
    return int(total_str), ans
