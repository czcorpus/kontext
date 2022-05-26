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

import logging
import math
import os
import re
import time
from dataclasses import asdict
from datetime import datetime
from typing import List, Optional, Union

import aiofiles
import aiofiles.os
import bgcalc
import corplib
import manatee
import settings
from action.errors import UserActionException
from bgcalc.errors import BgCalcError, UnfinishedConcordanceError
from bgcalc.freqs.storage import stored_to_fs
from bgcalc.freqs.types import Freq2DCalcArgs, FreqCalcArgs, FreqCalcResult
from bgcalc.task import AsyncTaskStatus
from conclib.calc import require_existing_conc
from conclib.pyconc import PyConc
from corplib.corpus import KCorpus

from ..errors import CalcArgsAssertionError

MAX_LOG_FILE_AGE = 1800  # in seconds

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


async def corp_freqs_cache_path(corp: KCorpus, attrname):
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
            if not await aiofiles.os.path.exists(cache_dir):
                await aiofiles.os.makedirs(cache_dir)
        ans = os.path.join(cache_dir, attrname)
    return ans


# TODO not used anywhere
async def prepare_arf_calc_paths(corp: KCorpus, attrname, logstep=0.02):
    """
    Calculates frequencies, ARFs and document frequencies for a specified corpus. Because this
    is quite computationally demanding the function is typically called in background by KonText.

    arguments:
    corp -- a corpus instance
    attrname -- name of a positional or structure's attribute
    logstep -- specifies how often (as a ratio of calculated data) should the logfile be updated
    """
    outfilename = corp.freq_precalc_file(attrname)
    if await aiofiles.os.path.isfile(outfilename + '.arf') and await aiofiles.os.path.isfile(outfilename + '.docf'):
        return None
    elif corp.is_subcorpus:
        return corp.spath
    else:
        return None


def create_log_path(base_path, calc_type):
    return f'{base_path}.{calc_type}.build'


async def get_log_last_line(path):
    async with aiofiles.open(path, 'r') as f:
        s = await f.read()
        if len(s) > 0:
            return re.split(r'[\r\n]', s.strip())[-1]
        return None


async def _clear_old_calc_status(base_path):
    for m in ('frq', 'arf', 'docf'):
        log_file = create_log_path(base_path, m)
        if await aiofiles.os.path.isfile(log_file) and await aiofiles.os.path.getmtime(log_file) > 3600:
            aiofiles.os.unlink(log_file)


async def _get_total_calc_status(base_path):
    items = []
    for m in ('frq', 'arf', 'docf'):
        try:
            log_file = create_log_path(base_path, m)
            last_line = await get_log_last_line(log_file)
            p = int(re.split(r'\s+', last_line)[0])
        except Exception as ex:
            logging.getLogger(__name__).error(ex)
            p = 0
        items.append(p)
    return sum(items) / 3.


async def calc_is_running(base_path, calc_type=None):
    to_check = (calc_type,) if calc_type else ('frq', 'arf', 'docf')

    async def is_fresh(fx):
        return time.mktime(datetime.now().timetuple()) - await aiofiles.os.path.getmtime(fx) <= MAX_LOG_FILE_AGE

    for m in to_check:
        log_path = create_log_path(base_path, m)
        if await aiofiles.os.path.isfile(log_path) and await is_fresh(log_path):
            return True
    return False


async def write_log_header(corp, logfile):
    async with aiofiles.open(logfile, 'w') as f:
        await f.write('%d\n%s\n0 %%' % (os.getpid(), corp.search_size))


async def build_arf_db(user_id: int, corp: KCorpus, attrname: str) -> Union[float, List[AsyncTaskStatus]]:
    """
    Provides a higher level wrapper to create_arf_db(). Function creates
    a background process where create_arf_db() is run. In case the
    calculation is already running, the function returns a float value from 0 to 100
    specifying current progress.

    TODO: we should always return a list of async tasks - i.e. even in case the calculation
          is already running (possibly triggered by someone else).
    """
    base_path = await corp_freqs_cache_path(corp, attrname)
    await _clear_old_calc_status(base_path)
    if await calc_is_running(base_path):
        curr_status = await _get_total_calc_status(base_path)
        if curr_status < 100:
            return curr_status

    worker = bgcalc.calc_backend_client(settings)
    tasks = []
    for m in ('frq', 'arf', 'docf'):
        logfilename_m = create_log_path(base_path, m)
        await write_log_header(corp, logfilename_m)
        res = await worker.send_task(
            f'compile_{m}', object.__class__,
            (user_id, corp.corpname, corp.subcname, attrname, logfilename_m),
            time_limit=TASK_TIME_LIMIT)
        logging.getLogger(__name__).warning('sending {}, res_id: {}'.format(m, res.id))
        async_task = AsyncTaskStatus(
            status=res.status, ident=res.id,
            category=AsyncTaskStatus.CATEGORY_FREQ_PRECALC,
            label='Subc. related data precalculation')  # TODO !!
        tasks.append(async_task)
    return tasks


