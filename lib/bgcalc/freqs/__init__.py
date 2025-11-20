# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Department of Linguistics
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
import os.path
import re
import time
from dataclasses import asdict
from datetime import datetime
from subprocess import PIPE, Popen
from typing import Dict, Iterable, List, Optional, Tuple, Union

import aiofiles
import aiofiles.os
import bgcalc
import corplib
import manatee
import settings
from action.errors import UserReadableException
from bgcalc.errors import BgCalcError, UnfinishedConcordanceError
from bgcalc.freqs.storage import find_cached_result, stored_to_fs
from bgcalc.freqs.types import Freq2DCalcArgs, FreqCalcArgs, FreqCalcResult
from bgcalc.task import AsyncTaskStatus
from conclib.calc import require_existing_conc
from conclib.pyconc import PyConc
from corplib.abstract import SubcorpusIdent
from corplib.corpus import AbstractKCorpus, KCorpus
from corplib.subcorpus import KSubcorpus

from ..errors import CalcArgsAssertionError

MAX_LOG_FILE_AGE = 1800  # in seconds

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


def is_compiled(corp: AbstractKCorpus, attr, method):
    """
    Test whether pre-calculated data for particular
    combination corpus+attribute+method (arf, docf, frq, token:l)
    already exist.

    arguments:
    corp --
    attr -- a name of an attribute
    method -- one of arf, docf, frq, token:l
    """
    attr = corp.get_attr(attr)
    try:
        return attr.get_stat(method)
    except manatee.FileAccessError:
        return False


def corp_freqs_cache_paths(corp: AbstractKCorpus, attrname) -> Dict[str, str]:
    """
    Generates an absolute paths of auxiliary freq. files for
    corpus/subcorpus.

    arguments:
    corp -- a corpus instance
    attrname -- name of an attribute

    returns:
    mappings between freq type and path (e.g. {'arf': '/path/to/arf.freq.file', ...})
    """
    return {
        'arf': corp.freq_precalc_file(attrname, 'arf'),
        'frq': corp.freq_precalc_file(attrname, 'frq'),
        'docf': corp.freq_precalc_file(attrname, 'docf')
    }


def create_log_path(base_path):
    return f'{base_path}.build'


async def get_log_last_line(path):
    async with aiofiles.open(path, 'r') as f:
        s = await f.read()
        if len(s) > 0:
            return re.split(r'[\r\n]', s.strip())[-1]
        return None


async def _clear_old_calc_status(base_paths: Iterable[str]):
    for m in base_paths:
        log_file = create_log_path(m)
        if await aiofiles.os.path.isfile(log_file) and await aiofiles.os.path.getmtime(log_file) > 3600:
            os.unlink(log_file)


async def _get_total_calc_status(base_paths: Iterable[str]):
    items = []
    for m in base_paths:
        try:
            log_file = create_log_path(m)
            last_line = await get_log_last_line(log_file)
            p = int(re.split(r'\s+', last_line)[0])
        except Exception as ex:
            logging.getLogger(__name__).error(ex)
            p = 0
        items.append(p)
    return sum(items) / 3.


async def calc_is_running(base_paths: Iterable[str]):

    async def is_fresh(fx):
        return time.mktime(datetime.now().timetuple()) - await aiofiles.os.path.getmtime(fx) <= MAX_LOG_FILE_AGE

    for m in base_paths:
        log_path = create_log_path(m)
        if await aiofiles.os.path.isfile(log_path) and await is_fresh(log_path):
            return True
    return False


async def write_log_header(corp, logfile):
    async with aiofiles.open(logfile, 'w') as f:
        await f.write('%d\n%s\n0 %%' % (os.getpid(), corp.search_size))


async def build_arf_db(user_id: int, corp: AbstractKCorpus, attrname: str) -> Union[float, List[AsyncTaskStatus]]:
    """
    Provides a higher level wrapper to create_arf_db(). Function creates
    a background process where create_arf_db() is run. In case the
    calculation is already running, the function returns a float value from 0 to 100
    specifying current progress.

    TODO: we should always return a list of async tasks - i.e. even in case the calculation
          is already running (possibly triggered by someone else).
    """
    base_paths = corp_freqs_cache_paths(corp, attrname)
    await _clear_old_calc_status(base_paths.values())
    if await calc_is_running(base_paths.values()):
        curr_status = await _get_total_calc_status(base_paths)
        if curr_status < 100:
            return curr_status

    worker = bgcalc.calc_backend_client(settings)
    tasks = []
    for ftype, freq_path in base_paths.items():
        logfilename_m = create_log_path(freq_path)
        await write_log_header(corp, logfilename_m)
        res = await worker.send_task(
            f'compile_{ftype}', object.__class__,
            (corp.portable_ident, attrname, logfilename_m),
            time_limit=TASK_TIME_LIMIT)
        async_task = AsyncTaskStatus(
            status=res.status, ident=res.id,
            category=AsyncTaskStatus.CATEGORY_FREQ_PRECALC,
            label='Subc. related data precalculation')  # TODO !!
        tasks.append(async_task)
    return tasks


