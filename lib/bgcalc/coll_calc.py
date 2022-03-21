# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import os
import time
from typing import List, Any, Optional
from dataclasses import dataclass, field

import corplib
from conclib.calc import require_existing_conc
from corplib.errors import MissingSubCorpFreqFile
from bgcalc import freq_calc
import settings
from bgcalc.errors import UnfinishedConcordanceError
import bgcalc

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


@dataclass
class CollCalcArgs:
    """
    Collects all the required arguments passed around when
    calculating collocation profiles.
    """
    q: List[str]
    user_id: int
    corpname: str
    corpus_encoding: str
    collpage: int
    citemsperpage: int
    cattr: str
    csortfn: str
    cbgrfns: str
    cfromw: int
    ctow: int
    cminbgr: int
    cminfreq: int
    subcname: Optional[str]
    subcpath: List[str] = field(default_factory=list)
    cache_path: Optional[str] = field(default=None)
    samplesize: int = field(default=0)


class CollCalcCache(object):

    def __init__(self, corpname, subcname, subcpath, user_id, q, samplesize=0):
        self._corpname = corpname
        self._subcname = subcname
        self._subcpath = subcpath
        self._user_id = user_id
        self._q = q
        self._samplesize = samplesize

    def _cache_file_path(self, cattr, csortfn, cbgrfns, cfromw, ctow, cminbgr, cminfreq):
        v = f'{self._corpname}{self._subcname}{self._user_id}{"".join(self._q)}{cattr}{csortfn}{cbgrfns}{cfromw}{ctow}{cminbgr}{cminbgr}{cminfreq}'
        filename = f'{hashlib.sha1(v.encode("utf-8")).hexdigest()}.pkl'
        return os.path.join(settings.get('corpora', 'colls_cache_dir'), filename)

    def get(self, cattr, csortfn, cbgrfns, cfromw, ctow, cminbgr, cminfreq):
        """
        Get value from cache.

        returns:
        a 2-tuple (cached_data, cache_path)  where cached_data is None in case of cache miss
        """
        cache_path = self._cache_file_path(cattr=cattr, csortfn=csortfn, cbgrfns=cbgrfns, cfromw=cfromw, ctow=ctow,
                                           cminbgr=cminbgr, cminfreq=cminfreq)
        if os.path.isfile(cache_path):
            with open(cache_path, 'rb') as f:
                collocs = pickle.load(f)
        else:
            collocs = None
        return collocs, cache_path


# TODO !!!! FIX (missing user-id, deprecated handling of MissingSubCorpFreqFile
def calculate_colls_bg(coll_args: CollCalcArgs):
    """
    Background collocations calculation running on a worker server.
    In case auxiliary data files are needed and not present already
    (MissingSubCorpFreqFile exception), the function triggers
    a respective calculation.
    """
    cm = corplib.CorpusManager(subcpath=coll_args.subcpath)
    corp = cm.get_corpus(coll_args.corpname, subcname=coll_args.subcname)
    try:
        # try to fetch precalculated data; if none then MissingSubCorpFreqFile
        corplib.frq_db(corp, coll_args.cattr)
        conc = require_existing_conc(corp=corp, q=coll_args.q)
        if not conc.finished():
            raise UnfinishedConcordanceError(
                'Cannot calculate yet - source concordance not finished. Please try again later.')
        collocs = conc.collocs(cattr=coll_args.cattr, csortfn=coll_args.csortfn, cbgrfns=coll_args.cbgrfns,
                               cfromw=coll_args.cfromw, ctow=coll_args.ctow, cminfreq=coll_args.cminfreq,
                               cminbgr=coll_args.cminbgr, max_lines=conc.size())
        for item in collocs['Items']:
            item['pfilter'] = {'q2': item['pfilter']}
            item['nfilter'] = {'q2': item['nfilter']}
        return dict(data=collocs, processing=0, tasks=[])
    except MissingSubCorpFreqFile:
        ans = {'attrname': coll_args.cattr, 'tasks': []}
        out = freq_calc.build_arf_db(corp, coll_args.cattr)
        if type(out) is list:
            processing = 1
            ans['tasks'].extend(out)
        else:
            processing = 0
        ans['processing'] = processing
        ans['data'] = dict(Items=[], Head=[])
        return ans


@dataclass
class CalculateCollsResult:
    Head: str
    attrname: str
    processing: bool
    lastpage: bool
    Items: List[Any]


async def calculate_colls(coll_args: CollCalcArgs) -> CalculateCollsResult:
    """
    Calculates required collocations based on passed arguments.
    Result values are cached.

    returns:
    a dictionary ready to be used in a respective template (collx.tmpl)
    (keys: Head, Items, cmaxitems, attrname, processing, collstart, lastpage)
    """
    collstart = (coll_args.collpage - 1) * coll_args.citemsperpage
    collend = collstart + coll_args.citemsperpage
    cache = CollCalcCache(corpname=coll_args.corpname, subcname=coll_args.subcname, subcpath=coll_args.subcpath,
                          user_id=coll_args.user_id, q=coll_args.q, samplesize=coll_args.samplesize)
    collocs, cache_path = cache.get(cattr=coll_args.cattr, csortfn=coll_args.csortfn, cbgrfns=coll_args.cbgrfns,
                                    cfromw=coll_args.cfromw, ctow=coll_args.ctow, cminbgr=coll_args.cminbgr,
                                    cminfreq=coll_args.cminfreq)
    if collocs is None:
        coll_args.cache_path = cache_path
        worker = bgcalc.calc_backend_client(settings)
        res = await worker.send_task(
            'calculate_colls', object.__class__, args=(coll_args,), time_limit=TASK_TIME_LIMIT)
        # worker task caches the value AFTER the result is returned (see worker.py)
        ans = res.get()
    else:
        ans = dict(data=collocs, processing=0)
    return CalculateCollsResult(
        Head=ans['data']['Head'],
        attrname=coll_args.cattr,
        processing=ans['processing'],
        lastpage=not collstart + coll_args.citemsperpage < len(ans['data']['Items']),
        Items=ans['data']['Items'][collstart:collend]
    )


def clean_colls_cache():
    root_dir = settings.get('corpora', 'colls_cache_dir')
    cache_ttl = settings.get_int('corpora', 'colls_cache_ttl', 3600)
    test_time = time.time()
    all_files = os.listdir(root_dir)
    num_removed = 0
    num_error = 0
    for item in all_files:
        file_path = os.path.join(root_dir, item)
        if test_time - os.path.getmtime(file_path) >= cache_ttl:
            try:
                os.unlink(file_path)
                num_removed += 1
            except OSError:
                num_error += 1
    return dict(total_files=len(all_files), num_removed=num_removed, num_error=num_error)
