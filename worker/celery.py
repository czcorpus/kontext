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

import os
import pickle
import sys

import uvloop

APP_PATH = os.path.realpath(f'{os.path.dirname(os.path.abspath(__file__))}/..')
sys.path.insert(0, f'{APP_PATH}/lib')
import plugins
import settings
from util import as_sync

settings.load(os.path.join(APP_PATH, 'conf', 'config.xml'))
if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

from bgcalc.adapter.factory import init_backend

from worker import general

uvloop.install()

worker = init_backend(settings, '')


class CustomTasks:
    """
    Dynamically register tasks exposed by active plug-ins.

    Once a plug-in defines a method 'export_tasks()' returning
    a list of functions, this class generates a list of
    tasks named [plugin_name].[function_name]. E.g. if
    the 'db' plugin exports a list of functions containing
    a single function 'vacuum()' then the class adds a new
    task 'db.vacuum'.
    """

    def __init__(self):
        for p in plugins.runtime:
            if callable(getattr(p.instance, 'export_tasks', None)):
                for tsk in p.instance.export_tasks():
                    setattr(self, '%s_%s' % (p.name, tsk.__name__,),
                            worker.task(as_sync(tsk), name='%s.%s' % (p.name, tsk.__name__,)))


# ----------------------------- CONCORDANCE -----------------------------------


@worker.task(bind=True, name='conc_register')
@as_sync
async def conc_register(self, user_id, corpus_id, subc_name, subchash, query, samplesize, time_limit):
    return general.conc_register(self, user_id, corpus_id, subc_name, subchash, query, samplesize, time_limit, worker)


@worker.task(bind=True, name='conc_calculate')
@as_sync
async def conc_calculate(self, initial_args, user_id, corpus_name, subc_name, subchash, query, samplesize):
    return general.conc_calculate(self, initial_args, user_id, corpus_name, subc_name, subchash, query, samplesize)


@worker.task(bind=True, name='conc_sync_calculate')
@as_sync
async def conc_sync_calculate(self, user_id, corpus_name, subc_name, subchash, query, samplesize):
    return general.conc_sync_calculate(self, user_id, corpus_name, subc_name, subchash, query, samplesize)


# ----------------------------- COLLOCATIONS ----------------------------------

@worker.task(name='calculate_colls')
@as_sync
async def calculate_colls(coll_args):
    return general.calculate_colls(coll_args)


@worker.task(name='clean_colls_cache')
@as_sync
async def clean_colls_cache():
    return general.clean_colls_cache()


# ----------------------------- FREQUENCY DISTRIBUTION ------------------------


@worker.task(name='calculate_freqs')
@as_sync
async def calculate_freqs(args):
    return await general.calculate_freqs(args)


@worker.task(name='calculate_freq2d')
@as_sync
async def calculate_freq2d(args):
    return await general.calculate_freq2d(args)


@worker.task(name='clean_freqs_cache')
@as_sync
async def clean_freqs_cache():
    return await general.clean_freqs_cache()


@worker.task(name='calc_merged_freqs')
@as_sync
async def calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale):
    return await general.calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale)

# ----------------------------- DATA PRECALCULATION ---------------------------


@worker.task(name='compile_frq')
@as_sync
async def compile_frq(user_id, corp_id, subcorp, attr, logfile):
    return await general.compile_frq(user_id, corp_id, subcorp, attr, logfile)


@worker.task(name='compile_arf')
@as_sync
async def compile_arf(user_id, corp_id, subcorp: str, attr, logfile):
    return await general.compile_arf(user_id, corp_id, subcorp, attr, logfile)


@worker.task(name='compile_docf')
@as_sync
async def compile_docf(user_id, corp_id, subcorp: str, attr, logfile):
    return await general.compile_docf(user_id, corp_id, subcorp, attr, logfile)

# ----------------------------- SUBCORPORA ------------------------------------


@worker.task(name='create_subcorpus')
@as_sync
async def create_subcorpus(user_id, corp_id, path, publish_path, tt_query, cql, author, description):
    return await general.create_subcorpus(user_id, corp_id, path, publish_path, tt_query, cql, author, description)


# ----------------------------- WORD LIST -------------------------------------

@worker.task(name='get_wordlist')
@as_sync
async def get_wordlist(args, max_items, user_id):
    return await general.get_wordlist(args, max_items, user_id)


# ----------------------------- PLUG-IN TASKS ---------------------------------


custom_tasks = CustomTasks()