async def build_arf_db_status(corp, attrname):
    return await _get_total_calc_status(corp_freqs_cache_paths(corp, attrname).values())


def calculate_freqs_bg_sync(args: FreqCalcArgs, corp: AbstractKCorpus, conc: PyConc) -> FreqCalcResult:
    """
    This is a blocking variant of calculate_freqs_bg which requires a concordance
    instance to be already available. This is mostly intended for passing sub-calculations
    to separate threads.

    Please note that due to Manatee-open limitations, the function cannot paginate
    its output. So typically we store the full result into cache and implement the pagination
    there. Here we're limited just by args.flimit (which means each flimit is cached separately).
    """
    if not conc.finished():
        raise UnfinishedConcordanceError(
            'Cannot calculate yet - source concordance not finished. Please try again later.')

    for crit in args.fcrit:
        attr = crit.split()[0].split('/')[0]
        if not '.' in attr:
            continue
        if not is_compiled(corp, attr, 'token:l') and isinstance(corp, KSubcorpus):
            logging.getLogger(__name__).warning(
                f'Missing token:l data for subcorpus {corp.subcorpus_id}')
            compute_norms(
                corp,
                attr.split('.')[0],
                os.path.join(os.path.dirname(corp.freq_precalc_file(attr, 'token:l')), 'data.subc'))
    freqs = [conc.xfreq_dist(
        cr, args.flimit, args.freq_sort, args.rel_mode, args.collator_locale)
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
    cm = corplib.CorpusFactory(subc_root=args.subcpath)
    corp = await cm.get_corpus(
        SubcorpusIdent(id=args.subcname, corpus_name=args.corpname) if args.subcname else args.corpname)
    conc = await require_existing_conc(corp=corp, q=args.q, cutoff=args.cutoff)
    return calculate_freqs_bg_sync(args, corp, conc)


async def calculate_freqs(args: FreqCalcArgs):
    """
    Calculates a frequency distribution based on a defined concordance and frequency-related arguments.
    The class is able to cache the data in a background process/task. This prevents KonText to calculate
    (via Manatee) full frequency list again and again (e.g. if user moves from page to page). The caching
    is in fact crucial as Manatee itself does not support offset in freq. results.
    """
    if args.fcrit and len(args.fcrit) > 1 and args.fpage > 1:
        raise CalcArgsAssertionError(
            'multi-block frequency calculation does not support pagination')

    calc_result, p = find_cached_result(args)
    if calc_result is None:
        worker = bgcalc.calc_backend_client(settings)
        res = await worker.send_task(
            'calculate_freqs', object.__class__, args=(args,), time_limit=TASK_TIME_LIMIT)
        tmp_result: Union[None, Exception, FreqCalcResult] = await res.get()

        if tmp_result is None:
            raise BgCalcError('Failed to get freqs result')

        elif isinstance(tmp_result, Exception):
            raise tmp_result

        elif isinstance(tmp_result, FreqCalcResult):
            calc_result = tmp_result
            if calc_result.fs_stored_data:
                calc_result, _ = find_cached_result(args)
                if calc_result is None:
                    raise BgCalcError('Failed to get expected freqs result')

    lastpage = None
    fstart = (args.fpage - 1) * args.fpagesize
    ans = []
    for i, freq_block in enumerate(calc_result.freqs):
        items_per_page = args.fpagesize
        fend = args.fpagesize * args.fpage + 1
        lastpage = 1 if freq_block.Size < fend else 0
        ans.append(dict(
            Total=freq_block.Size,
            TotalPages=int(math.ceil(freq_block.Size / float(items_per_page))),
            Items=[asdict(item) for item in freq_block.Items],
            Head=freq_block.Head,
            SkippedEmpty=freq_block.SkippedEmpty,
            NoRelSorting=freq_block.NoRelSorting,
            fcrit=args.fcrit[i]))
    return dict(lastpage=lastpage, data=ans, fstart=fstart, fmaxitems=args.fpagesize, conc_size=calc_result.conc_size)


def compute_norms(corp: AbstractKCorpus, struct: str, subcpath: str):
    subc_part = ['-s',  subcpath] if subcpath else []
    cmd = ['mktokencov', corp.get_confpath(),  struct] + subc_part
    p = Popen(cmd, stdout=PIPE, stderr=PIPE)
    stdout, errors = p.communicate(timeout=120)
    if p.returncode > 0:
        logging.getLogger(__name__).error('Failed to run mktokencov: {}'.format(errors[:550]))
        raise RuntimeError(f'Failed to run mktokencov with error code {p.returncode}')


def clean_freqs_cache():
    root_dir = settings.get('corpora', 'freqs_cache_dir')
    cache_ttl = settings.get_int('corpora', 'freqs_cache_ttl', 3600)
    test_time = time.time()
    corpora = os.listdir(root_dir)
    num_removed = 0
    num_error = 0
    total_files = 0
    for corpus in corpora:
        corpus_dir = os.path.join(root_dir, corpus)
        if os.path.isdir(corpus_dir):
            files = os.listdir(corpus_dir)
            for item in files:
                file_path = os.path.join(corpus_dir, item)
                if test_time - os.path.getmtime(file_path) >= cache_ttl:
                    try:
                        os.unlink(file_path)
                        num_removed += 1
                    except OSError:
                        num_error += 1
                total_files += len(files)
    return dict(total_files=total_files, num_removed=num_removed, num_error=num_error)


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

    def ct_dist(
            self,
            crit,
            flimit_type,
            flimit=1,
            max_result_size=1000
    ) -> List[Tuple[str, float, float]]:
        """
        Calculate join distribution (2d frequency).

        Args:
            crit -- a criterion for both dimensions (e.g. 'word 0<0 doc.txtype_group 0')
            flimit_type -- a unit applied to 'flimit'; must be one of {abs, ipm, pabs, pipm}
                where 'pabs' and 'pipm' are percentile versions of 'abs' and 'ipm'.
            max_result_size -- no matter what flimit+flimit_type is involved, KonText must
                always load all the matching values first before it starts to calculate freq.
                information needed to sort and cut the final result. This value specifies max.
                number of initial result size to prevent server overload.
        Returns:
            list of 3-tuples (word, abs. freq., norm)
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

        swords: List[Tuple[str, ...]] = [tuple(w.split('\t')) for w in words]

        num_structattrs = self._get_num_structattrs(attrs)
        if num_structattrs == 2:
            norms = [1e6] * len(swords)  # this is not really needed
        elif num_structattrs == 1:
            sattr_idx = 0 if '.' in attrs[0] else 1
            norms = self._calc_1sattr_norms(swords, sattr=attrs[sattr_idx], sattr_idx=sattr_idx)
        else:
            norms = [self._corp.size] * len(swords)
        mans = list(zip(swords, freqs, norms))
        if flimit_type == 'abs':
            ans = [v for v in mans if v[1] >= flimit]
        elif flimit_type == 'ipm':
            ans = [v for v in mans if v[1] / float(v[2]) * 1e6 >= flimit]
        elif flimit_type == 'pabs':
            values = sorted(mans, key=lambda v: v[1])
            plimit = int(math.floor(flimit / 100. * len(values)))
            ans = values[plimit:]
        elif flimit_type == 'pipm':
            values = sorted(mans, key=lambda v: v[1] / float(v[2]) * 1e6)
            # math.floor(x) == math.ceil(x) - 1 (indexing from 0)
            plimit = math.floor(flimit / 100. * len(values))
            ans = values[plimit:]
        else:
            raise UserReadableException(
                f'Unknown limit type - expecting one of {{abs, ipm, pabs, pipm}}, got: {flimit_type}')
        if len(ans) > max_result_size:
            raise UserReadableException(
                'The result is too large. Please try to increase the minimum frequency.')
        return [x[0] + x[1:] for x in ans]

    async def run(self):
        """
        note: this is called by a background worker
        """
        cm = corplib.CorpusFactory(subc_root=self._args.subcorpora_dir)
        self._corp = await cm.get_corpus(
            SubcorpusIdent(corpus_name=self._args.corpname, id=self._args.subcorpus_id) if self._args.subcorpus_id
            else self._args.corpname)
        self._conc = await require_existing_conc(corp=self._corp, q=self._args.q, cutoff=self._args.cutoff)
        result = self.ct_dist(
            self._args.fcrit, flimit=self._args.ctminfreq, flimit_type=self._args.ctminfreq_type,
            max_result_size=self._args.max_result_size)
        return dict(data=result, size=len(result))


async def calculate_freq2d(args):
    """
    note: this is called directly by webserver
    """
    worker = bgcalc.calc_backend_client(settings)
    res = await worker.send_task('calculate_freq2d', dict.__class__, args=(args,), time_limit=TASK_TIME_LIMIT)
    calc_result = await res.get()
    if isinstance(calc_result, Exception):
        raise calc_result
    return calc_result
