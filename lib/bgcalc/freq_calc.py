# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import os
import re
from datetime import datetime
import time
import math
import hashlib
import logging
import pickle
from structures import FixedDict
from typing import Union, List

import manatee
import corplib
from corplib.corpus import KCorpus
from conclib.calc import require_existing_conc
import settings
import bgcalc
from bgcalc.errors import UnfinishedConcordanceError, CalcBackendError
from bgcalc import AsyncTaskStatus
from translation import ugettext as _
from controller.errors import UserActionException

MAX_LOG_FILE_AGE = 1800  # in seconds

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


class FreqCalsArgs(FixedDict):
    """
    Collects all the required arguments passed around when
    calculating frequency distribution
    """
    q = None
    user_id = None
    corpname = None
    # --- corp encoding ??
    collator_locale = None
    subcname = None
    subcpath = None
    pagesize = None  # ??
    fpage = 1  # ??
    save = 0
    samplesize = 0
    flimit = None  # default ??
    fcrit = None
    freq_sort = None
    ml = 0  # default ??
    ftt_include_empty = None  # default ??
    rel_mode = None
    fmaxitems = None  # default ??
    line_offset = None  # ??
    cache_path = None
    force_cache = False


def corp_freqs_cache_path(corp: KCorpus, attrname):
    """
    Generates an absolute path to an 'attribute' directory/file. The path
    consists of two parts: 1) absolute path to corpus indexed data
    2) filename given by the 'attrname' argument. It is also dependent
    on whether you pass a subcorpus (files are created in user's assigned directory)
    or a regular corpus (files are created in the 'cache' directory).

    arguments:
    corp -- a corpus instance
    attrname -- name of an attribute

    returns:
    a path encoded as an 8-bit string (i.e. unicode paths are encoded)
    """
    if corp.spath:
        path_ne, _ = os.path.splitext(corp.spath)
        ans = path_ne + '.' + attrname
    else:
        cache_dir = os.path.abspath(settings.get('corpora', 'freqs_precalc_dir'))
        subdirs = (corp.corpname,)
        for d in subdirs:
            cache_dir = os.path.join(cache_dir, d)
            if not os.path.exists(cache_dir):
                os.makedirs(cache_dir)
        ans = os.path.join(cache_dir, attrname)
    return ans


def prepare_arf_calc_paths(corp: KCorpus, attrname, logstep=0.02):
    """
    Calculates frequencies, ARFs and document frequencies for a specified corpus. Because this
    is quite computationally demanding the function is typically called in background by KonText.

    arguments:
    corp -- a corpus instance
    attrname -- name of a positional or structure's attribute
    logstep -- specifies how often (as a ratio of calculated data) should the logfile be updated
    """
    outfilename = corp.freq_precalc_file(attrname)
    if os.path.isfile(outfilename + '.arf') and os.path.isfile(outfilename + '.docf'):
        return None
    elif corp.is_subcorpus:
        return corp.spath
    else:
        return None


def create_log_path(base_path, calc_type):
    return f'{base_path}.{calc_type}.build'


def get_log_last_line(path):
    with open(path, 'r') as f:
        s = f.read()
        if len(s) > 0:
            return re.split(r'[\r\n]', s.strip())[-1]
        return None


def _clear_old_calc_status(base_path):
    for m in ('frq', 'arf', 'docf'):
        log_file = create_log_path(base_path, m)
        if os.path.isfile(log_file) and os.path.getmtime(log_file) > 3600:
            os.unlink(log_file)


def _get_total_calc_status(base_path):
    items = []
    for m in ('frq', 'arf', 'docf'):
        try:
            log_file = create_log_path(base_path, m)
            last_line = get_log_last_line(log_file)
            p = int(re.split(r'\s+', last_line)[0])
        except Exception as ex:
            logging.getLogger(__name__).error(ex)
            p = 0
        items.append(p)
    return sum(items) / 3.


def calc_is_running(base_path, calc_type=None):
    to_check = (calc_type,) if calc_type else ('frq', 'arf', 'docf')

    def is_fresh(fx):
        return time.mktime(datetime.now().timetuple()) - os.path.getmtime(fx) <= MAX_LOG_FILE_AGE

    for m in to_check:
        log_path = create_log_path(base_path, m)
        if os.path.isfile(log_path) and is_fresh(log_path):
            return True
    return False


def write_log_header(corp, logfile):
    with open(logfile, 'w') as f:
        f.write('%d\n%s\n0 %%' % (os.getpid(), corp.search_size))


