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
from bgcalc.freq_calc import FreqCalsArgs, calc_freqs_bg
import l10n
from multiprocessing import Pool
from functools import wraps
from typing import Dict, List
import settings
import csv
from .errors import PqueryResultNotFound, PqueryArgumentError
from typing import Tuple
from argmapping.pquery import PqueryFormArgs

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
    key = f'{corpname}:{subcname}:{conc_ids}:{position}:{attr}:{min_freq}'
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


def _load_cached_partial(path, offset, limit):
    with open(path, 'r') as fr:
        csv_reader = csv.reader(fr)
        _, total_str = next(csv_reader)
        for i in range(0, offset):
            next(csv_reader)
        ans = []
        i = offset
        for row in csv_reader:
            if i == offset + limit:
                break
            ans.append((row[0], int(row[1])))
            i += 1
    return int(total_str), ans


def _load_cached_full(path):
    ans = []
    with open(path, 'r') as fr:
        csv_reader = csv.reader(fr)
        _, total_str = next(csv_reader)
        for row in csv_reader:
            ans.append((row[0], int(row[1])))
    return int(total_str), ans


def require_existing_pquery(pquery: PqueryFormArgs, offset: int, limit: int,
                            collator_locale: str, sort: str, reverse: bool) -> Tuple[int, List[Tuple[str, int]]]:
    path = _create_cache_path(pquery)
    if not os.path.exists(path):
        raise PqueryResultNotFound('The result does not exist')
    else:
        if sort == 'freq':
            if reverse is True:
                return _load_cached_partial(path, offset, limit)
            else:
                total, rows = _load_cached_full(path)
                return total, list(reversed(rows))[offset:offset+limit]
        elif sort == 'value':
            total, rows = _load_cached_full(path)
            return (total,
                    l10n.sort(rows, key=lambda x: x[0], loc=collator_locale, reverse=reverse)[offset:offset+limit])
        else:
            raise PqueryArgumentError(f'Invalid sort argument: {sort}')


@cached
def calc_merged_freqs(pquery: PqueryFormArgs, raw_queries: Dict[str, str], subcpath: str, user_id: int,
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
    num_tasks = len(pquery.conc_ids)
    for conc_id in pquery.conc_ids:
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
        tasks.append(args)

    with Pool(processes=num_tasks) as pool:
        done = pool.map(calc_freqs_bg, tasks)

    merged = defaultdict(lambda: [])
    for freq_table in done:
        freq_info = _extract_freqs(freq_table)
        for word, freq in freq_info:
            merged[word].append(freq)
    items = list((w, sum(freq)) for w, freq in merged.items() if len(freq) == num_tasks)
    return [('total', len(items))] + sorted(items, key=lambda v: v[1], reverse=True)
