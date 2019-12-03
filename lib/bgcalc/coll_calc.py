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

try:
    import pickle as pickle
except ImportError:
    import pickle
import hashlib
import os
import time

import corplib
import conclib
from bgcalc import freq_calc
from l10n import import_string
import settings
from structures import FixedDict
from bgcalc import UnfinishedConcordanceError
from translation import ugettext as _

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


class CollCalcArgs(FixedDict):
    """
    Collects all the required arguments passed around when
    calculating collocation profiles.
    """
    q = None
    user_id = None
    corpname = None
    corpus_encoding = None
    subcname = None
    subcpath = None
    num_lines = None
    collpage = None
    citemsperpage = None
    line_offset = None
    minsize = 0
    save = 0
    samplesize = 0
    cattr = None
    csortfn = None
    cbgrfns = None
    cfromw = None
    ctow = None
    cminbgr = None
    cminfreq = None
    cache_path = None
    num_fetch_items = None


class CollCalcCache(object):

    MANATEE_DEFAULT_NUM_FETCH_LINES = 50

    def __init__(self, corpname, subcname, subcpath, user_id, q, minsize=None, save=0, samplesize=0):
        self._corpname = corpname
        self._subcname = subcname
        self._subcpath = subcpath
        self._user_id = user_id
        self._q = q
        self._minsize = minsize
        self._save = save
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


def calculate_colls_bg(coll_args):
    """
    Background collocations calculation.
    This function is expected to be run either
    from Celery or from other process (via multiprocessing).
    """
    cm = corplib.CorpusManager(subcpath=coll_args.subcpath)
    corp = cm.get_Corpus(coll_args.corpname, subcname=coll_args.subcname)
    try:
        # try to fetch precalculated data; if none then MissingSubCorpFreqFile
        corplib.frq_db(corp, coll_args.cattr)
        conc = conclib.get_conc(corp=corp, user_id=coll_args.user_id, minsize=coll_args.minsize, q=coll_args.q,
                                fromp=0, pagesize=0, async=0, save=coll_args.save, samplesize=coll_args.samplesize)
        if not conc.finished():
            raise UnfinishedConcordanceError(
                _('Cannot calculate yet - source concordance not finished. Please try again later.'))
        collocs = conc.collocs(cattr=coll_args.cattr, csortfn=coll_args.csortfn, cbgrfns=coll_args.cbgrfns,
                               cfromw=coll_args.cfromw, ctow=coll_args.ctow, cminfreq=coll_args.cminfreq,
                               cminbgr=coll_args.cminbgr, max_lines=coll_args.num_fetch_items)
        for item in collocs['Items']:
            item['pfilter'] = [('q2', item['pfilter'])]
            item['nfilter'] = [('q2', item['nfilter'])]
            item['str'] = import_string(item['str'], from_encoding=coll_args.corpus_encoding)
        return dict(data=collocs, processing=0, tasks=[])
    except corplib.MissingSubCorpFreqFile as e:
        ans = {'attrname': coll_args.cattr, 'tasks': []}
        out = freq_calc.build_arf_db(e.corpus, coll_args.cattr)
        if type(out) is list:
            processing = 1
            ans['tasks'].extend(out)
        else:
            processing = 0
        ans['processing'] = processing
        ans['data'] = dict(Items=[], Head=[])
        return ans


def calculate_colls(coll_args):
    """
    Calculates required collocations based on passed arguments.
    Function is able to reuse cached values and utilize configured
    backend (either Celery or multiprocessing).

    returns:
    a dictionary ready to be used in a respective template (collx.tmpl)
    (keys: Head, Items, cmaxitems, attrname, processing, collstart, lastpage)
    """
    if coll_args.num_lines > 0:
        collstart = 0
        collend = coll_args.num_lines
    else:
        collstart = (int(coll_args.collpage) - 1) * \
            int(coll_args.citemsperpage) + int(coll_args.line_offset)
        collend = collstart + int(coll_args.citemsperpage) + 1

    cache = CollCalcCache(corpname=coll_args.corpname, subcname=coll_args.subcname, subcpath=coll_args.subcpath,
                          user_id=coll_args.user_id, q=coll_args.q, minsize=coll_args.minsize, save=coll_args.save,
                          samplesize=coll_args.samplesize)
    collocs, cache_path = cache.get(cattr=coll_args.cattr, csortfn=coll_args.csortfn, cbgrfns=coll_args.cbgrfns,
                                    cfromw=coll_args.cfromw, ctow=coll_args.ctow, cminbgr=coll_args.cminbgr,
                                    cminfreq=coll_args.cminfreq)
    if collocs is None:
        num_fetch_items = CollCalcCache.MANATEE_DEFAULT_NUM_FETCH_LINES
    else:
        num_fetch_items = len(collocs['Items'])

    if collocs is None or collend > num_fetch_items:
        if os.path.isfile(cache_path):  # cache avail. but not enough items
            os.unlink(cache_path)
        if collend >= num_fetch_items:
            num_fetch_items += (collend - num_fetch_items) + 10 * \
                int(coll_args.citemsperpage)  # TODO heuristics :)

        coll_args.cache_path = cache_path
        coll_args.num_fetch_items = num_fetch_items

        backend = settings.get('calc_backend', 'type')
        if backend in ('celery', 'konserver'):
            import bgcalc
            app = bgcalc.calc_backend_client(settings)
            res = app.send_task('worker.calculate_colls', args=(coll_args.to_dict(),),
                                time_limit=TASK_TIME_LIMIT)
            # worker task caches the value AFTER the result is returned (see worker.py)
            ans = res.get()
        elif backend == 'multiprocessing':
            ans = calculate_colls_mp(coll_args)
    else:
        ans = dict(data=collocs, processing=0)
    result = dict(
        Head=ans['data']['Head'],
        attrname=coll_args.cattr,
        processing=ans['processing'],
        collstart=collstart,
        lastpage=0 if collstart + coll_args.citemsperpage < len(ans['data']['Items']) else 1,
        Items=ans['data']['Items'][collstart:collend - 1]
    )
    return result


def calculate_colls_mp(coll_args):
    """
    Background calculation of collocations
    using 'multiprocessing' package.
    """
    import multiprocessing

    def cache_results(cache_path, data):
        with open(cache_path, 'wb') as f:
            pickle.dump(data, f)

    ans = calculate_colls_bg(coll_args)
    if len(ans['Items']) >= settings.get_int('corpora', 'colls_cache_min_lines', 10):  # cache only if its worth it
        multiprocessing.Process(target=cache_results, args=(coll_args.cache_path, ans,)).start()
    return ans


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