def build_arf_db(user_id: int, corp: KCorpus, attrname: str) -> List[AsyncTaskStatus]:
    """
    Provides a higher level wrapper to create_arf_db(). Function creates
    a background process where create_arf_db() is run.
    """
    base_path = corp_freqs_cache_path(corp, attrname)
    _clear_old_calc_status(base_path)
    if calc_is_running(base_path):
        curr_status = _get_total_calc_status(base_path)
        if curr_status < 100:
            return curr_status

    app = bgcalc.calc_backend_client(settings)
    tasks = []
    for m in ('frq', 'arf', 'docf'):
        logfilename_m = create_log_path(base_path, m)
        write_log_header(corp, logfilename_m)
        res = app.send_task(f'compile_{m}',
                            (user_id, corp.corpname, corp.subcname, attrname, logfilename_m),
                            time_limit=TASK_TIME_LIMIT)
        logging.getLogger(__name__).warning('sending {}, res_id: {}'.format(m, res.id))
        async_task = AsyncTaskStatus(status=res.status, ident=res.id,
                                     category=AsyncTaskStatus.CATEGORY_FREQ_PRECALC,
                                     label='Subc. related data precalculation',  # TODO !!
                                     args={},
                                     url=None)
        tasks.append(async_task)
    return tasks


def build_arf_db_status(corp, attrname):
    return _get_total_calc_status(corp_freqs_cache_path(corp, attrname))


class FreqCalcCache(object):

    def __init__(self, corpname, subcname, user_id, subcpath, q=None, pagesize=0,
                 save=0, samplesize=0):
        """
        Creates a new freq calculator with fixed concordance parameters.
        """
        self._corpname = corpname
        self._subcname = subcname
        self._user_id = user_id
        self._q = q
        self._pagesize = pagesize
        self._save = save
        self._samplesize = samplesize
        self._subcpath = subcpath

    def _cache_file_path(self, fcrit, flimit, freq_sort, ml, ftt_include_empty, rel_mode, collator_locale):
        v = (str(self._corpname) + str(self._subcname) + str(self._user_id) +
             ''.join(self._q) + str(fcrit) + str(flimit) + str(freq_sort) + str(ml) +
             str(ftt_include_empty) + str(rel_mode) + str(collator_locale))
        filename = '%s.pkl' % hashlib.sha1(v.encode('utf-8')).hexdigest()
        return os.path.join(settings.get('corpora', 'freqs_cache_dir'), filename)

    def get(self, fcrit, flimit, freq_sort, ml, ftt_include_empty, rel_mode, collator_locale):
        cache_path = self._cache_file_path(
            fcrit, flimit, freq_sort, ml, ftt_include_empty, rel_mode, collator_locale)
        if os.path.isfile(cache_path):
            with open(cache_path, 'rb') as f:
                data = pickle.load(f)
        else:
            data = None
        return data, cache_path


def calculate_freqs_bg(args: FreqCalsArgs):
    """
    Calculate actual frequency data.

    arguments:
    args -- a FreqCalsArgs instance

    returns:
    a dict(freqs=..., conc_size=...)
    """
    cm = corplib.CorpusManager(subcpath=args.subcpath)
    corp = cm.get_corpus(args.corpname, subcname=args.subcname)
    conc = require_existing_conc(corp=corp, q=args.q)
    if not conc.finished():
        raise UnfinishedConcordanceError(
            _('Cannot calculate yet - source concordance not finished. Please try again later.'))
    freqs = [conc.xfreq_dist(cr, args.flimit, args.freq_sort, args.ml, args.ftt_include_empty, args.rel_mode,
                             args.collator_locale)
             for cr in args.fcrit]
    for item in freqs:
        if 'Items' not in item:
            item['Items'] = []
            item['Total'] = len(item['Items'])
    return dict(freqs=freqs, conc_size=conc.size())


def calculate_freqs(args: FreqCalsArgs):
    """
    Calculates a frequency distribution based on a defined concordance and frequency-related arguments.
    The class is able to cache the data in a background process/task. This prevents KonText to calculate
    (via Manatee) full frequency list again and again (e.g. if user moves from page to page).
    """
    cache = FreqCalcCache(corpname=args.corpname, subcname=args.subcname, user_id=args.user_id, subcpath=args.subcpath,
                          q=args.q, pagesize=args.pagesize, save=args.save, samplesize=args.samplesize)
    calc_result, cache_path = cache.get(fcrit=args.fcrit, flimit=args.flimit, freq_sort=args.freq_sort, ml=args.ml,
                                        ftt_include_empty=args.ftt_include_empty, rel_mode=args.rel_mode,
                                        collator_locale=args.collator_locale)

    if calc_result is None:
        args.cache_path = cache_path
        app = bgcalc.calc_backend_client(settings)
        res = app.send_task('calculate_freqs', args=(args.to_dict(),),
                            time_limit=TASK_TIME_LIMIT)
        # worker task caches the value AFTER the result is returned (see worker.py)
        calc_result = res.get()

    if calc_result is None:
        raise CalcBackendError('Failed to get result')
    data = calc_result['freqs']
    conc_size = calc_result['conc_size']
    lastpage = None

    if len(data) == 1:  # a single block => pagination
        total_length = len(data[0]['Items']) if 'Items' in data[0] else 0
        items_per_page = args.fmaxitems
        fstart = (args.fpage - 1) * args.fmaxitems + args.line_offset
        fmaxitems = args.fmaxitems * args.fpage + 1 + args.line_offset
        if total_length < fmaxitems:
            lastpage = 1
        else:
            lastpage = 0
        ans = [dict(Total=total_length,
                    TotalPages=int(math.ceil(total_length / float(items_per_page))),
                    Items=data[0]['Items'][fstart:fmaxitems - 1] if 'Items' in data[0] else [],
                    Head=data[0].get('Head', []),
                    SkippedEmpty=data[0].get('SkippedEmpty', False))]
    else:
        for item in data:
            if 'Items' not in item:
                item['Items'] = []
            item['Total'] = len(item['Items'])
            item['TotalPages'] = None
        ans = data
        fstart = None
    return dict(lastpage=lastpage, data=ans, fstart=fstart, fmaxitems=args.fmaxitems, conc_size=conc_size)


