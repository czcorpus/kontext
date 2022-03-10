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
import importlib.util
import sys
import time
import pickle

APP_PATH = os.path.realpath(f'{os.path.dirname(os.path.abspath(__file__))}/..')
sys.path.insert(0, f'{APP_PATH}/../lib')
import settings
from action.plugin import initializer
import translation
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
initializer.init_plugin('query_history')
initializer.init_plugin('query_persistence')
initializer.init_plugin('sessions')
initializer.init_plugin('user_items')
initializer.init_plugin('corparch')
initializer.init_plugin('token_connect', optional=True)
initializer.init_plugin('live_attributes', optional=True)
initializer.init_plugin('dispatch_hook', optional=True)

translation.load_translations(settings.get('global', 'translations'))
translation.activate('en_US')  # background jobs do not need localization

import conclib.calc
import conclib.calc.base
from corplib import CorpusManager
from corplib.corpus import KCorpus
from bgcalc import (freq_calc, subc_calc, coll_calc, pquery, wordlist)
from action.argmapping.wordlist import WordlistFormArgs

stderr_redirector = get_stderr_redirector(settings)


def load_script_module(name, path):
    return importlib.util.spec_from_file_location(name, path)


class WorkerTaskException(Exception):
    pass


def is_compiled(corp: KCorpus, attr, method):
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
    if getattr(attr, method)(last) != -1:
        sys.stdout.write('%s already compiled, skipping.\n' % method)
        return True
    return False


def _load_corp(corp_id, subc: str, user_id):
    """
    Instantiate a manatee.Corpus (or manatee.SubCorpus)
    instance

    arguments:
    corp_id -- a corpus identifier
    subc -- a subcorpus identifier (None if not defined)
    user_id --
    """
    subc_paths = [os.path.join(settings.get('corpora', 'users_subcpath'), 'published')]
    if user_id is not None:
        subc_paths.insert(0, os.path.join(settings.get('corpora', 'users_subcpath'), str(user_id)))
    cm = CorpusManager(subc_paths)
    return cm.get_corpus(corp_id, '', subc)


def _compile_frq(corp: KCorpus, attr, logfile):
    """
    Generate pre-calculated data for frequency distribution pages.

    arguments:
    corp -- a manatee.Corpus instance
    attr -- an attribute name
    logfile -- a file where calculation status will be written
               (bonito-open approach)
    """
    if is_compiled(corp, attr, 'freq'):
        with open(logfile, 'a') as f:
            f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'freq already compiled'}
    with stderr_redirector(open(logfile, 'a')):
        corp.compile_frq(attr)
        with open(logfile, 'a') as f:
            f.write('\n100 %\n')
    return {'message': 'OK', 'last_log_record': freq_calc.get_log_last_line(logfile)}


# ----------------------------- CONCORDANCE -----------------------------------


def conc_register(self, user_id, corpus_id, subc_name, subchash, query, samplesize, time_limit, worker):
    """
    Register concordance calculation and initiate the calculation.

    arguments:
    user_id -- an identifier of the user who entered the query (used to specify subc. directory if needed)
    corpus_id -- a corpus identifier
    subc_name -- a sub-corpus identifier (None if not used)
    subchash -- a MD5 checksum of the sub-corpus data file
    query -- a query tuple
    samplesize -- a row number limit (if 0 then unlimited - see Manatee API)
    time_limit -- a time limit (in seconds) for the main conc. task

    returns:
    a dict(cachefile=..., pidfile=..., stored_pidfile=...)
    """
    reg_fn = conclib.calc.base.TaskRegistration(task_id=self.request.id)
    subc_path = os.path.join(settings.get('corpora', 'users_subcpath'), str(user_id))
    pub_path = os.path.join(settings.get('corpora', 'users_subcpath'), 'published')
    initial_args = reg_fn(corpus_id, subc_name, subchash, (subc_path, pub_path), query, samplesize)
    if not initial_args['already_running']:   # we are first trying to calc this
        worker.send_task_sync(
            'conc_calculate', object.__class__,
            args=(initial_args, user_id, corpus_id, subc_name, subchash, query, samplesize),
            soft_time_limit=time_limit)
        # there is no return from the send_task as we obtain the status via conc cache map
    return initial_args


def conc_calculate(self, initial_args, user_id, corpus_name, subc_name, subchash, query, samplesize):
    """
    Perform actual concordance calculation.
    This is called automatically by the 'register()' function above.

    arguments:
    initial_args -- a dict(cachefile=..., pidfile=..., stored_pidfile=...) as obtained from register()
    user_id -- an identifier of the user who entered the query (used to specify subc. directory if needed)
    corpus_id -- a corpus identifier
    subc_name -- a sub-corpus identifier (None if not used)
    subchash -- a MD5 checksum of the sub-corpus data file
    query -- a query tuple
    samplesize -- a row number limit (if 0 then unlimited - see Manatee API)
    """
    task = conclib.calc.ConcCalculation(task_id=self.request.id)
    subc_path = os.path.join(settings.get('corpora', 'users_subcpath'), str(user_id))
    pub_path = os.path.join(settings.get('corpora', 'users_subcpath'), 'published')
    return task(initial_args, (subc_path, pub_path), corpus_name, subc_name, subchash, query, samplesize)


