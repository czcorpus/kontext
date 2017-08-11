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
try:
    import cPickle as pickle
except ImportError:
    import pickle
from structures import FixedDict

import manatee
import corplib
import conclib
import settings
import plugins

MAX_LOG_FILE_AGE = 1800  # in seconds


class FreqCalsArgs(FixedDict):
    """
    Collects all the required arguments passed around when
    calculating frequency distribution
    """
    q = None
    user_id = None
    corpname = None
    # --- corp encoding ??
    collator_locale = None
    subcname = None
    subcpath = None
    minsize = None
    fromp = None  # ??
    pagesize = None  # ??
    fpage = None  # ??
    save = 0
    samplesize = 0
    flimit = None  # default ??
    fcrit = None
    freq_sort = None
    ml = None  # default ??
    ftt_include_empty = None  # default ??
    rel_mode = None
    fmaxitems = None  # default ??
    line_offset = None  # ??
    cache_path = None


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


class FreqCalcCache(object):

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
        v = (str(self._corpname) + unicode(self._subcname).encode('utf-8') + str(self._user_id) +
             ''.join(self._q).encode('utf-8') + str(fcrit) + str(flimit) + str(freq_sort) + str(ml) +
             str(ftt_include_empty) + str(rel_mode) + str(collator_locale))
        filename = '%s.pkl' % hashlib.sha1(v).hexdigest()
        return os.path.join(settings.get('corpora', 'freqs_cache_dir'), filename)

    def get(self, fcrit, flimit, freq_sort, ml, ftt_include_empty, rel_mode, collator_locale):
        cache_path = self._cache_file_path(fcrit, flimit, freq_sort, ml, ftt_include_empty, rel_mode, collator_locale)
        if os.path.isfile(cache_path):
            with open(cache_path, 'rb') as f:
                data = pickle.load(f)
        else:
            data = None
        return data, cache_path


def calc_freqs_bg(args):
    """
    Calculate actual frequency data.

    arguments:
    args -- a FreqCalsArgs instance

    returns:
    a dict(freqs=..., conc_size=...)
    """

    cm = corplib.CorpusManager(subcpath=args.subcpath)
    corp = cm.get_Corpus(args.corpname, args.subcname)
    conc = conclib.get_conc(corp=corp, user_id=args.user_id, minsize=args.minsize, q=args.q,
                            fromp=args.fromp, pagesize=args.pagesize, async=0, save=args.save,
                            samplesize=args.samplesize)
    conc_size = conc.size()
    freqs = [conc.xfreq_dist(cr, args.flimit, args.freq_sort, args.ml, args.ftt_include_empty, args.rel_mode,
                             args.collator_locale)
             for cr in args.fcrit]
    return dict(freqs=freqs, conc_size=conc_size)


def calculate_freqs(args):
    """
    Calculates a frequency distribution based on a defined concordance and frequency-related arguments.
    The class is able to cache the data in a background process/task. This prevents KonText to calculate
    (via Manatee) full frequency list again and again (e.g. if user moves from page to page).
    """
    cache = FreqCalcCache(corpname=args.corpname, subcname=args.subcname, user_id=args.user_id, subcpath=args.subcpath,
                          minsize=args.minsize, q=args.q, fromp=args.fromp, pagesize=args.pagesize, save=args.save,
                          samplesize=args.samplesize)
    calc_result, cache_path = cache.get(fcrit=args.fcrit, flimit=args.flimit, freq_sort=args.freq_sort, ml=args.ml,
                                        ftt_include_empty=args.ftt_include_empty, rel_mode=args.rel_mode,
                                        collator_locale=args.collator_locale)
    if calc_result is None:
        backend, conf = settings.get_full('global', 'calc_backend')
        if backend == 'celery':
            import task
            args.cache_path = cache_path
            app = task.get_celery_app(conf['conf'])
            res = app.send_task('worker.calculate_freqs', args=(args.to_dict(),))
            # worker task caches the value AFTER the result is returned (see worker.py)
            calc_result = res.get()
        if backend == 'multiprocessing':
            calc_result = calculate_freqs_mp(args)

    data = calc_result['freqs']
    conc_size = calc_result['conc_size']
    lastpage = None
    if len(data) == 1:  # a single block => pagination
        total_length = len(data[0]['Items']) if 'Items' in data[0] else 0
        items_per_page = args.fmaxitems
        fstart = (args.fpage - 1) * args.fmaxitems + args.line_offset
        fmaxitems = args.fmaxitems * args.fpage + 1 + args.line_offset
        if total_length < fmaxitems:
            lastpage = 1
        else:
            lastpage = 0
        ans = [dict(Total=total_length,
                    TotalPages=int(math.ceil(total_length / float(items_per_page))),
                    Items=data[0]['Items'][fstart:fmaxitems - 1] if 'Items' in data[0] else [],
                    Head=data[0].get('Head', []))]
    else:
        for item in data:
            item['Total'] = len(item['Items']) if 'Items' in item else 0
            item['TotalPages'] = None
        ans = data
        fstart = None
    return dict(lastpage=lastpage, data=ans, fstart=fstart, fmaxitems=args.fmaxitems, conc_size=conc_size)


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


