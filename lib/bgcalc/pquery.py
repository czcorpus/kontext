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

import pickle
import hashlib
import os.path
from collections import defaultdict
from bgcalc.freq_calc import FreqCalsArgs, calc_freqs_bg
import l10n
from multiprocessing import Pool
from functools import wraps
from typing import Dict, Any
import settings

"""
This module contains function for calculating Paradigmatic queries
out of existing concordances.
"""


def cached(f):
    """
    A decorator for caching freq merge results (using "pickle" serialization)
    """
    @wraps(f)
    def wrapper(request_json, raw_queries, subcpath, user_id, collator_locale):
        corpname = request_json['corpname']
        subcname = request_json['usesubcorp']
        attr = request_json['attr']
        posIndex = request_json['posIndex']
        posAlign = request_json['posAlign']
        min_freq = request_json['min_freq']
        conc_ids = ':'.join(request_json['conc_ids'])

        key = f'{corpname}:{subcname}:{conc_ids}:{posIndex}:{posAlign}:{attr}:{min_freq}'
        path = os.path.join(settings.get('corpora', 'freqs_cache_dir'),
                            'pquery_{}.pkl'.format(hashlib.sha1(key.encode('utf-8')).hexdigest()))
        if os.path.exists(path):
            with open(path, 'rb') as fr:
                return pickle.load(fr)
        ans = f(request_json, raw_queries, subcpath, user_id, collator_locale)
        with open(path, 'wb') as fw:
            pickle.dump(ans, fw)
        return ans
    return wrapper


def _extract_freqs(freqs):
    """
    Extract value and freq information out of complex freq. response data type
    """
    ans = []
    for item in freqs.get('freqs', [{'Items': []}])[0].get('Items'):
        ans.append((item['Word'][0]['n'], item['freq']))
    return ans


@cached
def calc_merged_freqs(request_json: Dict[str, Any], raw_queries: Dict[str, str], subcpath: str, user_id: int,
                      collator_locale: str):
    """
    Calculate paradigmatic query providing existing concordances.

    request_json -- submit data as received by the client (see
                    models.pquery.common.FreqIntersectionArgs)
    raw_queries -- a mapping between conc_id and actual query understood by Manatee
    subcpath -- a root path to user subcorpora
    user_id -- user ID
    collator_locale -- a locale used for collation within the current corpus
    """
    tasks = []
    num_tasks = len(request_json.get('conc_ids', []))
    for conc_id in request_json.get('conc_ids', []):
        args = FreqCalsArgs()
        attr = request_json.get('attr')
        args.fcrit = [f'{attr} {request_json.get("position")}']
        args.corpname = request_json['corpname']
        args.subcname = request_json['usesubcorp']
        args.subcpath = subcpath
        args.user_id = user_id
        args.freq_sort = 'freq'
        args.pagesize = 10000  # TODO
        args.fmaxitems = 10000
        args.samplesize = 0
        args.flimit = request_json['min_freq']
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
    return l10n.sort(items, collator_locale, key=lambda v: v[0])
