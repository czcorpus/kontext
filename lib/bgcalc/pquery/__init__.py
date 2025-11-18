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

import asyncio
from collections import defaultdict
from typing import Dict, List, Optional

from action.argmapping.pquery import PqueryFormArgs
from bgcalc.errors import BgCalcError
from bgcalc.freqs import FreqCalcArgs, calculate_freqs_bg
from bgcalc.freqs.types import FreqCalcResult
from bgcalc.freqs.storage import find_cached_result
from bgcalc.pquery.storage import stored_to_fs

"""
This module contains function for calculating Paradigmatic queries
out of existing concordances.
"""

SUBTASK_TIMEOUT_SECS = 120  # please note that this may collide with config.xml's calc_backend.task_time_limit


def extract_freqs(data: FreqCalcResult):
    """
    Extract value and freq information out of complex freq. response data type
    """
    ans = []
    for item in data.freqs[0].Items:
        ans.append((item.Word[0]['n'], item.freq))
    return ans


def create_freq_calc_args(
        pquery: PqueryFormArgs, conc_id: str, raw_queries: Dict[str, List[str]], subcpath: str,
        user_id: int, collator_locale: str, flimit_override: Optional[int] = None) -> FreqCalcArgs:
    attr = pquery.attr
    return FreqCalcArgs(
        fcrit=[f'{attr} {pquery.position}'],
        corpname=pquery.corpname,
        subcname=pquery.usesubcorp,
        subcpath=subcpath,
        user_id=user_id,
        freq_sort='freq',
        cutoff=0,
        flimit=flimit_override if flimit_override is not None else pquery.min_freq,
        fpage=1,
        fpagesize=10000,
        q=raw_queries[conc_id],
        collator_locale=collator_locale,
        rel_mode=0 if '.' in attr else 1)


@stored_to_fs
async def calc_merged_freqs(
        _,
        pquery: PqueryFormArgs,
        raw_queries: Dict[str, List[str]],
        subcpath: str,
        user_id: int,
        collator_locale: str):
    """
    Calculate paradigmatic query providing existing concordances. Althought the calculation
    consists of multiple independent freq. distrib. calculations, several tests have shown
    that there is almost no gain from running the calculations in parallel. So we stick with
    async Tasks by default. But for testing/benchmarking purposes, there are also some
    alternative implementations is the 'extra' package.

    pquery --
    raw_queries -- a mapping between conc_id and actual query understood by Manatee
    subcpath -- a root path to user subcorpora
    user_id -- user ID
    collator_locale -- a locale used for collation within the current corpus
    """
    specif_args = []
    specif_futures = []
    for conc_id in pquery.conc_ids:
        freq_args = create_freq_calc_args(
            pquery=pquery, conc_id=conc_id, raw_queries=raw_queries, subcpath=subcpath, user_id=user_id,
            collator_locale=collator_locale)
        specif_args.append(freq_args)
        specif_futures.append(asyncio.create_task(calculate_freqs_bg(freq_args)))

    # calculate auxiliary data for the "(almost) never" condition
    cond1_args = []
    cond1_futures = []
    if pquery.conc_subset_complements:
        for conc_id in pquery.conc_subset_complements.conc_ids:
            freq_args = create_freq_calc_args(
                pquery=pquery, conc_id=conc_id, raw_queries=raw_queries, subcpath=subcpath, user_id=user_id,
                collator_locale=collator_locale, flimit_override=1)
            cond1_args.append(freq_args)
            cond1_futures.append(asyncio.create_task(calculate_freqs_bg(freq_args)))

    # calculate auxiliary data (the superset here) for the "(almost) always" condition
    cond2_args = None
    cond2_future = None
    if pquery.conc_superset:
        freq_args = create_freq_calc_args(
            pquery=pquery, conc_id=pquery.conc_superset.conc_id, raw_queries=raw_queries, subcpath=subcpath,
            user_id=user_id, collator_locale=collator_locale)
        cond2_args = freq_args
        cond2_future = asyncio.create_task(calculate_freqs_bg(freq_args))

    # merge frequencies of individual realizations
    realizations = await asyncio.gather(*specif_futures)
    merged = defaultdict(lambda: [])
    for freq_table, args in zip(realizations, specif_args):
        if freq_table.fs_stored_data:
            freq_table, _ = find_cached_result(args)
            if freq_table is None:
                raise BgCalcError('Failed to get expected freqs result')
        freq_info = extract_freqs(freq_table)
        for word, freq in freq_info:
            merged[word].append(freq)
    for w in list(merged.keys()):
        if len(merged[w]) < len(pquery.conc_ids):  # all the realizations must be present
            del merged[w]

    if len(cond1_futures) > 0:
        # ask for the results of the "(almost) never"
        # and filter out values with too high ratio of "opposite examples"
        complements = defaultdict(lambda: 0)
        cond1_results: List[FreqCalcResult] = await asyncio.gather(*cond1_futures)
        for freq_table, args in zip(cond1_results, cond1_args):
            if freq_table.fs_stored_data:
                result, _ = find_cached_result(args)
                if result is None:
                    raise BgCalcError('Failed to get expected freqs result')
            for v, freq in extract_freqs(freq_table):
                complements[v] += freq
        for k in [k2 for k2 in merged.keys() if k2 in complements]:
            ratio = complements[k] / (sum(merged[k]) + complements[k])
            if ratio * 100 > pquery.conc_subset_complements.max_non_matching_ratio:
                del merged[k]

    if cond2_future is not None:
        # ask for the results of the "(almost) always"
        # and filter out values found as extra instances too many times in the superset
        result: FreqCalcResult = await cond2_future
        if result.fs_stored_data:
            result, _ = find_cached_result(cond2_args)
            if result is None:
                raise BgCalcError('Failed to get expected freqs result')
        cond2_freqs = defaultdict(
            lambda: 0, **dict((v, f) for v, f in extract_freqs(result)))
        for k in list(merged.keys()):
            if cond2_freqs[k] == 0:  # => not in superset
                del merged[k]
            elif cond2_freqs[k] > sum(merged[k]):  # if there are extra instances in the superset
                ratio = 100 - sum(merged[k]) / cond2_freqs[k] * 100
                if ratio > pquery.conc_superset.max_non_matching_ratio:
                    del merged[k]

    items = list((w, ) + tuple(freq) for w, freq in merged.items())
    total_row = [('total', len(items)) + tuple(None for _ in range(len(pquery.conc_ids) - 1))]
    return total_row + sorted(items, key=lambda v: sum(v[1:]), reverse=True)