async def build_arf_db_status(corp, attrname):
    return await _get_total_calc_status(await corp_freqs_cache_path(corp, attrname))


def calculate_freqs_bg_sync(args: FreqCalcArgs, conc: PyConc) -> FreqCalcResult:
    """
    This is a blocking variant of calculate_freqs_bg which requires a concordance
    instance to be already available. This is mostly intended for passing sub-calculations
    to separate threads.
    """
    if not conc.finished():
        raise UnfinishedConcordanceError(
            'Cannot calculate yet - source concordance not finished. Please try again later.')
    freqs = [conc.xfreq_dist(
        cr, args.flimit, args.freq_sort, args.ftt_include_empty, args.rel_mode, args.collator_locale)
        for cr in args.fcrit]
    return FreqCalcResult(freqs=freqs, conc_size=conc.size())


@stored_to_fs
async def calculate_freqs_bg(args: FreqCalcArgs) -> FreqCalcResult:
    """
    Calculate actual frequency data.

    arguments:
    args -- a FreqCalcArgs instance

    returns:
    a dict(freqs=..., conc_size=...)
    """
    cm = corplib.CorpusManager(subcpath=args.subcpath)
    corp = await cm.get_corpus(args.corpname, subcname=args.subcname)
    conc = await require_existing_conc(corp=corp, q=args.q)
    return calculate_freqs_bg_sync(args, conc)


async def calculate_freqs(args: FreqCalcArgs):
    """
    Calculates a frequency distribution based on a defined concordance and frequency-related arguments.
    The class is able to cache the data in a background process/task. This prevents KonText to calculate
    (via Manatee) full frequency list again and again (e.g. if user moves from page to page).
    """
    if args.fcrit and len(args.fcrit) > 1 and args.fpage > 1:
        raise CalcArgsAssertionError(
            'multi-block frequency calculation does not support pagination')

    worker = bgcalc.calc_backend_client(settings)
    res = await worker.send_task(
        'calculate_freqs', object.__class__, args=(args,), time_limit=TASK_TIME_LIMIT)
    # worker task caches the value AFTER the result is returned (see worker.py)
    calc_result: Union[None, Exception, FreqCalcResult] = res.get()

    if calc_result is None:
        raise BgCalcError('Failed to get result')
    elif isinstance(calc_result, Exception):
        raise calc_result

    lastpage = None
    fstart = (args.fpage - 1) * args.fmaxitems
    ans = []
    for i, freq_block in enumerate(calc_result.freqs):
        total_length = len(freq_block.Items)
        items_per_page = args.fmaxitems
        fend = args.fmaxitems * args.fpage + 1
        lastpage = 1 if total_length < fend else 0
        ans.append(dict(
            Total=total_length,
            TotalPages=int(math.ceil(total_length / float(items_per_page))),
            Items=[asdict(item) for item in freq_block.Items[fstart:fend - 1]],
            Head=freq_block.Head,
            SkippedEmpty=freq_block.SkippedEmpty,
            NoRelSorting=freq_block.NoRelSorting,
            fcrit=args.fcrit[i]))
    return dict(lastpage=lastpage, data=ans, fstart=fstart, fmaxitems=args.fmaxitems, conc_size=calc_result.conc_size)


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


# ------------------ 2-attribute freq. distribution --------------


class Freq2DCalculationError(Exception):
    pass


class Freq2DCalculation:

    def __init__(self, args: Freq2DCalcArgs):
        self._args = args
        self._corp: Optional[KCorpus] = None
        self._conc = None

    def _get_num_structattrs(self, attrs):
        return len([x for x in attrs if '.' in x])

    def _calc_1sattr_norms(self, words, sattr, sattr_idx):
        norms2_dict = self._conc.get_attr_values_sizes(sattr)
        return [norms2_dict.get(x[sattr_idx], 0) for x in words]

    def ct_dist(self, crit, limit_type, limit=1):
        """
        Calculate join distribution (2d frequency).
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
            raise Freq2DCalculationError(
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
                'The result is too large. Please try to increase the minimum frequency.')
        return ans, len(mans)

    async def run(self):
        """
        note: this is called by a background worker
        """
        cm = corplib.CorpusManager(subcpath=self._args.subcpath)
        self._corp = await cm.get_corpus(self._args.corpname, subcname=self._args.subcname)
        self._conc = await require_existing_conc(corp=self._corp, q=self._args.q)
        result, full_size = self.ct_dist(
            self._args.fcrit, limit=self._args.ctminfreq, limit_type=self._args.ctminfreq_type)
        return dict(data=[x[0] + x[1:] for x in result], full_size=full_size)


async def calculate_freq2d(args):
    """
    note: this is called directly by webserver
    """
    worker = bgcalc.calc_backend_client(settings)
    res = await worker.send_task('calculate_freq2d', dict.__class__, args=(args,), time_limit=TASK_TIME_LIMIT)
    calc_result = res.get()
    if isinstance(calc_result, Exception):
        raise calc_result
    return calc_result