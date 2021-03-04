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
import asyncio
from collections import defaultdict
from bgcalc.freq_calc import FreqCalsArgs, calc_freqs_bg
import l10n


class PqueryCache:

    def __init__(self, root_path):
        self._root_path = root_path

    def _mk_path(self, corpname, subcname, queries, position, attr, min_freq):
        ident = f'{corpname}:{subcname}:{queries}:{position}:{attr}:{min_freq}'
        return 'pquery_{}.pkl'.format(hashlib.sha1(ident.encode('utf-8')).hexdigest())

    def get(self, corpname, subcname, queries, position, attr, min_freq):
        path = self._mk_path(corpname, subcname, queries, position, attr, min_freq)
        if os.path.isfile(path):
            with open(path, 'wb') as f:
                return pickle.load(f)
        return None

    def set(self, corpname, subcname, queries, position, attr, min_freq, data):
        path = self._mk_path(corpname, subcname, queries, position, attr, min_freq, data)
        with open(path, 'wb') as fw:
            pickle.dump(data, fw)


async def task(args: FreqCalsArgs):
    return calc_freqs_bg(args)


def _extract_freqs(freqs):
    ans = []
    for item in freqs.get('freqs', [{'Items': []}])[0].get('Items'):
        ans.append((item['Word'][0]['n'], item['freq']))
    return ans


async def _all_ops(request_json, raw_queries, subcpath, user_id, collator_locale):
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
        args.samplesize = 0
        args.flimit = 0
        args.q = raw_queries[conc_id]
        args.collator_locale = collator_locale
        args.rel_mode = 0 if '.' in attr else 1
        args.ftt_include_empty = False
        args.fmaxitems = 10000

        tasks.append(task(args))
    done, pending = await asyncio.wait(tasks)
    merged = defaultdict(lambda: [])
    for freq_table in done:
        freq_info = _extract_freqs(freq_table.result())
        for word, freq in freq_info:
            merged[word].append(freq)
    items = list((w, sum(freq)) for w, freq in merged.items() if len(freq) == num_tasks)
    return l10n.sort(items, collator_locale, key=lambda v: v[0])


def calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale):
    loop = asyncio.get_event_loop()
    ans = loop.run_until_complete(asyncio.gather(_all_ops(request_json, raw_queries, subcpath, user_id, collator_locale)))
    loop.close()
    return ans[0]
