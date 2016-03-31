#  Copyright (c) 2008-2013  Pavel Rychly, Milos Jakubicek
# Copyright (c) 2015 Institute of the Czech National Corpus
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
import imp
import sys
import time
import cPickle

CURR_PATH = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '%s/lib' % CURR_PATH)
import settings
import initializer
import plugins
import translation
from stderr2f import stderr_redirector

settings.load('%s/conf/config.xml' % CURR_PATH)
if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))
import manatee

os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')
initializer.init_plugin('db')
initializer.init_plugin('sessions')
initializer.init_plugin('auth')
initializer.init_plugin('locking')
initializer.init_plugin('conc_cache')
initializer.init_plugin('conc_persistence')
initializer.init_plugin('sessions')

translation.load_translations(settings.get('global', 'translations'))
translation.activate('en_US')  # background jobs do not need localization

from concworker import wcelery
import task
import freq_calc
import subc_calc

_, conf = settings.get_full('global', 'calc_backend')
app = task.get_celery_app(conf['conf'])


def load_script_module(name, path):
    return imp.load_source(name, path)


class WorkerTaskException(Exception):
    pass


def is_compiled(corp, attr, method):
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


def _load_corp(corp_id, subc_path):
    corp = manatee.Corpus(corp_id)
    if subc_path:
        corp = manatee.SubCorpus(corp, subc_path)
    corp.corpname = corp_id
    return corp


def _compile_frq(corp, attr, logfile):
    if is_compiled(corp, attr, 'freq'):
        with open(logfile, 'a') as f:
            f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'freq already compiled'}
    with stderr_redirector(open(logfile, 'a')):
        corp.compile_frq(attr)
    return {'message': 'OK', 'last_log_record': freq_calc.get_log_last_line(logfile)}


class CustomTasks(object):
    """
    Dynamically register tasks exposed by active plug-ins
    """
    def __init__(self, plugin_names):
        for plugin_name in plugin_names:
            plg = plugins.get(plugin_name)
            if callable(getattr(plg, 'export_tasks', None)):
                for tsk in plg.export_tasks():
                    setattr(self, tsk.__name__,
                            app.task(tsk, name='%s.%s' % (plugin_name, tsk.__name__,)))


@app.task
def register(user_id, corpus_id, subc_name, subchash, query, samplesize):
    """
    Register concordance calculation and initiate the calculation.

    arguments:
    user_id -- an identifier of the user who entered the query (used to specify subc. directory if needed)
    corpus_id -- a corpus identifier
    subc_name -- a sub-corpus identifier (None if not used)
    subchash -- a MD5 checksum of the sub-corpus data file
    query -- a query tuple
    samplesize -- a row number limit (if 0 then unlimited - see Manatee API)

    returns:
    a dict(cachefile=..., pidfile=..., stored_pidfile=...)
    """
    reg_fn = wcelery.TaskRegistration()
    initial_args = reg_fn(corpus_id, subc_name, subchash, query, samplesize)
    if not initial_args.get('stored_pidfile'):   # we are first trying to calc this
        calculate.delay(initial_args, user_id, corpus_id, subc_name, subchash, query, samplesize)
    return initial_args


@app.task(ignore_result=True)  # TODO ignore? what about errors?
def calculate(initial_args, user_id, corpus_name, subc_name, subchash, query, samplesize):
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
    task = wcelery.CeleryCalculation()
    subc_path = '%s/%s' % (settings.get('corpora', 'users_subcpath'), user_id)
    return task(initial_args, subc_path, corpus_name, subc_name, subchash, query, samplesize)


class FreqsTask(app.Task):

    cache_data = None

    def after_return(self, *args, **kw):
        if self.cache_data:
            with open(self.cache_data['cache_path'], 'wb') as f:
                cPickle.dump(self.cache_data['data'], f)


@app.task(base=FreqsTask)
def calculate_freqs(**kw):
    fc = freq_calc.FreqCalc(corpname=kw['corpname'], subcname=kw['subcname'], user_id=kw['user_id'],
                            minsize=kw['minsize'], q=kw['q'], fromp=kw['fromp'], pagesize=kw['pagesize'],
                            save=kw['save'], samplesize=kw['samplesize'], subcpath=kw['subcpath'])
    ans, cache_ans = fc.calc_freqs(flimit=kw['flimit'], freq_sort=kw['freq_sort'], ml=kw['ml'],
                                   rel_mode=kw['rel_mode'], fcrit=kw['fcrit'],
                                   ftt_include_empty=kw['ftt_include_empty'],
                                   collator_locale=kw['collator_locale'],
                                   fmaxitems=kw['fmaxitems'], fpage=kw['fpage'],
                                   line_offset=kw['line_offset'])
    calculate_freqs.cache_data = cache_ans
    return ans


@app.task
def clean_freqs_cache():
    return freq_calc.clean_freqs_cache()


@app.task
def compile_frq(corp_id, subcorp_path, attr, logfile):
    """
    Precalculate freqency data for collocations and wordlists.
    (see freq_calc.build_arf_db)worker.py
    """
    corp = _load_corp(corp_id, subcorp_path)
    return _compile_frq(corp, attr, logfile)


@app.task
def compile_arf(corp_id, subcorp_path, attr, logfile):
    """
    Precalculate ARF data for collocations and wordlists.
    (see freq_calc.build_arf_db)
    """
    corp = _load_corp(corp_id, subcorp_path)
    num_wait = 20
    if not is_compiled(corp, attr, 'freq'):
        base_path = freq_calc.corp_freqs_cache_path(corp, attr)
        frq_data_file = '%s.frq' % base_path
        while num_wait > 0 and freq_calc.calc_is_running(base_path, 'frq'):
            if os.path.isfile(frq_data_file):
                break
            time.sleep(1)
            num_wait -= 1
        if not os.path.isfile(frq_data_file):
            _compile_frq(corp, attr, logfile)
        corp = _load_corp(corp_id, subcorp_path)  # must reopen freq files
    if is_compiled(corp, attr, 'arf'):
        with open(logfile, 'a') as f:
            f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'arf already compiled'}
    with stderr_redirector(open(logfile, 'a')):
        corp.compile_arf(attr)
    return {'message': 'OK', 'last_log_record': freq_calc.get_log_last_line(logfile)}


@app.task
def compile_docf(corp_id, subcorp_path, attr, logfile):
    """
    Precalculate document counts data for collocations and wordlists.
    (see freq_calc.build_arf_db)
    """
    corp = _load_corp(corp_id, subcorp_path)
    if is_compiled(corp, attr, 'docf'):
        with open(logfile, 'a') as f:
            f.write('\n100 %\n')  # to get proper calculation of total progress
        return {'message': 'docf already compiled'}
    doc_struct = corp.get_conf('DOCSTRUCTURE')
    try:
        doc = corp.get_struct(doc_struct)
        with stderr_redirector(open(logfile, 'a')):
            corp.compile_docf(attr, doc.name)
        return {'message': 'OK', 'last_log_record': freq_calc.get_log_last_line(logfile)}
    except manatee.AttrNotFound:
        raise WorkerTaskException('Failed to compile docf: attribute %s.%s not found in %s' % (
                                  doc_struct, attr, corp_id))


@app.task
def create_subcorpus(user_id, corp_id, path, tt_query, cql):
    worker = subc_calc.CreateSubcorpusTask(user_id=user_id, corpus_id=corp_id)
    return worker.run(tt_query, cql, path)



custom_tasks = CustomTasks(plugins.get_plugins())
