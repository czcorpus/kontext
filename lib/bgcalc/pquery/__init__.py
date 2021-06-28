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

import hashlib
import os.path
from collections import defaultdict
from bgcalc.freq_calc import FreqCalsArgs, calculate_freqs_bg
import l10n
from multiprocessing import Pool
from functools import wraps
from typing import Dict, List
import settings
import csv
from .errors import PqueryResultNotFound, PqueryArgumentError
from typing import Tuple
from argmapping.pquery import PqueryFormArgs
from bgcalc.csv_cache import load_cached_partial, load_cached_full
import logging

"""
This module contains function for calculating Paradigmatic queries
out of existing concordances.
"""


def _create_cache_path(pquery: PqueryFormArgs) -> str:
    corpname = pquery.corpname
    subcname = pquery.usesubcorp
    attr = pquery.attr
    position = pquery.position
    min_freq = pquery.min_freq
    conc_ids = ':'.join(sorted(pquery.conc_ids))
    subset_cond = ':'.join(pquery.conc_subset_complements.conc_ids) if pquery.conc_subset_complements is not None else '-'
    superset_cond = pquery.conc_superset.conc_id if pquery.conc_superset is not None else '-'
    key = f'{corpname}:{subcname}:{conc_ids}:{position}:{attr}:{min_freq}:{subset_cond}:{superset_cond}'
    result_id = hashlib.sha1(key.encode('utf-8')).hexdigest()
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), f'pquery_{result_id}.csv')


def cached(f):
    """
    A decorator for caching freq merge results (using "pickle" serialization)
    """
    @wraps(f)
    def wrapper(pquery: PqueryFormArgs, raw_queries, subcpath, user_id, collator_locale):
        path = _create_cache_path(pquery)

        if os.path.exists(path):
            with open(path, 'r') as fr:
                csv_reader = csv.reader(fr)
                return [item for item in csv_reader]
        else:
            ans = f(pquery, raw_queries, subcpath, user_id, collator_locale)
            num_lines = ans[0][1]
            with open(path, 'w') as fw:
                csv_writer = csv.writer(fw)
                csv_writer.writerow(('__total__', num_lines))
                csv_writer.writerows(ans[1:])
            return ans[1:]

    return wrapper


def _extract_freqs(freqs):
    """
    Extract value and freq information out of complex freq. response data type
    """
    ans = []
    for item in freqs.get('freqs', [{'Items': []}])[0].get('Items'):
        ans.append((item['Word'][0]['n'], item['freq']))
    return ans


def require_existing_pquery(pquery: PqueryFormArgs, offset: int, limit: int,
                            collator_locale: str, sort: str, reverse: bool) -> Tuple[int, List[Tuple[str, int]]]:
    path = _create_cache_path(pquery)
    if not os.path.exists(path):
        raise PqueryResultNotFound('The result does not exist')
    else:
        if sort == 'freq':
            if reverse is True:
                return load_cached_partial(path, offset, limit)
            else:
                total, rows = load_cached_full(path)
                return total, list(reversed(rows))[offset:offset+limit]
        elif sort == 'value':
            total, rows = load_cached_full(path)
            return (total,
                    l10n.sort(rows, key=lambda x: x[0], loc=collator_locale, reverse=reverse)[offset:offset+limit])
        elif sort.startswith('freq-'):
            conc_idx = pquery.conc_ids.index(sort[len('freq-'):])
            total, rows = load_cached_full(path)
            return (total,
                    sorted(rows, key=lambda x: x[conc_idx+1], reverse=reverse))[offset:offset+limit]
        else:
            raise PqueryArgumentError(f'Invalid sort argument: {sort}')


