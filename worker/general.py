# Copyright (c) 2008-2013  Pavel Rychly, Milos Jakubicek
# Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

"""
This module contains all KonText's tasks for Celery. It is intended to
be loaded by Celery as 'CELERY_APP' (CELERY_APP="worker:app").

The module also generates dynamic tasks exported by KonText
plug-ins.

It can be run on a different machine than KonText but it still requires
complete and properly configured KonText package.
"""

import importlib.util
import os
import pickle
import sys
import time
from typing import Union

import aiofiles
import aiofiles.os

APP_PATH = os.path.realpath(f'{os.path.dirname(os.path.abspath(__file__))}/..')
sys.path.insert(0, f'{APP_PATH}/../lib')
import settings
from action.plugin import initializer
from stderr2f import get_stderr_redirector

settings.load(os.path.join(APP_PATH, 'conf', 'config.xml'))
if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))
import manatee

os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')
initializer.init_plugin('db')
initializer.init_plugin('integration_db')
initializer.init_plugin('sessions')
initializer.init_plugin('auth')
initializer.init_plugin('conc_cache')
initializer.init_plugin('corparch')
initializer.init_plugin('subc_storage')
initializer.init_plugin('query_history')
initializer.init_plugin('query_persistence')
initializer.init_plugin('sessions')
initializer.init_plugin('user_items')
initializer.init_plugin('token_connect', optional=True)
initializer.init_plugin('live_attributes', optional=True)
initializer.init_plugin('dispatch_hook', optional=True)

import conclib.calc
import conclib.calc.base
from action.argmapping.wordlist import WordlistFormArgs
from action.argmapping.subcorpus import CreateSubcorpusArgs, CreateSubcorpusWithinArgs, CreateSubcorpusRawCQLArgs
from bgcalc import coll_calc, freqs, pquery, subc_calc, wordlist
from corplib import CorpusFactory
from corplib.abstract import AbstractKCorpus, SubcorpusIdent
from corplib.corpus import KCorpus
from corplib.subcorpus import SubcorpusRecord

stderr_redirector = get_stderr_redirector(settings)


def load_script_module(name, path):
    return importlib.util.spec_from_file_location(name, path)


class WorkerTaskException(Exception):
    pass


def is_compiled(corp: AbstractKCorpus, attr, method):
    """
    Test whether pre-calculated data for particular
    combination corpus+attribute+method (arf, docf, frq)
    already exist.

    arguments:
    corp --
    attr -- a name of an attribute
    method -- one of arf, docf, frq
    """
    if attr.endswith('.ngr'):
        if corp.get_conf('SUBCPATH'):
            attr = manatee.NGram(corp.get_conf('PATH') + attr,
                                 corp.get_conf('SUBCPATH') + attr)
        else:
            attr = manatee.NGram(corp.get_conf('PATH') + attr)
        last = attr.size() - 1
    else:
        attr = corp.get_attr(attr)
        last = attr.id_range() - 1
    try:
        if getattr(attr, method)(last) != -1:
            sys.stdout.write('%s already compiled, skipping.\n' % method)
            return True
    except manatee.FileAccessError:
        pass
    return False


async def _load_corp(corp_ident: Union[str, SubcorpusRecord]):
    """
    Instantiate a manatee.Corpus (or manatee.SubCorpus)
    instance

    arguments:
    corp_id -- a corpus identifier
    subc -- a subcorpus identifier (None if not defined)
    user_id --
    """
    cm = CorpusFactory(subc_root=settings.get('corpora', 'subcorpora_dir'))
    return await cm.get_corpus(corp_ident)


async def _compile_frq(corp: KCorpus, attr, logfile):
    """
    Generate pre-calculated data for frequency distribution pages.

    arguments:
    corp -- a manatee.Corpus instance
    attr -- an attribute name
    logfile -- a file where calculation status will be written
               (bonito-open approach)
    """
    if is_compiled(corp, attr, 'freq'):
        async with aiofiles.open(logfile, 'a') as f:
            await f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'freq already compiled'}
    with stderr_redirector(open(logfile, 'a')):
        corp.compile_frq(attr)
        async with aiofiles.open(logfile, 'a') as f:
            await f.write('\n100 %\n')
    return {'message': 'OK', 'last_log_record': await freqs.get_log_last_line(logfile)}