def calculate_freqs_mp(args):
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
            pickle.dump(data['data'], f)

    fc = FreqCalcCache(corpname=args.corpname, subcname=args.subcname, user_id=args.user_id,
                       minsize=args.minsize, q=args.q, fromp=args.fromp, pagesize=args.pagesize,
                       save=args.save, samplesize=args.samplesize, subcpath=args.subcpath)
    ans, cache_ans = fc.calc_freqs(flimit=args.flimit, freq_sort=args.freq_sort, ml=args.ml,
                                   rel_mode=args.rel_mode, fcrit=args.fcrit,
                                   ftt_include_empty=args.ftt_include_empty,
                                   collator_locale=args.collator_locale,
                                   fmaxitems=args.fmaxitems, fpage=args.fpage,
                                   line_offset=args.line_offset)
    if cache_ans:
        multiprocessing.Process(target=cache_results, args=(cache_ans,)).start()
    return ans


# ------------------ Contingency table freq. distribution --------------


class CTFreqCalcArgs(FixedDict):
    q = None
    user_id = None
    corpname = None
    collator_locale = None
    subcname = None
    subcpath = None
    minsize = None
    ctminfreq = None
    fcrit = None
    cache_path = None


class CTCalculationError(Exception):
    pass


class CTCalculation(object):

    def __init__(self, args):
        self._args = args
        self._corp = None
        self._conc = None

    def _get_num_structattrs(self, attrs):
        return len([x for x in attrs if '.' in x])

    def _calc_1sattr_norms(self, words, sattr, sattr_idx):
        norms2_dict = self._conc.get_attr_values_sizes(sattr)
        return [norms2_dict.get(x[sattr_idx], 0) for x in words]

    def _calc_2sattr_norms(self, words, sattr1, sattr2):
        if plugins.runtime.LIVE_ATTRIBUTES.exists:
            return plugins.runtime.LIVE_ATTRIBUTES.instance.get_sattr_pair_sizes(self._corp.corpname, sattr1, sattr2,
                                                                                 words)
        else:
            return [1e6] * len(words)

    def ct_dist(self, crit, limit=1):
        """
        Calculate join distribution (contingency table).
        """
        words = manatee.StrVector()
        freqs = manatee.NumVector()
        norms = manatee.NumVector()
        import logging
        logging.getLogger(__name__).warning('LIMIT: %s' % (limit,))
        self._corp.freq_dist(self._conc.RS(), crit, limit, words, freqs, norms)

        crit_lx = re.split(r'\s+', crit)
        attrs = []
        for i in range(0, len(crit_lx), 2):
            attrs.append(crit_lx[i])

        if len(attrs) > 2:
            raise CTCalculationError('Exactly two attributes (either positional or structural) can be used')

        words = [tuple(self._conc.import_string(w).split('\t')) for w in words]

        num_structattrs = self._get_num_structattrs(attrs)
        if num_structattrs == 2:
            norms = self._calc_2sattr_norms(words, attrs[0], attrs[1])
        elif num_structattrs == 1:
            sattr_idx = 0 if '.' in attrs[0] else 1
            norms = self._calc_1sattr_norms(words, sattr=attrs[sattr_idx], sattr_idx=sattr_idx)
        else:
            norms = [self._corp.size()] * len(words)
        return zip(words, freqs, norms)

    def run(self):
        """
        note: this is called by Celery worker
        """
        cm = corplib.CorpusManager(subcpath=self._args.subcpath)
        self._corp = cm.get_Corpus(self._args.corpname, self._args.subcname)
        self._conc = conclib.get_conc(corp=self._corp, user_id=self._args.user_id, minsize=self._args.minsize,
                                      q=self._args.q, fromp=0, pagesize=0, async=0, save=0, samplesize=0)
        return [x[0] + x[1:] for x in self.ct_dist(self._args.fcrit, limit=self._args.ctminfreq)]


def calculate_freqs_ct(args):
    """
    note: this is called by webserver
    """
    backend, conf = settings.get_full('global', 'calc_backend')
    if backend == 'celery':
        import task
        app = task.get_celery_app(conf['conf'])
        res = app.send_task('worker.calculate_freqs_ct', args=(args.to_dict(),))
        calc_result = res.get()
    elif backend == 'multiprocessing':
        calc_result = calculate_freqs_mp(args)
    else:
        raise ValueError('Invalid backend')
    return calc_result
