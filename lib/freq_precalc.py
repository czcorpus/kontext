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
import logging
import re
from datetime import datetime
import time

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
        cache_dir = os.path.abspath(settings.get('corpora', 'freqs_cache_dir'))
        subdirs = (corp.corpname,)
        for d in subdirs:
            cache_dir = '%s/%s' % (cache_dir, d)
            if not os.path.exists(cache_dir):
                os.makedirs(cache_dir)
        ans = '%s/%s' % (cache_dir, attrname)
    return ans.encode('utf-8')


def subcorp_base_file(corp, attrname):
    if hasattr(corp, 'spath'):
        return corp.spath[:-4].decode('utf-8') + attrname
    else:
        return corp.get_conf('PATH').decode('utf-8') + attrname


def prepare_arf_calc_paths(corp, attrname, logstep=0.02):
    """
    Calculates frequencies, ARFs and document frequencies for a specified corpus. Because this
    is quite computationally demanding the function is typically called in background by KonText.

    arguments:
    corp -- a corpus instance
    attrname -- name of a positional or structure's attribute
    logstep -- specifies how often (as a ratio of calculated data) should the logfile be updated
    """
    outfilename = subcorp_base_file(corp, attrname).encode('utf-8')
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
    backend, conf = settings.get_full('corpora', 'conc_calc_backend')
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