def conc_sync_calculate(self, user_id, corpus_name, subc_name, subchash, query, samplesize):
    subc_path = os.path.join(settings.get('corpora', 'users_subcpath'), str(user_id))
    pub_path = os.path.join(settings.get('corpora', 'users_subcpath'), 'published')
    conc_dir = os.path.join(settings.get('corpora', 'conc_dir'), str(user_id))
    task = conclib.calc.ConcSyncCalculation(task_id=self.request.id, cache_factory=None,
                                            subc_dirs=(
                                                subc_path, pub_path), corpus_name=corpus_name,
                                            subc_name=subc_name, conc_dir=conc_dir)
    return task(subchash, query, samplesize)


# ----------------------------- COLLOCATIONS ----------------------------------


def calculate_colls(coll_args: coll_calc.CollCalcArgs):
    """
    """
    ans = coll_calc.calculate_colls_bg(coll_args)
    if not ans['processing'] and len(ans['data']['Items']) > 0:
        with open(coll_args.cache_path, 'wb') as f:
            pickle.dump(ans['data'], f)
    return ans


def clean_colls_cache():
    return coll_calc.clean_colls_cache()


# ----------------------------- FREQUENCY DISTRIBUTION ------------------------


def calculate_freqs(args):
    args = freq_calc.FreqCalcArgs(**args)
    calculate_freqs.cache_path = args.cache_path
    ans = freq_calc.calculate_freqs_bg(args)
    trigger_cache_limit = settings.get_int('corpora', 'freqs_cache_min_lines', 10)
    if args.force_cache or max(len(d.get('Items', ())) for d in ans['freqs']) >= trigger_cache_limit:
        calculate_freqs.cache_data = ans
    else:
        calculate_freqs.cache_data = None
    return ans


def calculate_freq2d(args: freq_calc.Freq2DCalcArgs):
    return freq_calc.Freq2DCalculation(args).run()


def clean_freqs_cache():
    return freq_calc.clean_freqs_cache()


def calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale):
    return pquery.calc_merged_freqs(request_json, raw_queries, subcpath, user_id, collator_locale)

# ----------------------------- DATA PRECALCULATION ---------------------------


def compile_frq(user_id, corp_id, subcorp, attr, logfile):
    """
    Precalculate freqency data for collocations and wordlists.
    (see freq_calc.build_arf_db)worker.py
    """
    corp = _load_corp(corp_id, subcorp, user_id)
    return _compile_frq(corp, attr, logfile)


def compile_arf(user_id, corp_id, subcorp, attr, logfile):
    """
    Precalculate ARF data for collocations and wordlists.
    (see freq_calc.build_arf_db)
    """
    corp = _load_corp(corp_id, subcorp, user_id)
    num_wait = 20
    if not is_compiled(corp, attr, 'freq'):
        base_path = freq_calc.corp_freqs_cache_path(corp, attr)
        frq_data_file = f'{base_path}.frq'
        while num_wait > 0 and freq_calc.calc_is_running(base_path, 'frq'):
            if os.path.isfile(frq_data_file):
                break
            time.sleep(1)
            num_wait -= 1
        if not os.path.isfile(frq_data_file):
            _compile_frq(corp, attr, logfile)
        corp = _load_corp(corp_id, subcorp, user_id)  # must reopen freq files
    if is_compiled(corp, attr, 'arf'):
        with open(logfile, 'a') as f:
            f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'arf already compiled'}
    else:
        with stderr_redirector(open(logfile, 'a')):
            corp.compile_arf(attr)
            with open(logfile, 'a') as f:
                f.write('\n100 %\n')
    return {'message': 'OK', 'last_log_record': freq_calc.get_log_last_line(logfile)}


def compile_docf(user_id, corp_id, subcorp, attr, logfile):
    """
    Precalculate document counts data for collocations and wordlists.
    (see freq_calc.build_arf_db)
    """
    corp = _load_corp(corp_id, subcorp, user_id)
    if is_compiled(corp, attr, 'docf'):
        with open(logfile, 'a') as f:
            f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'docf already compiled'}
    doc_struct = corp.get_conf('DOCSTRUCTURE')
    try:
        doc = corp.get_struct(doc_struct)
        with stderr_redirector(open(logfile, 'a')):
            corp.compile_docf(attr, doc.name)
            with open(logfile, 'a') as f:
                f.write('\n100 %\n')
        return {'message': 'OK', 'last_log_record': freq_calc.get_log_last_line(logfile)}
    except manatee.AttrNotFound:
        raise WorkerTaskException('Failed to compile docf: attribute {}.{} not found in {}'.format(
                                  doc_struct, attr, corp_id))


# ----------------------------- SUBCORPORA ------------------------------------


def create_subcorpus(user_id, corp_id, path, publish_path, tt_query, cql, author, description):
    try:
        worker = subc_calc.CreateSubcorpusTask(user_id=user_id, corpus_id=corp_id,
                                               description=description, author=author)
        return worker.run(tt_query, cql, path, publish_path)
    except Exception as ex:
        msg = getattr(ex, 'message', None)
        if not msg:
            msg = 'Caused by: {0}'.format(ex.__class__.__name__)
        raise WorkerTaskException(msg)


# ----------------------------- WORD LIST -------------------------------------

def get_wordlist(args, max_items, user_id):
    form = WordlistFormArgs.from_dict(args)
    corp = _load_corp(form.corpname, form.usesubcorp, user_id)
    wordlist.wordlist(corp, form, max_items)


# ----------------------------- PLUG-IN TASKS ---------------------------------


custom_tasks = None
