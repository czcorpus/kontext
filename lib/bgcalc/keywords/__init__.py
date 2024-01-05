# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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
import math
import os
import sys
from dataclasses import dataclass
from functools import wraps
from typing import List, Tuple, Union

import aiofiles
import aiofiles.os
import settings
import ujson as json
from action.argmapping.keywords import KeywordsFormArgs
from bgcalc import wordlist
from bgcalc.jsonl_cache import load_cached_partial
from corplib import manatee_is_custom_cnc
from corplib.corpus import KCorpus
from dataclasses_json import dataclass_json
from manatee import Keyword  # TODO wrap this out

CNC_SCORE_TYPES = ('logL', 'chi2', 'din')
KW_MAX_LIST_SIZE = 500

class KeywordsResultNotFound(Exception):
    pass


def _create_cache_path(form: KeywordsFormArgs) -> str:
    if manatee_is_custom_cnc():
        key = (f'{form.corpname}:{form.usesubcorp}:{form.ref_corpname}:{form.ref_usesubcorp}:{form.wlattr}:{form.wlpat}:'
               f'{form.include_nonwords}:{form.wltype}:{form.wlnums}:{form.wlminfreq}:{form.wlmaxfreq}:{form.score_type}')
    else:
        key = (f'{form.corpname}:{form.usesubcorp}:{form.ref_corpname}:{form.ref_usesubcorp}:{form.wlattr}:{form.wlpat}:'
               f'{form.include_nonwords}:{form.wltype}:{form.wlnums}:{form.wlminfreq}:{form.wlmaxfreq}')

    result_id = hashlib.sha1(key.encode('utf-8')).hexdigest()
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), f'kwords_{result_id}.jsonl')


@dataclass_json
@dataclass
class KeywordLine:
    item: str
    score: float
    frq1: int
    frq2: int
    rel_frq1: float
    rel_frq2: float
    query: str


@dataclass_json
@dataclass
class CNCKeywordLine(KeywordLine):
    logL: float
    chi2: float
    din: float


KeywordsResultType = Union[List[KeywordLine], List[CNCKeywordLine]]


@dataclass_json
@dataclass
class KeywordsResult:
    total: int
    data: KeywordsResultType


async def require_existing_keywords(form: KeywordsFormArgs, offset: int, limit: int) -> KeywordsResult:
    path = _create_cache_path(form)
    if not await aiofiles.os.path.exists(path):
        raise KeywordsResultNotFound('The result does not exist')
    else:
        data = await load_cached_partial(path, offset, limit)
        LineDataClass = CNCKeywordLine if manatee_is_custom_cnc else KeywordLine
        return KeywordsResult(data[0], [LineDataClass.from_dict(item) for item in data[1]])


def cached(f):
    """
    A decorator for caching keywords to a CSV file
    """
    @wraps(f)
    async def wrapper(corp: KCorpus, ref_corp: KCorpus, args: KeywordsFormArgs, max_items: int):
        path = _create_cache_path(args)
        LineDataClass = CNCKeywordLine if manatee_is_custom_cnc else KeywordLine

        if await aiofiles.os.path.exists(path):
            async with aiofiles.open(path, 'r') as fr:
                await fr.readline()
                return [LineDataClass.from_dict(json.loads(item)) async for item in fr]
        else:
            ans = await f(corp, ref_corp, args, sys.maxsize)
            # ans = sorted(ans, key=lambda x: x[1], reverse=True)
            num_lines = len(ans)
            async with aiofiles.open(path, 'w') as fw:
                await fw.write(json.dumps(dict(total=num_lines)) + '\n')
                for item in ans:
                    await fw.write(item.to_json() + '\n')
            return ans[:max_items]

    return wrapper

def filter_nan(v: float, round_num):
    return None if math.isnan(v) else round(v, round_num)

@cached
async def keywords(corp: KCorpus, ref_corp: KCorpus, args: KeywordsFormArgs, max_items: int) -> KeywordsResultType:
    c_wl = corp.get_attr(args.wlattr)
    rc_wl = ref_corp.get_attr(args.wlattr)
    if not args.include_nonwords:
        nwre = corp.get_conf('NONWORDRE')
    else:
        nwre = ''

    attrfreq = await wordlist.get_attrfreq(corp=corp, attr=c_wl, wlattr=args.wlattr, wlnums=args.wlnums)
    wl_items = wordlist.wordlist_by_pattern(
        attr=c_wl, enc_pattern=args.wlpat.strip(), excl_pattern=nwre,
        wlminfreq=args.wlminfreq, pfilter_words=[],
        nfilter_words=[], wlnums=args.wlnums,
        attrfreq=attrfreq)
    words =[x[0] for x in wl_items]

    simple_n = 1.0  # this does not apply for CNC-custom manatee-open keywords
    keyword = Keyword(
        corp.unwrap(), ref_corp.unwrap(), c_wl, rc_wl,
        simple_n, KW_MAX_LIST_SIZE, args.wlminfreq, args.wlmaxfreq, [], words,
        f'frq;{args.score_type}' if manatee_is_custom_cnc() and args.score_type in CNC_SCORE_TYPES else 'frq', [], [], [], None)
    results = []
    kw = keyword.next()
    while kw:
        s = kw.str
        cql = f'[term("{s}")]'
        s = s.replace("_", " ")  # XXX remove in data
        if s.endswith("-x"):  # XXX remove in data
            s = s[:-2]

        if manatee_is_custom_cnc():
            freqs = kw.get_freqs(2 * len([]) + 4 + 4)  # 1 additional slot for size effect
            results.append(CNCKeywordLine(
                item=s,
                score=filter_nan(freqs[4], 3),
                logL=filter_nan(freqs[5], 3),
                chi2=filter_nan(freqs[6], 3),
                din=filter_nan(float(freqs[7]), 5),
                frq1=int(freqs[0]),
                frq2=int(freqs[1]),
                rel_frq1=filter_nan(float(freqs[2]), 5),
                rel_frq2=filter_nan(float(freqs[3]), 5),
                query=cql
            ))
        else:
            freqs = kw.get_freqs(2 * len([]) + 4)
            results.append(KeywordLine(
                item=s,
                score=filter_nan(kw.score, 3),
                frq1=int(freqs[0]),
                frq2=int(freqs[1]),
                rel_frq1=filter_nan(float(freqs[2]), 5),
                rel_frq2=filter_nan(float(freqs[3]), 5),
                query=cql
            ))
        kw = keyword.next()

    return results[:max_items]
