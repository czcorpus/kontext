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
from rq import Connection, Worker, get_current_job
import redis

APP_PATH = os.path.realpath(f'{os.path.dirname(os.path.abspath(__file__))}/..')
sys.path.insert(0, os.path.join(APP_PATH, 'lib'))
sys.path.insert(0, os.path.join(APP_PATH, 'worker'))

import settings
import plugins

settings.load(os.path.join(APP_PATH, 'conf', 'config.xml'))
if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

import general
import bgcalc
import logging

worker = bgcalc.calc_backend_server(settings, 'rq')


class TaskWrapper:

    def __init__(self, job):
        self.request = job


# ----------------------------- CONCORDANCE -----------------------------------


def conc_register(user_id, corpus_id, subc_name, subchash, query, samplesize, time_limit):
    return general.conc_register(TaskWrapper(get_current_job()), user_id, corpus_id, subc_name, subchash, query, samplesize, time_limit, worker)


def conc_calculate(initial_args, user_id, corpus_name, subc_name, subchash, query, samplesize):
    return general.conc_calculate(TaskWrapper(get_current_job()), initial_args, user_id, corpus_name, subc_name, subchash, query, samplesize)


def conc_sync_calculate(user_id, corpus_name, subc_name, subchash, query, samplesize):
    return general.conc_sync_calculate(TaskWrapper(get_current_job()), user_id, corpus_name, subc_name, subchash, query, samplesize)


# ----------------------------- COLLOCATIONS ----------------------------------


def calculate_colls(coll_args):
    return general.calculate_colls(coll_args)


def clean_colls_cache():
    return general.clean_colls_cache()


# ----------------------------- FREQUENCY DISTRIBUTION ------------------------


def calculate_freqs(args):
    return general.calculate_freqs(args)


def calculate_freqs_ct(args):
    return general.calculate_freqs_ct(args)


def clean_freqs_cache():
    return general.clean_freqs_cache()


def calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale):
    return general.calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale)

# ----------------------------- DATA PRECALCULATION ---------------------------


def compile_frq(user_id, corp_id, subcorp: str, attr, logfile):
    return general.compile_frq(user_id, corp_id, subcorp, attr, logfile)


def compile_arf(user_id, corp_id, subcorp: str, attr, logfile):
    return general.compile_arf(user_id, corp_id, subcorp, attr, logfile)


def compile_docf(user_id, corp_id, subcorp: str, attr, logfile):
    return general.compile_docf(user_id, corp_id, subcorp, attr, logfile)

# ----------------------------- WORD LIST -------------------------------------


def get_wordlist(args, max_items, user_id):
    return general.get_wordlist(args, max_items, user_id)

# ----------------------------- SUBCORPORA ------------------------------------


def create_subcorpus(user_id, corp_id, path, publish_path, tt_query, cql, author, description):
    return general.create_subcorpus(user_id, corp_id, path, publish_path, tt_query, cql, author, description)


# ----------------------------- PLUG-IN TASKS ---------------------------------


# creates [plugin_name]__[task_name] tasks
for p in plugins.runtime:
    if callable(getattr(p.instance, 'export_tasks', None)):
        for tsk in p.instance.export_tasks():
            globals()[f'{p.name}__{tsk.__name__}'] = tsk


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
            handler.setFormatter(logging.Formatter(
                fmt='%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
            logging_handlers.append(handler)

        logging.basicConfig(
            handlers=logging_handlers,
            level=logging.INFO if not settings.is_debug_mode() else logging.DEBUG
        )

        qs = sys.argv[1:] or ['default']
        worker.init_scheduler()
        w = Worker(qs)
        w.work()
