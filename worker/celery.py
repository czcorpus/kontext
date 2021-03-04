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
import sys
import pickle

APP_PATH = os.path.realpath(f'{os.path.dirname(os.path.abspath(__file__))}/..')
sys.path.insert(0, f'{APP_PATH}/lib')
import settings
import plugins

settings.load(os.path.join(APP_PATH, 'conf', 'config.xml'))
if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

from worker import general
import bgcalc

app = bgcalc.calc_backend_server(settings, '').app_impl


class CustomTasks(object):
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
                            app.task(tsk, name='%s.%s' % (p.name, tsk.__name__,)))


# ----------------------------- CONCORDANCE -----------------------------------


@app.task(bind=True, name='conc_register')
def conc_register(self, user_id, corpus_id, subc_name, subchash, query, samplesize, time_limit):
    return general.conc_register(self, user_id, corpus_id, subc_name, subchash, query, samplesize, time_limit, app)


@app.task(bind=True, name='conc_calculate')
def conc_calculate(self, initial_args, user_id, corpus_name, subc_name, subchash, query, samplesize):
    return general.conc_calculate(self, initial_args, user_id, corpus_name, subc_name, subchash, query, samplesize)


@app.task(bind=True, name='conc_sync_calculate')
def conc_sync_calculate(self, user_id, corpus_name, subc_name, subchash, query, samplesize):
    return general.conc_sync_calculate(self, user_id, corpus_name, subc_name, subchash, query, samplesize)


# ----------------------------- COLLOCATIONS ----------------------------------


class CollsTask(app.Task):

    cache_data = None
    cache_path = None

    def after_return(self, *args, **kw):
        if self.cache_data:
            with open(self.cache_path, 'wb') as f:
                pickle.dump(self.cache_data, f)
                self.cache_data = None


@app.task(base=CollsTask, name='calculate_colls')
def calculate_colls(coll_args):
    return general.calculate_colls(coll_args)


@app.task(name='clean_colls_cache')
def clean_colls_cache():
    return general.clean_colls_cache()


# ----------------------------- FREQUENCY DISTRIBUTION ------------------------


class FreqsTask(app.Task):

    cache_data = None
    cache_path = None

    def after_return(self, *args, **kw):
        if self.cache_data:
            with open(self.cache_path, 'wb') as f:
                pickle.dump(self.cache_data, f)
                self.cache_data = None


@app.task(base=FreqsTask, name='calculate_freqs')
def calculate_freqs(args):
    return general.calculate_freqs(args)


@app.task(name='calculate_freqs_ct')
def calculate_freqs_ct(args):
    return general.calculate_freqs_ct(args)


@app.task(name='clean_freqs_cache')
def clean_freqs_cache():
    return general.clean_freqs_cache()


@app.task(name='calc_merged_freqs')
def calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale):
    return general.calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale)

# ----------------------------- DATA PRECALCULATION ---------------------------


@app.task(name='compile_frq')
def compile_frq(corp_id, subcorp_path, attr, logfile):
    return general.compile_frq(corp_id, subcorp_path, attr, logfile)


@app.task(name='compile_arf')
def compile_arf(corp_id, subcorp_path, attr, logfile):
    return general.compile_arf(corp_id, subcorp_path, attr, logfile)


@app.task(name='compile_docf')
def compile_docf(corp_id, subcorp_path, attr, logfile):
    return general.compile_docf(corp_id, subcorp_path, attr, logfile)


# ----------------------------- SUBCORPORA ------------------------------------


@app.task(name='create_subcorpus')
def create_subcorpus(user_id, corp_id, path, publish_path, tt_query, cql, author, description):
    return general.create_subcorpus(user_id, corp_id, path, publish_path, tt_query, cql, author, description)


# ----------------------------- PLUG-IN TASKS ---------------------------------


custom_tasks = CustomTasks()
