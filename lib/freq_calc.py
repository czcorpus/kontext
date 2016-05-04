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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import os
import re
from datetime import datetime
import time
import math
import hashlib
import cPickle

import corplib
import conclib
import settings

MAX_LOG_FILE_AGE = 1800  # in seconds


def corp_freqs_cache_path(corp, attrname):
    """
    Generates an absolute path to an 'attribute' directory/file. The path
    consists of two parts: 1) absolute path to corpus indexed data
    2) filename given by the 'attrname' argument. It is also dependent
    on whether you pass a subcorpus (files are created in user's assigned directory)
    or a regular corpus (files are created in the 'cache' directory).

    arguments:
    corp -- manatee corpus instance
    attrname -- name of an attribute

    returns:
    a path encoded as an 8-bit string (i.e. unicode paths are encoded)
    """
    if hasattr(corp, 'spath'):
        ans = corp.spath.decode('utf-8')[:-4] + attrname
    else:
        cache_dir = os.path.abspath(settings.get('corpora', 'freqs_precalc_dir'))
        subdirs = (corp.corpname,)
        for d in subdirs:
            cache_dir = '%s/%s' % (cache_dir, d)
            if not os.path.exists(cache_dir):
                os.makedirs(cache_dir)
        ans = '%s/%s' % (cache_dir, attrname)
    return ans.encode('utf-8')


def prepare_arf_calc_paths(corp, attrname, logstep=0.02):
    """
    Calculates frequencies, ARFs and document frequencies for a specified corpus. Because this
    is quite computationally demanding the function is typically called in background by KonText.

    arguments:
    corp -- a corpus instance
    attrname -- name of a positional or structure's attribute
    logstep -- specifies how often (as a ratio of calculated data) should the logfile be updated
    """
    outfilename = corplib.subcorp_base_file(corp, attrname).encode('utf-8')
    if os.path.isfile(outfilename + '.arf') and os.path.isfile(outfilename + '.docf'):
        return None
    elif hasattr(corp, 'spath'):
        return corp.spath
    else:
        return None


def create_log_path(base_path, calc_type):
    return '%s.%s.build' % (base_path, calc_type)


def get_log_last_line(path):
    with open(path, 'r') as f:
        s = f.read()
        if len(s) > 0:
            return re.split(r'[\r\n]', s.strip())[-1]
        return None


def _get_total_calc_status(base_path):
    items = []
    for m in ('frq', 'arf', 'docf'):
        try:
            log_file = create_log_path(base_path, m)
            last_line = get_log_last_line(log_file)
            p = int(re.split(r'\s+', last_line)[0])
        except:
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
        f.write('%d\n%s\n0 %%' % (os.getpid(), corp.search_size()))


def build_arf_db(corp, attrname):
    """
    Provides a higher level wrapper to create_arf_db(). Function creates
    a background process where create_arf_db() is run.
    """
    base_path = corp_freqs_cache_path(corp, attrname)
    if calc_is_running(base_path):
        curr_status = _get_total_calc_status(base_path)
        if curr_status < 100:
            return curr_status

    subc_path = prepare_arf_calc_paths(corp, attrname)
    backend, conf = settings.get_full('global', 'calc_backend')
    if backend == 'celery':
        import task
        app = task.get_celery_app(conf['conf'])
        task_ids = []
        for m in ('frq', 'arf', 'docf'):
            logfilename_m = create_log_path(base_path, m)
            write_log_header(corp, logfilename_m)
            res = app.send_task('worker.compile_%s' % m, (corp.corpname, subc_path, attrname, logfilename_m))
            task_ids.append(res.id)
        return task_ids

    elif backend == 'multiprocessing':
        import subprocess

        for m in ('frq', 'arf', 'docf'):
            logfilename_m = create_log_path(base_path, m)
            open(logfilename_m, 'w').write('%d\n%s\n0 %%' % (os.getpid(), corp.search_size()))
            log = " 2>> '%s'" % logfilename_m
            if subc_path:
                cmd = u"mkstats '%s' '%s' %%s '%s' %s" % (corp.get_confpath(), attrname,
                                                      subc_path.decode('utf-8'), log.decode('utf-8'))
                cmd = cmd.encode('utf-8')
            else:
                cmd = "mkstats '%s' '%s' %%s %s" % (corp.get_confpath(), attrname, log)
            subprocess.call(cmd % 'frq', shell=True)
        return []


def build_arf_db_status(corp, attrname):
    return _get_total_calc_status(corp_freqs_cache_path(corp, attrname))


