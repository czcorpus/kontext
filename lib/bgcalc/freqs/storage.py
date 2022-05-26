# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import hashlib
import json
import os
from functools import wraps
from typing import Dict, TypedDict, List
from dataclasses import dataclass
from dataclasses_json import dataclass_json

import aiocsv
import aiofiles.os
import settings
from bgcalc.freqs.types import FreqCalcArgs, FreqCalcResult
from conclib.freq import FreqData, FreqItem
from util import anext


def _cache_file_path(args: FreqCalcArgs):
    v = ''.join([
        str(args.corpname),
        str(args.subcname),
        str(args.user_id),
        ''.join(args.q),
        str(args.fcrit),
        str(args.flimit),
        str(args.freq_sort),
        str(args.ftt_include_empty),
        str(args.rel_mode),
        str(args.collator_locale),
    ])
    filename = '{}.jsonl'.format(hashlib.sha1(v.encode('utf-8')).hexdigest())
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), filename)


class _Head(TypedDict):
    n: str
    s: str
    title: str


@dataclass_json
@dataclass
class _BlockMetadata:
    head: List[_Head]
    skipped_empty: bool
    no_rel_sorting: bool
    size: int


@dataclass_json
@dataclass
class _CommonMetadata:
    num_blocks: int
    conc_size: int


def wrap_cache_metadata(data: FreqData) -> Dict:
    return json.dumps()


def stored_to_fs(func):
    """
    A decorator for storing freq merge results (as CSV files). Please note that this is not just
    caching but rather an essential part of the query processing. Without this decorator, KonText
    cannot return the result - i.e. the result data must be stored to disk to be readable by a client.
    """
    @wraps(func)
    async def wrapper(args: FreqCalcArgs) -> FreqCalcResult:
        cache_path = _cache_file_path(args)

        if await aiofiles.os.path.exists(cache_path):
            async with aiofiles.open(cache_path, 'r') as fr:
                common_md = _CommonMetadata.from_json(await fr.readline())
                data = FreqCalcResult(freqs=[], conc_size=common_md.conc_size)
                blocks = common_md.num_blocks

                for _ in range(blocks):
                    block_md = _BlockMetadata.from_json(await fr.readline())
                    freq = FreqData(
                        Head=block_md.head, Items=[], SkippedEmpty=block_md.skipped_empty,
                        NoRelSorting=block_md.no_rel_sorting)
                    for _ in range(block_md.size):
                        freq.Items.append(FreqItem.from_json(await fr.readline()))
                    data.freqs.append(freq)

        else:
            data: FreqCalcResult = await func(args)
            async with aiofiles.open(cache_path, 'w') as fw:
                common_md = _CommonMetadata(num_blocks=len(data.freqs), conc_size=data.conc_size)
                await fw.write(common_md.to_json() + '\n')
                for freq in data.freqs:
                    block_md = _BlockMetadata(
                        head=[_Head(**x) for x in freq.Head],
                        skipped_empty=freq.SkippedEmpty,
                        no_rel_sorting=freq.NoRelSorting,
                        size=len(freq.Items))
                    await fw.write(block_md.to_json() + '\n')
                    for item in freq.Items:
                        await fw.write(item.to_json() + '\n')

        return data

    return wrapper