# ----------------------------- CONCORDANCE -----------------------------------


async def conc_register(self, user_id, corpus_ident: Union[str, SubcorpusRecord], corp_cache_key, query, samplesize, time_limit, worker):
    """
    Register concordance calculation and initiate the calculation.

    arguments:
    user_id -- an identifier of the user who entered the query (used to specify subc. directory if needed)
    corpus_ident -- a corpus identifier (either a corpus name or data for a subcorpus)
    query -- a query tuple
    samplesize -- a row number limit (if 0 then unlimited - see Manatee API)
    time_limit -- a time limit (in seconds) for the main conc. task

    returns:
    a dict(cachefile=..., pidfile=..., stored_pidfile=...)
    """
    task = conclib.calc.base.TaskRegistration(task_id=self.request.id)
    initial_args = await task.run(corpus_ident, corp_cache_key, query, samplesize)
    if not initial_args['already_running']:   # we are first trying to calc this
        worker.send_task_sync(
            'conc_calculate', object.__class__,
            args=(initial_args, user_id, corpus_ident, corp_cache_key, query, samplesize),
            soft_time_limit=time_limit)
        # there is no return from the send_task as we obtain the status via conc cache map
    return initial_args


async def conc_calculate(self, initial_args, user_id, corpus_ident: Union[str, SubcorpusRecord], corp_cache_key, query, samplesize):
    """
    Perform actual concordance calculation.
    This is called automatically by the 'register()' function above.

    arguments:
    initial_args -- a dict(cachefile=..., pidfile=..., stored_pidfile=...) as obtained from register()
    user_id -- an identifier of the user who entered the query (used to specify subc. directory if needed)
    corpus_id -- a corpus system identifier
    subc_name -- a sub-corpus identifier (None if not used)
    corp_cache_key -- a MD5 checksum of the sub-corpus data file
    query -- a query tuple
    samplesize -- a row number limit (if 0 then unlimited - see Manatee API)
    """
    task = conclib.calc.ConcCalculation(task_id=self.request.id)
    return await task.run(
        initial_args, settings.get('corpora', 'subcorpora_dir'), corpus_ident, corp_cache_key, query, samplesize)


async def conc_sync_calculate(self, user_id, corpus_name, subc_name, corp_cache_key, query, samplesize):
    conc_dir = os.path.join(settings.get('corpora', 'conc_dir'), str(user_id))
    task = conclib.calc.ConcSyncCalculation(
        task_id=self.request.id, cache_factory=None,
        subc_root=settings.get('corpora', 'subcorpora_dir'),
        corpus_ident=SubcorpusIdent(
            id=subc_name, corpus_name=corpus_name) if subc_name else corpus_name,
        conc_dir=conc_dir)
    return await task.run(corp_cache_key, query, samplesize)


# ----------------------------- COLLOCATIONS ----------------------------------


async def calculate_colls(coll_args: coll_calc.CollCalcArgs):
    """
    """
    ans = await coll_calc.calculate_colls_bg(coll_args)
    if not ans['processing'] and len(ans['data']['Items']) > 0:
        with open(coll_args.cache_path, 'wb') as f:
            pickle.dump(ans['data'], f)
    return ans


async def clean_colls_cache():
    return coll_calc.clean_colls_cache()


# ----------------------------- FREQUENCY DISTRIBUTION ------------------------


async def calculate_freqs(args):
    return await freqs.calculate_freqs_bg(args)


async def calculate_freq2d(args: freqs.Freq2DCalcArgs):
    return await freqs.Freq2DCalculation(args).run()


async def clean_freqs_cache():
    return freqs.clean_freqs_cache()