def clean_freqs_cache():
    root_dir = settings.get('corpora', 'freqs_cache_dir')
    cache_ttl = settings.get_int('corpora', 'freqs_cache_ttl', 3600)
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


# ------------------ Contingency table freq. distribution --------------


class CTFreqCalcArgs(FixedDict):
    q = None
    user_id = None
    corpname = None
    collator_locale = None
    subcname = None
    subcpath = None
    ctminfreq = None
    ctminfreq_type = None
    fcrit = None
    cache_path = None


class CTCalculationError(Exception):
    pass


class CTCalculation(object):

    def __init__(self, args):
        self._args = args
        self._corp: Union[KCorpus, None] = None
        self._conc = None

    def _get_num_structattrs(self, attrs):
        return len([x for x in attrs if '.' in x])

    def _calc_1sattr_norms(self, words, sattr, sattr_idx):
        norms2_dict = self._conc.get_attr_values_sizes(sattr)
        return [norms2_dict.get(x[sattr_idx], 0) for x in words]

    def ct_dist(self, crit, limit_type, limit=1):
        """
        Calculate join distribution (contingency table).
        """
        words = manatee.StrVector()
        freqs = manatee.NumVector()
        norms = manatee.NumVector()

        abs_limit = 1  # we always fetch all the values to be able to filter by percentiles and provide misc. info
        self._corp.freq_dist(self._conc.RS(), crit, abs_limit, words, freqs, norms)

        crit_lx = re.split(r'\s+', crit)
        attrs = []
        for i in range(0, len(crit_lx), 2):
            attrs.append(crit_lx[i])

        if len(attrs) > 2:
            raise CTCalculationError(
                'Exactly two attributes (either positional or structural) can be used')

        words = [tuple(w.split('\t')) for w in words]

        num_structattrs = self._get_num_structattrs(attrs)
        if num_structattrs == 2:
            norms = [1e6] * len(words)  # this is not really needed
        elif num_structattrs == 1:
            sattr_idx = 0 if '.' in attrs[0] else 1
            norms = self._calc_1sattr_norms(words, sattr=attrs[sattr_idx], sattr_idx=sattr_idx)
        else:
            norms = [self._corp.size] * len(words)
        mans = list(zip(words, freqs, norms))
        if limit_type == 'abs':
            ans = [v for v in mans if v[1] >= limit]
        elif limit_type == 'ipm':
            ans = [v for v in mans if v[1] / float(v[2]) * 1e6 >= limit]
        elif limit_type == 'pabs':
            values = sorted(mans, key=lambda v: v[1])
            plimit = int(math.floor(limit / 100. * len(values)))
            ans = values[plimit:]
        elif limit_type == 'pipm':
            values = sorted(mans, key=lambda v: v[1] / float(v[2]) * 1e6)
            # math.floor(x) == math.ceil(x) - 1 (indexing from 0)
            plimit = math.floor(limit / 100. * len(values))
            ans = values[plimit:]
        if len(ans) > 1000:
            raise UserActionException(
                'The result size is too high. Please try to increase the minimum frequency.')
        return ans, len(mans)

    def run(self):
        """
        note: this is called by Celery worker
        """
        cm = corplib.CorpusManager(subcpath=self._args.subcpath)
        self._corp = cm.get_corpus(self._args.corpname, subcname=self._args.subcname)
        self._conc = require_existing_conc(corp=self._corp, q=self._args.q)
        result, full_size = self.ct_dist(self._args.fcrit, limit=self._args.ctminfreq,
                                         limit_type=self._args.ctminfreq_type)
        return dict(data=[x[0] + x[1:] for x in result], full_size=full_size)


def calculate_freqs_ct(args):
    """
    note: this is called by webserver
    """
    try:
        app = bgcalc.calc_backend_client(settings)
        res = app.send_task('calculate_freqs_ct', args=(args.to_dict(),),
                            time_limit=TASK_TIME_LIMIT)
        calc_result = res.get()
    except Exception as ex:
        if app.is_wrapped_user_error(ex):
            raise UserActionException(str(ex)) from ex
        else:
            raise ex
    return calc_result
