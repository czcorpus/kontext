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
import os
import sys
from functools import wraps
from typing import List, Tuple

import aiofiles
import aiofiles.os
import l10n
import settings
import ujson as json
from action.argmapping.keywords import KeywordsFormArgs
from bgcalc import wordlist
from bgcalc.jsonl_cache import load_cached_full, load_cached_partial
from corplib.corpus import KCorpus
from manatee import Keyword  # TODO wrap this out


class KeywordsResultNotFound(Exception):
    pass


def _create_cache_path(form: KeywordsFormArgs) -> str:
    key = (f'{form.corpname}:{form.usesubcorp}:{form.ref_corpname}:{form.ref_usesubcorp}:{form.wlattr}:{form.wlpat}:'
           f'{form.include_nonwords}:{form.wltype}:{form.wlnums}:{form.wlminfreq}:{form.wlmaxfreq}:{form.score_type}')
    result_id = hashlib.sha1(key.encode('utf-8')).hexdigest()
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), f'kwords_{result_id}.jsonl')


async def require_existing_keywords(
        form: KeywordsFormArgs, kwsort: str, reverse: bool, offset: int, limit: int,
        collator_locale: str) -> Tuple[int, List[Tuple[str, int]]]:
    path = _create_cache_path(form)
    if not await aiofiles.os.path.exists(path):
        raise KeywordsResultNotFound('The result does not exist')
    else:
        if kwsort == 'score' and reverse:
            return await load_cached_partial(path, offset, limit)

        else:
            total, rows = await load_cached_full(path)
            # handle number sort
            if kwsort in ('score', 'size_effect', 'frq1', 'frq2', 'rel_frq1', 'rel_frq2'):
                return (
                    total,
                    sorted(rows, key=lambda x: x[kwsort], reverse=reverse)[offset:offset + limit]
                )
            # handle string sort
            elif kwsort in ('item', 'query'):
                return (
                    total,
                    l10n.sort(rows, key=lambda x: x[kwsort], loc=collator_locale, reverse=reverse)[
                        offset:offset + limit]
                )
            # default sort
            return (
                total,
                l10n.sort(rows, key=lambda x: x[0], loc=collator_locale, reverse=reverse)[
                    offset:offset + limit]
            )


def cached(f):
    """
    A decorator for caching keywords to a CSV file
    """
    @wraps(f)
    async def wrapper(corp: KCorpus, ref_corp: KCorpus, args: KeywordsFormArgs, max_items: int):
        path = _create_cache_path(args)

        if await aiofiles.os.path.exists(path):
            async with aiofiles.open(path, 'r') as fr:
                await fr.readline()
                return [json.loads(item) async for item in fr]
        else:
            ans = await f(corp, ref_corp, args, sys.maxsize)
            # ans = sorted(ans, key=lambda x: x[1], reverse=True)
            num_lines = len(ans)
            async with aiofiles.open(path, 'w') as fw:
                await fw.write(json.dumps(dict(total=num_lines)) + '\n')
                for item in ans:
                    await fw.write(json.dumps(item) + '\n')
            return ans[:max_items]

    return wrapper


@cached
async def keywords(corp: KCorpus, ref_corp: KCorpus, args: KeywordsFormArgs, max_items: int) -> List[Tuple[str, int]]:
    c_wl = corp.get_attr(args.wlattr)
    rc_wl = ref_corp.get_attr(args.wlattr)
    if not args.include_nonwords:
        nwre = corp.get_conf('NONWORDRE')
    else:
        nwre = ''

    attrfreq = await wordlist._get_attrfreq(corp=corp, attr=c_wl, wlattr=args.wlattr, wlnums=args.wlnums)
    wl_items = wordlist._wordlist_by_pattern(
        attr=c_wl, enc_pattern=args.wlpat.strip(), excl_pattern=nwre,
        wlminfreq=args.wlminfreq, pfilter_words=[],
        nfilter_words=[], wlnums=args.wlnums,
        attrfreq=attrfreq)
    words = set(x[0] for x in wl_items)

    ref_attrfreq = await wordlist._get_attrfreq(corp=ref_corp, attr=rc_wl, wlattr=args.wlattr, wlnums=args.wlnums)
    ref_wl_items = wordlist._wordlist_by_pattern(
        attr=rc_wl, enc_pattern=args.wlpat.strip(), excl_pattern=nwre,
        wlminfreq=args.wlminfreq, pfilter_words=[],
        nfilter_words=[], wlnums=args.wlnums,
        attrfreq=ref_attrfreq)

    # analyze only words contained in both focus and reference corpora
    words = list(words.intersection(x[0] for x in ref_wl_items))

    simple_n = 1.0  # this does not apply for CNC-custom manatee-open keywords
    keyword = Keyword(
        corp.unwrap(), ref_corp.unwrap(), c_wl, rc_wl,
        simple_n, 100, args.wlminfreq, args.wlmaxfreq, [], words,
        f'frq;{args.score_type}' if args.score_type else 'frq', [], [], [], None)
    results = []
    kw = keyword.next()
    while kw:
        s = kw.str
        item = {}
        cql = f'[term("{s}")]'
        s = s.replace("_", " ")  # XXX remove in data
        if s.endswith("-x"):  # XXX remove in data
            s = s[:-2]
        freqs = kw.get_freqs(2 * len([]) + 4 + 1)  # 1 additional slot for size effect
        item.update({'item': s,
                     'score': round(kw.score, 3),
                     'size_effect': round(float(freqs[4]), 5),
                     'frq1': int(freqs[0]),
                     'frq2': int(freqs[1]),
                     'rel_frq1': round(float(freqs[2]), 5),
                     'rel_frq2': round(float(freqs[3]), 5),
                     'query': cql})
        results.append(item)
        kw = keyword.next()

    return results[:max_items]