class FreqCalc(object):
    """
    Calculates a frequency distribution based on a defined concordance and frequency-related arguments.
    The class is able to cache the data in a background process/task. This prevents KonText to calculate
    (via Manatee) full frequency list.
    """

    # a minimum data size for cache to be applied (configured
    # via 'kontext/corpora/freqs_cache_min_lines')
    DEFAULT_MIN_CACHED_FILE_ITEMS = 200

    def __init__(self, corpname, subcname, user_id, subcpath, minsize=None, q=None, fromp=0, pagesize=0,
                 save=0, samplesize=0):
        """
        Creates a new freq calculator with fixed concordance parameters.
        """
        self._corpname = corpname
        self._subcname = subcname
        self._user_id = user_id
        self._minsize = minsize
        self._q = q
        self._fromp = fromp
        self._pagesize = pagesize
        self._save = save
        self._samplesize = samplesize
        self._subcpath = subcpath

    def _cache_file_path(self, fcrit, flimit, freq_sort, ml, ftt_include_empty, rel_mode, collator_locale):
        v = str(self._corpname) + str(self._subcname) + str(self._user_id) + ''.join(self._q).encode('utf-8') + \
            str(fcrit) + str(flimit) + str(freq_sort) + str(ml) + str(ftt_include_empty) + str(rel_mode) + \
            str(collator_locale)
        filename = '%s.pkl' % hashlib.sha1(v).hexdigest()
        return os.path.join(settings.get('corpora', 'freqs_cache_dir'), filename)

    @property
    def min_cached_data_size(self):
        return settings.get_int('corpora', 'freqs_cache_min_lines', FreqCalc.DEFAULT_MIN_CACHED_FILE_ITEMS)

    def calc_freqs(self, flimit, freq_sort, ml, rel_mode, fcrit, ftt_include_empty, collator_locale, fmaxitems, fpage,
                   line_offset):
        """
        Calculate actual frequency data.

        Returns:
        a 2-tuple (freq_data, caching_data) where:
            freq_data = dict(lastpage=..., data=..., fstart=..., fmaxitems=..., conc_size=...)
            caching_data = dict(data=..., cache_path=...); can be also None which means 'do not cache'
        """
        cache_path = self._cache_file_path(fcrit, flimit, freq_sort, ml, ftt_include_empty, rel_mode, collator_locale)
        cache_ans = None

        if os.path.isfile(cache_path):
            with open(cache_path, 'rb') as f:
                data, conc_size = cPickle.load(f)
        else:
            cm = corplib.CorpusManager(subcpath=self._subcpath)
            corp = cm.get_Corpus(self._corpname, self._subcname)
            conc = conclib.get_conc(corp=corp, user_id=self._user_id, minsize=self._minsize, q=self._q,
                                    fromp=self._fromp, pagesize=self._pagesize, async=0, save=self._save,
                                    samplesize=self._samplesize)
            conc_size = conc.size()
            data = [conc.xfreq_dist(cr, flimit, freq_sort, ml, ftt_include_empty, rel_mode, collator_locale)
                    for cr in fcrit]

        lastpage = None
        if len(data) == 1:  # a single block => pagination
            total_length = len(data[0]['Items'])
            if total_length >= self.min_cached_data_size:
                cache_ans = dict(data=(data, conc_size), cache_path=cache_path)
            items_per_page = fmaxitems
            fstart = (fpage - 1) * fmaxitems + line_offset
            fmaxitems = fmaxitems * fpage + 1 + line_offset
            if total_length < fmaxitems:
                lastpage = 1
            else:
                lastpage = 0
            ans = [dict(Total=total_length,
                        TotalPages=int(math.ceil(total_length / float(items_per_page))),
                        Items=data[0]['Items'][fstart:fmaxitems - 1],
                        Head=data[0]['Head'])]
        else:
            ans = data
            fstart = None
        return dict(lastpage=lastpage, data=ans, fstart=fstart, fmaxitems=fmaxitems,
                    conc_size=conc_size), cache_ans


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


def calculate_freqs_mp(**kw):
    """
    Calculate frequencies via multiprocessing package. Please note
    that this is not suitable for Gunicorn-based installations as forking
    new processes may confuse its process pool in a quite bad way. In such case
    it is highly recommended to use 'celery' based calculation which is
    fully decoupled from the webserver process.
    """
    import multiprocessing

    def cache_results(data):
        with open(data['cache_path'], 'wb') as f:
            cPickle.dump(data['data'], f)

    fc = FreqCalc(corpname=kw['corpname'], subcname=kw['subcname'], user_id=kw['user_id'],
                  minsize=kw['minsize'], q=kw['q'], fromp=kw['fromp'], pagesize=kw['pagesize'],
                  save=kw['save'], samplesize=kw['samplesize'], subcpath=kw['subcpath'])
    ans, cache_ans = fc.calc_freqs(flimit=kw['flimit'], freq_sort=kw['freq_sort'], ml=kw['ml'],
                                   rel_mode=kw['rel_mode'], fcrit=kw['fcrit'],
                                   ftt_include_empty=kw['ftt_include_empty'],
                                   collator_locale=kw['collator_locale'],
                                   fmaxitems=kw['fmaxitems'], fpage=kw['fpage'],
                                   line_offset=kw['line_offset'])
    if cache_ans:
        multiprocessing.Process(target=cache_results, args=(cache_ans,)).start()
    return ans
