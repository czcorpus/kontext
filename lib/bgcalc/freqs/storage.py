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
import os
from dataclasses import dataclass
from functools import wraps
from typing import Callable, Coroutine, List, Optional, Tuple, TypedDict, Union
import logging

import settings
import ujson as json
from bgcalc.errors import BgCalcError
from bgcalc.freqs.types import FreqCalcArgs, FreqCalcResult
from conclib.freq import FreqData, FreqItem
from dataclasses_json import dataclass_json

MAX_DATA_LEN_DIRECT_PROVIDING = 500


def _cache_dir_path(args: FreqCalcArgs) -> str:
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), args.corpname)


def norm_list(v: Union[Tuple, List]) -> List:
    """
    This is used for normalizing lists and tuples
    to generate proper hashes for cache files
    (.e.g. str(('foo')) produces different result
    than str(['foo']))
    """
    if type(v) is None:
        return []
    if type(v) is tuple:
        return list(v)
    return v


def _cache_file_path(args: FreqCalcArgs):
    v = ''.join([
        str(args.corpname),
        str(args.subcname),
        str(args.user_id),
        ''.join(norm_list(args.q)),
        str(norm_list(args.fcrit)),
        str(args.flimit),
        str(args.freq_sort),
        str(args.rel_mode),
        str(args.collator_locale),
    ])
    filename = '{}.jsonl'.format(hashlib.sha1(v.encode('utf-8')).hexdigest())
    return os.path.join(_cache_dir_path(args), filename)


class _Head(TypedDict):
    n: str
    s: str
    title: str


@dataclass_json
@dataclass
class BlockMetadata:
    head: List[_Head]
    skipped_empty: bool
    no_rel_sorting: bool
    size: int


@dataclass_json
@dataclass
class CommonMetadata:
    num_blocks: int
    conc_size: int


def find_cached_result(args: FreqCalcArgs) -> Tuple[Optional[FreqCalcResult], str]:
    cache_path = _cache_file_path(args)
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as fr:
            common_md = CommonMetadata.from_dict(json.loads(fr.readline()))
            data = FreqCalcResult(freqs=[], conc_size=common_md.conc_size)
            blocks = common_md.num_blocks
            first_line = (args.fpage - 1) * args.fpagesize
            last_line = first_line + args.fpagesize - 1
            for _ in range(blocks):
                block_md = BlockMetadata.from_dict(json.loads(fr.readline()))
                freq = FreqData(
                    Head=block_md.head, Items=[], SkippedEmpty=block_md.skipped_empty,
                    NoRelSorting=block_md.no_rel_sorting, Size=block_md.size)
                for i in range(block_md.size):
                    raw_line = fr.readline()
                    if i < first_line:
                        continue
                    if i > last_line:
                        break
                    freq.Items.append(FreqItem.from_dict(json.loads(raw_line)))
                data.freqs.append(freq)
        return data, cache_path
    return None, cache_path


def stored_to_fs(func: Callable[[FreqCalcArgs], Coroutine[None, None, FreqCalcResult]]):
    """
    A decorator for storing freq merge results (as JSONL files). Please note that this is not just
    caching but rather an essential part of the query processing. Without this decorator, KonText
    cannot return the result - i.e. the result data must be stored to disk to be readable by a client.
    Please note that the function also checks for data size (num. of result rows) and in case it is
    more than MAX_DATA_LEN_DIRECT_PROVIDING, it sets the result to None (attr `freqs`) and instead
    sets the `data_path` argument so client can read the data directly from a corresponding file.
    """
    @wraps(func)
    async def wrapper(args: FreqCalcArgs) -> FreqCalcResult:
        data, cache_path = find_cached_result(args)
        if data is None:
            logging.getLogger(__name__).debug(
                '@stored_to_fs - cache miss for crit: {}, q: {}, corp: {}'.format(args.fcrit, args.q, args.corpname))
            cache_dir = _cache_dir_path(args)
            if not os.path.isdir(cache_dir):
                os.makedirs(cache_dir)
                os.chmod(cache_dir, 0o775)

            data: FreqCalcResult = await func(args)
            with open(cache_path, 'w') as bw:
                common_md = CommonMetadata(num_blocks=len(data.freqs), conc_size=data.conc_size)
                bw.write(json.dumps(common_md.to_dict()) + '\n')
                max_len = 0
                if data.freqs is None:
                    raise BgCalcError('FreqCalcResult instance does not provide direct data')
                for block in data.freqs:
                    data_len = len(block.Items)
                    if data_len > max_len:
                        max_len = data_len
                    block_md = BlockMetadata(
                        head=[_Head(**x) for x in block.Head],
                        skipped_empty=block.SkippedEmpty,
                        no_rel_sorting=block.NoRelSorting,
                        size=data_len)
                    bw.write(json.dumps(block_md.to_dict()) + '\n')
                    for item in block.Items:
                        bw.write(json.dumps(item.to_dict()) + '\n')
                if data_len >= MAX_DATA_LEN_DIRECT_PROVIDING:
                    data.fs_stored_data = True
                    data.freqs = None
        return data
    return wrapper