async def calc_merged_freqs(worker, request_json, raw_queries, subcpath, user_id, collator_locale):
    # TODO for performance testing switch between the three implementations
    # worker tasks-based implementation
    # from bgcalc.pquery.extra import calc_merged_freqs_worker
    # return await calc_merged_freqs_worker(worker, request_json, raw_queries, subcpath, user_id, collator_locale)
    # thread-based implementation
    # from bgcalc.pquery.extra import calc_merged_freqs_threaded
    # return await calc_merged_freqs_threaded(worker, request_json, raw_queries, subcpath, user_id, collator_locale)
    # default implementation:
    return await pquery.calc_merged_freqs(worker, request_json, raw_queries, subcpath, user_id, collator_locale)

# ----------------------------- DATA PRECALCULATION ---------------------------


async def compile_frq(corpus_ident, attr, logfile):
    """
    Precalculate freqency data for collocations and wordlists.
    (see freqs.build_arf_db)worker.py
    """
    corp = await _load_corp(corpus_ident)
    return await _compile_frq(corp, attr, logfile)


async def compile_arf(corpus_ident, attr, logfile):
    """
    Precalculate ARF data for collocations and wordlists.
    (see freqs.build_arf_db)
    """
    corp = await _load_corp(corpus_ident)
    num_wait = 20
    base_paths = freqs.corp_freqs_cache_paths(corp, attr)

    if not is_compiled(corp, attr, 'freq'):
        frq_data_file = corp.freq_precalc_file(attr, 'frq')
        while num_wait > 0 and await freqs.calc_is_running([base_paths['frq']]):
            if await aiofiles.os.path.isfile(frq_data_file):
                break
            time.sleep(1)
            num_wait -= 1
        if not await aiofiles.os.path.isfile(frq_data_file):
            await _compile_frq(corp, attr, logfile)
        corp = await _load_corp(corpus_ident)  # must reopen freq files
    if is_compiled(corp, attr, 'arf'):
        async with aiofiles.open(logfile, 'a') as f:
            await f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'arf already compiled'}
    else:
        with stderr_redirector(open(logfile, 'a')):
            corp.compile_arf(attr)
            async with aiofiles.open(logfile, 'a') as f:
                await f.write('\n100 %\n')
    return {'message': 'OK', 'last_log_record': await freqs.get_log_last_line(logfile)}


async def compile_docf(corpus_ident, attr, logfile):
    """
    Precalculate document counts data for collocations and wordlists.
    (see freqs.build_arf_db)
    """
    corp = await _load_corp(corpus_ident)
    if is_compiled(corp, attr, 'docf'):
        async with aiofiles.open(logfile, 'a') as f:
            await f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'docf already compiled'}
    doc_struct = corp.get_conf('DOCSTRUCTURE')
    try:
        doc = corp.get_struct(doc_struct)
        with stderr_redirector(open(logfile, 'a')):
            corp.compile_docf(attr, doc.name)
            async with aiofiles.open(logfile, 'a') as f:
                await f.write('\n100 %\n')
        return {'message': 'OK', 'last_log_record': await freqs.get_log_last_line(logfile)}
    except manatee.AttrNotFound:
        corp_id = corpus_ident.corpname if isinstance(
            corpus_ident, SubcorpusIdent) else corpus_ident
        raise WorkerTaskException('Failed to compile docf: attribute {}.{} not found in {}'.format(
                                  doc_struct, attr, corp_id))


# ----------------------------- SUBCORPORA ------------------------------------


async def create_subcorpus(
        user_id,
        specification: Union[CreateSubcorpusArgs, CreateSubcorpusWithinArgs, CreateSubcorpusRawCQLArgs],
        subcorpus_id: SubcorpusIdent,
        path: str
):
    try:
        worker = subc_calc.CreateSubcorpusTask(user_id=user_id)
        return await worker.run(specification, subcorpus_id, path)
    except Exception as ex:
        msg = getattr(ex, 'message', None)
        if not msg:
            msg = 'Caused by: {0}'.format(ex.__class__.__name__)
        raise WorkerTaskException(msg)


# ----------------------------- WORD LIST -------------------------------------

async def get_wordlist(corpus_ident: Union[str, SubcorpusRecord], args, max_items):
    form = WordlistFormArgs.from_dict(args)
    corp = await _load_corp(corpus_ident)
    await wordlist.wordlist(corp, form, max_items)


# ----------------------------- PLUG-IN TASKS ---------------------------------


custom_tasks = None
