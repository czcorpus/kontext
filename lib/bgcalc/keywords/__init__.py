# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Department of Linguistics
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
from dataclasses import dataclass
from functools import wraps
from typing import List, Union

import aiofiles
import aiofiles.os
import settings
import ujson as json
from action.argmapping.keywords import KeywordsFormArgs
from bgcalc import wordlist
from bgcalc.jsonl_cache import load_cached_partial
from corplib import manatee_is_custom_cnc
from corplib.errors import MissingSubCorpFreqFile
from corplib.corpus import KCorpus
from corplib.abstract import AbstractKCorpus
from dataclasses_json import dataclass_json
from manatee import Keyword  # TODO wrap this out

CNC_SCORE_TYPES = ('logL', 'chi2', 'din')


class KeywordsResultNotFound(Exception):
    pass


def _cache_dir_path(form: KeywordsFormArgs) -> str:
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), form.corpname)


def _create_cache_path(form: KeywordsFormArgs) -> str:
    if manatee_is_custom_cnc():
        key = (f'{form.corpname}:{form.usesubcorp}:{form.ref_corpname}:{form.ref_usesubcorp}:{form.wlattr}:{form.wlpat}:'
               f'{form.include_nonwords}:{form.wltype}:{form.wlnums}:{form.wlminfreq}:{form.wlmaxfreq}:{form.score_type}:'
               f'{form.filter_type}:{form.filter_min_value}:{form.filter_max_value}')
    else:
        key = (f'{form.corpname}:{form.usesubcorp}:{form.ref_corpname}:{form.ref_usesubcorp}:{form.wlattr}:{form.wlpat}:'
               f'{form.include_nonwords}:{form.wltype}:{form.wlnums}:{form.wlminfreq}:{form.wlmaxfreq}')

    result_id = hashlib.sha1(key.encode('utf-8')).hexdigest()
    return os.path.join(_cache_dir_path(form), f'kwords_{result_id}.jsonl')


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
    din_ranking_warning: bool = False


async def require_existing_keywords(form: KeywordsFormArgs, offset: int, limit: int) -> KeywordsResult:
    path = _create_cache_path(form)
    if not await aiofiles.os.path.exists(path):
        raise KeywordsResultNotFound('The result does not exist')
    else:
        data = load_cached_partial(path, offset, limit)
        LineDataClass = CNCKeywordLine if manatee_is_custom_cnc else KeywordLine
        ans = KeywordsResult(data[0], [LineDataClass.from_dict(item) for item in data[1]])
        if form.ref_corpname == form.corpname and form.usesubcorp and not form.ref_usesubcorp:
            num_same_freq = 0
            for row in ans.data:
                if row.frq1 == row.frq2:
                    num_same_freq += 1
            if num_same_freq > 1:
                ans.din_ranking_warning = True
        return ans



def cached(f):
    """
    A decorator for caching keywords to a CSV file
    """
    @wraps(f)
    async def wrapper(corp: KCorpus, ref_corp: KCorpus, args: KeywordsFormArgs, max_items: int):
        path = _create_cache_path(args)
        LineDataClass = CNCKeywordLine if manatee_is_custom_cnc else KeywordLine

        if await aiofiles.os.path.exists(path):
            with open(path, 'r') as fr:
                fr.readline()
                return [LineDataClass.from_dict(json.loads(item)) for item in fr][:max_items]
        else:
            cache_dir = _cache_dir_path(args)
            if not await aiofiles.os.path.isdir(cache_dir):
                await aiofiles.os.makedirs(cache_dir)
                os.chmod(cache_dir, 0o775)

            ans = await f(corp, ref_corp, args, max_items)
            # ans = sorted(ans, key=lambda x: x[1], reverse=True)
            num_lines = len(ans)
            with open(path, 'w') as bw:
                bw.write(json.dumps(dict(total=num_lines)) + '\n')
                for item in ans:
                    bw.write(item.to_json() + '\n')
            return ans[:max_items]

    return wrapper


def filter_nan(v: float, round_num):
    return None if math.isnan(v) else round(v, round_num)


@cached
async def keywords(
        corp: AbstractKCorpus,
        ref_corp: AbstractKCorpus,
        args: KeywordsFormArgs,
        max_items: int
) -> KeywordsResultType:
    c_wl = corp.get_attr(args.wlattr)
    rc_wl = ref_corp.get_attr(args.wlattr)

    # check for precalculated freq. data in case ref. corpus is a subcorpus
    # for the main corpus, this is handled by the get_attrfreq call below
    if ref_corp.subcorpus_id:
        filename = ref_corp.freq_precalc_file(args.wlattr, 'frq')
        if not os.path.isfile(filename):
            pass
            raise MissingSubCorpFreqFile(
                "auxiliary freq file not available", ref_corp.corpname, ref_corp.subcorpus_id)

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
    words = [x[0] for x in wl_items]

    # in case no words are found return empty result
    # (empty whitelist in keywords would return all words from focus corpus)
    if len(words) == 0:
        return []

    simple_n = 1.0  # this does not apply for CNC-custom manatee-open keywords
    manatee_params = 'frq'
    if manatee_is_custom_cnc():
        manatee_params += f';{args.score_type}' if args.score_type in CNC_SCORE_TYPES else ';default'
        if args.filter_type and args.filter_type in CNC_SCORE_TYPES:
            manatee_params += f';{args.filter_type}/{'' if args.filter_min_value is None else args.filter_min_value}/{'' if args.filter_max_value is None else args.filter_max_value}'

    keyword = Keyword(
        corp.unwrap(), ref_corp.unwrap(), c_wl, rc_wl,
        simple_n, max_items, args.wlminfreq, args.wlmaxfreq, [], words,
        manatee_params, [], [], [], None)
    results = []
    kw = keyword.next()
    while kw:
        s = kw.str
        cql = f'[term("{s}")]'
        s = s.replace("_", " ")  # XXX remove in data
        if s.endswith("-x"):  # XXX remove in data
            s = s[:-2]

        if manatee_is_custom_cnc():
            freqs = kw.get_freqs(2 * len([]) + 4 + 4)  # 4 additional score slots
            results.append(CNCKeywordLine(
                item=s,
                score=filter_nan(freqs[4], 3),  # manatee score
                logL=filter_nan(freqs[5], 3),  # additional logL score
                chi2=filter_nan(freqs[6], 3),  # additional chi2 score
                din=filter_nan(float(freqs[7]), 5),  # additional din score
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
                score=filter_nan(kw.score, 3),  # manatee score
                frq1=int(freqs[0]),
                frq2=int(freqs[1]),
                rel_frq1=filter_nan(float(freqs[2]), 5),
                rel_frq2=filter_nan(float(freqs[3]), 5),
                query=cql
            ))
        kw = keyword.next()

    return results[:max_items]
