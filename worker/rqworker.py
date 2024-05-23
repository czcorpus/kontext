# Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import os
import sys
from typing import Union

import redis
import uvloop
from rq import Connection, Worker, get_current_job

APP_PATH = os.path.realpath(f'{os.path.dirname(os.path.abspath(__file__))}/..')
sys.path.insert(0, os.path.join(APP_PATH, 'lib'))
sys.path.insert(0, os.path.join(APP_PATH, 'worker'))

import plugins
import settings
from util import as_sync

if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

import logging

import general
from action.argmapping.subcorpus import (
    CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs)
from bgcalc.adapter.factory import init_backend
from bgcalc.adapter.rq import handle_custom_exception
from corplib.abstract import SubcorpusIdent
from log_formatter import KontextLogFormatter

uvloop.install()

worker = init_backend(settings, 'rq')


class TaskWrapper:

    def __init__(self, job):
        self.request = job


# ----------------------------- CONCORDANCE -----------------------------------

@as_sync
@handle_custom_exception
async def conc_register(user_id, corpus_ident, corp_cache_key, query, cutoff, time_limit):
    return await general.conc_register(
        TaskWrapper(get_current_job()), user_id, corpus_ident, corp_cache_key, query, cutoff, time_limit, worker)


@as_sync
@handle_custom_exception
async def conc_calculate(initial_args, user_id, corpus_ident, corp_cache_key, query, cutoff):
    return await general.conc_calculate(TaskWrapper(get_current_job()), initial_args, user_id, corpus_ident, corp_cache_key, query, cutoff)


@as_sync
@handle_custom_exception
async def conc_sync_calculate(user_id, corpus_name, subc_name, corp_cache_key, query, cutoff):
    return await general.conc_sync_calculate(TaskWrapper(get_current_job()), user_id, corpus_name, subc_name, corp_cache_key, query, cutoff)


# ----------------------------- COLLOCATIONS ----------------------------------


@as_sync
@handle_custom_exception
async def calculate_colls(coll_args):
    return await general.calculate_colls(coll_args)


@as_sync
@handle_custom_exception
async def clean_colls_cache():
    return await general.clean_colls_cache()


# ----------------------------- FREQUENCY DISTRIBUTION ------------------------


@as_sync
@handle_custom_exception
async def calculate_freqs(args):
    return await general.calculate_freqs(args)


@as_sync
@handle_custom_exception
async def calculate_freq2d(args):
    return await general.calculate_freq2d(args)


@as_sync
@handle_custom_exception
async def clean_freqs_cache():
    return await general.clean_freqs_cache()


@as_sync
@handle_custom_exception
async def calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale):
    return await general.calc_merged_freqs(worker, request_json, raw_queries, subcpath, user_id, collator_locale)

# ----------------------------- DATA PRECALCULATION ---------------------------


@as_sync
@handle_custom_exception
async def compile_frq(corpus_ident, attr, logfile):
    return await general.compile_frq(corpus_ident, attr, logfile)


@as_sync
@handle_custom_exception
async def compile_arf(corpus_ident, attr, logfile):
    return await general.compile_arf(corpus_ident, attr, logfile)


@as_sync
@handle_custom_exception
async def compile_docf(corpus_ident, attr, logfile):
    return await general.compile_docf(corpus_ident, attr, logfile)

# ----------------------------- WORD LIST -------------------------------------


@as_sync
@handle_custom_exception
async def get_wordlist(corpus_ident: Union[str, SubcorpusIdent], args, max_items):
    return await general.get_wordlist(corpus_ident, args, max_items)

# ----------------------------- KEYWORDS --------------------------------------


@as_sync
@handle_custom_exception
async def get_keywords(corpus_ident: Union[str, SubcorpusIdent], ref_corpus_ident: Union[str, SubcorpusIdent], args, max_items):
    return await general.get_keywords(corpus_ident, ref_corpus_ident, args, max_items)

# ----------------------------- SUBCORPORA ------------------------------------


@as_sync
@handle_custom_exception
async def create_subcorpus(
        user_id,
        specification: Union[CreateSubcorpusArgs, CreateSubcorpusWithinArgs, CreateSubcorpusRawCQLArgs],
        subcorpus_id: SubcorpusIdent,
        path: str
):
    return await general.create_subcorpus(user_id, specification, subcorpus_id, path)


# ----------------------------- PLUG-IN TASKS ---------------------------------

# creates [plugin_name]__[task_name] tasks
for p in plugins.runtime:
    if callable(getattr(p.instance, 'export_tasks', None)):
        for tsk in p.instance.export_tasks():
            globals()[f'{p.name}__{tsk.__name__}'] = as_sync(tsk)


if __name__ == "__main__":
    with Connection(redis.Redis(
        host=settings.get('calc_backend', 'rq_redis_host'),
        port=settings.get('calc_backend', 'rq_redis_port'),
        db=settings.get('calc_backend', 'rq_redis_db')
    )):

        logging_handlers = []
        if settings.contains('logging', 'stderr'):
            handler = logging.StreamHandler(sys.stderr)
        elif settings.contains('logging', 'stdout'):
            handler = logging.StreamHandler(sys.stdout)
        elif settings.contains('calc_backend', 'rq_log_path'):
            handler = logging.FileHandler(settings.get('calc_backend', 'rq_log_path'))

        if handler:
            handler.setFormatter(KontextLogFormatter())
            logging_handlers.append(handler)

        logging.basicConfig(
            handlers=logging_handlers,
            level=logging.INFO if not settings.is_debug_mode() else logging.DEBUG
        )

        qs = sys.argv[1:] or ['default']
        worker.init_scheduler()
        w = Worker(qs)
        w.work()
