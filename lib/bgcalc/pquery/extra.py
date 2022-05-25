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

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from typing import Dict, List

from action.argmapping.pquery import PqueryFormArgs
from bgcalc.adapter.abstract import AbstractBgClient
from bgcalc.freqs import calculate_freqs_bg_sync
from bgcalc.pquery import (SUBTASK_TIMEOUT_SECS, create_freq_calc_args,
                           extract_freqs)
from bgcalc.pquery.storage import stored_to_fs
from conclib.calc import require_existing_conc
from corplib import CorpusManager


@stored_to_fs
async def calc_merged_freqs_worker(
        worker: AbstractBgClient,
        pquery: PqueryFormArgs,
        raw_queries: Dict[str, List[str]],
        subcpath: List[str],
        user_id: int,
        collator_locale: str):

    specif_futures = []
    for conc_id in pquery.conc_ids:
        freq_args = create_freq_calc_args(
            pquery=pquery, conc_id=conc_id, raw_queries=raw_queries, subcpath=subcpath, user_id=user_id,
            collator_locale=collator_locale)
        specif_futures.append(await worker.send_task('calculate_freqs', object.__class__, (asdict(freq_args), )))

    # calculate auxiliary data for the "(almost) never" condition
    cond1_futures = []
    if pquery.conc_subset_complements:
        for conc_id in pquery.conc_subset_complements.conc_ids:
            freq_args = create_freq_calc_args(
                pquery=pquery, conc_id=conc_id, raw_queries=raw_queries, subcpath=subcpath, user_id=user_id,
                collator_locale=collator_locale, flimit_override=1)
            cond1_futures.append(await worker.send_task('calculate_freqs', object.__class__, (asdict(freq_args), )))
    # calculate auxiliary data (the superset here) for the "(almost) always" condition
    cond2_future = None
    if pquery.conc_superset:
        freq_args = create_freq_calc_args(
            pquery=pquery, conc_id=pquery.conc_superset.conc_id, raw_queries=raw_queries, subcpath=subcpath,
            user_id=user_id, collator_locale=collator_locale)
        cond2_future = await worker.send_task('calculate_freqs', object.__class__, (asdict(freq_args), ))

    # merge frequencies of individual realizations
    merged = defaultdict(lambda: [])
    for freq_table in [f.get(timeout=SUBTASK_TIMEOUT_SECS) for f in specif_futures]:
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
        for cond1_item in [f.get(timeout=SUBTASK_TIMEOUT_SECS) for f in cond1_futures]:
            for v, freq in extract_freqs(cond1_item.result()):
                complements[v] += freq
        for k in [k2 for k2 in merged.keys() if k2 in complements]:
            ratio = complements[k] / (sum(merged[k]) + complements[k])
            if ratio * 100 > pquery.conc_subset_complements.max_non_matching_ratio:
                del merged[k]
    if cond2_future is not None:
        # ask for the results of the "(almost) always"
        # and filter out values found as extra instances too many times in the superset
        cond2_freqs = defaultdict(
            lambda: 0, **dict((v, f) for v, f in extract_freqs(cond2_future.get(timeout=SUBTASK_TIMEOUT_SECS))))
        for k in list(merged.keys()):
            if cond2_freqs[k] == 0:  # => not in superset
                del merged[k]
            elif cond2_freqs[k] > sum(merged[k]):  # if there are extra instances in the superset
                ratio = 100 - sum(merged[k]) / cond2_freqs[k] * 100
                if ratio > pquery.conc_superset.max_non_matching_ratio:
                    del merged[k]

    items = list((w,) + tuple(freq) for w, freq in merged.items())
    total_row = [('total', len(items)) + tuple(None for _ in range(len(pquery.conc_ids) - 1))]
    return total_row + sorted(items, key=lambda v: sum(v[1:]), reverse=True)


@stored_to_fs
async def calc_merged_freqs_threaded(
        _,
        pquery: PqueryFormArgs,
        raw_queries: Dict[str, List[str]],
        subcpath: List[str],
        user_id: int,
        collator_locale: str):
    """
    Calculate paradigmatic query providing existing concordances.

    pquery --
    raw_queries -- a mapping between conc_id and actual query understood by Manatee
    subcpath -- a root path to user subcorpora
    user_id -- user ID
    collator_locale -- a locale used for collation within the current corpus
    """
    cm = CorpusManager(subcpath=subcpath)
    corp = await cm.get_corpus(pquery.corpname, subcname=pquery.usesubcorp)

    with ThreadPoolExecutor(max_workers=len(pquery.conc_ids)) as executor:
        specif_futures = []
        for conc_id in pquery.conc_ids:
            freq_args = create_freq_calc_args(
                pquery=pquery, conc_id=conc_id, raw_queries=raw_queries, subcpath=subcpath, user_id=user_id,
                collator_locale=collator_locale)
            conc = await require_existing_conc(corp, freq_args.q)
            specif_futures.append(executor.submit(calculate_freqs_bg_sync, freq_args, conc))

        # calculate auxiliary data for the "(almost) never" condition
        cond1_futures = []
        if pquery.conc_subset_complements:
            for conc_id in pquery.conc_subset_complements.conc_ids:
                freq_args = create_freq_calc_args(
                    pquery=pquery, conc_id=conc_id, raw_queries=raw_queries, subcpath=subcpath, user_id=user_id,
                    collator_locale=collator_locale, flimit_override=1)
                conc = await require_existing_conc(corp, freq_args.q)
                cond1_futures.append(executor.submit(calculate_freqs_bg_sync, freq_args, conc))
        # calculate auxiliary data (the superset here) for the "(almost) always" condition
        cond2_future = None
        if pquery.conc_superset:
            freq_args = create_freq_calc_args(
                pquery=pquery, conc_id=pquery.conc_superset.conc_id, raw_queries=raw_queries, subcpath=subcpath,
                user_id=user_id, collator_locale=collator_locale)
            conc = await require_existing_conc(corp, freq_args.q)
            cond2_future = executor.submit(calculate_freqs_bg_sync, freq_args, conc)

        # merge frequencies of individual realizations
        realizations = as_completed(specif_futures, timeout=SUBTASK_TIMEOUT_SECS)
        merged = defaultdict(lambda: [])
        for freq_table in realizations:
            freq_info = extract_freqs(freq_table.result())
            for word, freq in freq_info:
                merged[word].append(freq)
        for w in list(merged.keys()):
            if len(merged[w]) < len(pquery.conc_ids):  # all the realizations must be present
                del merged[w]
        if len(cond1_futures) > 0:
            # ask for the results of the "(almost) never"
            # and filter out values with too high ratio of "opposite examples"
            complements = defaultdict(lambda: 0)
            for cond1_item in as_completed(cond1_futures, timeout=SUBTASK_TIMEOUT_SECS):
                for v, freq in extract_freqs(cond1_item.result()):
                    complements[v] += freq
            for k in [k2 for k2 in merged.keys() if k2 in complements]:
                ratio = complements[k] / (sum(merged[k]) + complements[k])
                if ratio * 100 > pquery.conc_subset_complements.max_non_matching_ratio:
                    del merged[k]
        if cond2_future is not None:
            # ask for the results of the "(almost) always"
            # and filter out values found as extra instances too many times in the superset
            cond2_freqs = defaultdict(
                lambda: 0, **dict((v, f) for v, f in extract_freqs(cond2_future.result(timeout=SUBTASK_TIMEOUT_SECS))))
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