def create_freq_calc_args(pquery: PqueryFormArgs, conc_id: str, raw_queries: Dict[str, str], subcpath: str,
                          user_id: int, collator_locale: str) -> FreqCalsArgs:
    args = FreqCalsArgs()
    attr = pquery.attr
    args.fcrit = [f'{attr} {pquery.position}']
    args.corpname = pquery.corpname
    args.subcname = pquery.usesubcorp
    args.subcpath = subcpath
    args.user_id = user_id
    args.freq_sort = 'freq'
    args.pagesize = 10000  # TODO
    args.fmaxitems = 10000
    args.samplesize = 0
    args.flimit = pquery.min_freq
    args.q = raw_queries[conc_id]
    args.collator_locale = collator_locale
    args.rel_mode = 0 if '.' in attr else 1
    args.ftt_include_empty = False
    return args


@cached
def calc_merged_freqs(pquery: PqueryFormArgs, raw_queries: Dict[str, List[str]], subcpath: str, user_id: int,
                      collator_locale: str):
    """
    Calculate paradigmatic query providing existing concordances.

    pquery --
    raw_queries -- a mapping between conc_id and actual query understood by Manatee
    subcpath -- a root path to user subcorpora
    user_id -- user ID
    collator_locale -- a locale used for collation within the current corpus
    """
    tasks = []
    for conc_id in pquery.conc_ids:
        tasks.append(create_freq_calc_args(
            pquery=pquery, conc_id=conc_id, raw_queries=raw_queries, subcpath=subcpath, user_id=user_id,
            collator_locale=collator_locale))
    with Pool(processes=len(tasks)) as pool:
        specif_done = pool.map_async(calculate_freqs_bg, tasks)
        if pquery.conc_subset_complements:
            cond1_tasks = []
            for conc_id in pquery.conc_subset_complements.conc_ids:
                cond1_tasks.append(create_freq_calc_args(
                    pquery=pquery, conc_id=conc_id, raw_queries=raw_queries, subcpath=subcpath, user_id=user_id,
                    collator_locale=collator_locale))
            cond1_done = pool.map_async(calculate_freqs_bg, cond1_tasks)
        else:
            cond1_done = None
        if pquery.conc_superset:
            args = create_freq_calc_args(
                pquery=pquery, conc_id=pquery.conc_superset.conc_id, raw_queries=raw_queries, subcpath=subcpath,
                user_id=user_id, collator_locale=collator_locale)
            cond2_done = pool.apply_async(calculate_freqs_bg, (args,))
        else:
            cond2_done = None
        specif_data = specif_done.get(timeout=90)
        merged = defaultdict(lambda: [])
        for freq_table in specif_data[:len(pquery.conc_ids)]:
            freq_info = _extract_freqs(freq_table)
            for word, freq in freq_info:
                merged[word].append(freq)
        if cond1_done:
            to_remove = defaultdict(lambda: 0)
            for cond1_item in cond1_done.get(timeout=90):
                cond1_freqs = set(v for v, _ in _extract_freqs(cond1_item))
                for k in merged.keys():
                    if k in cond1_freqs:
                        to_remove[k] += 1
            for k in to_remove.keys():
                if to_remove[k] / sum(merged[k]) * 100 > pquery.conc_subset_complements.max_non_matching_ratio:
                    del merged[k]
        for w in list(merged.keys()):
            if len(merged[w]) < len(pquery.conc_ids):
                del merged[w]
        if cond2_done:
            to_remove = defaultdict(lambda: 0)
            cond2_freqs = defaultdict(lambda: 0, **dict((v, f) for v, f in _extract_freqs(cond2_done.get(timeout=90))))
            for k in merged.keys():
                if cond2_freqs[k] > sum(merged[k]):
                    to_remove[k] = 100 - sum(merged[k]) / cond2_freqs[k] * 100
            for k, v in to_remove.items():
                if v > pquery.conc_superset.max_non_matching_ratio:
                    del merged[k]
    items = list((w, ) + tuple(freq) for w, freq in merged.items())
    total_row = [('total', len(items)) + tuple(None for _ in range(len(pquery.conc_ids) - 1))]
    return total_row + sorted(items, key=lambda v: sum(v[1:]), reverse=True)
