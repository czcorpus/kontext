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
import sys
CURR_PATH = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '%s/lib' % CURR_PATH)
import settings
from celery import Celery
import initializer
import imp
import plugins

settings.load('%s/conf/config.xml' % CURR_PATH)
os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')
initializer.init_plugin('db')
initializer.init_plugin('locking')
initializer.init_plugin('conc_cache')
initializer.init_plugin('conc_persistence')
initializer.init_plugin('sessions')

from concworker import wcelery

_, conf = settings.get_full('global', 'conc_calc_backend')
app = Celery('kontext', config_source=wcelery.load_config_module(conf['conf']))


def load_script_module(name, path):
    return imp.load_source(name, path)


@app.task
def register(corpus, subchash, query, samplesize):
    c = wcelery.TaskRegistration()
    initial_args = c(corpus, subchash, query, samplesize)
    if not initial_args.stored_pidfile:   # we are first trying to calc this
        calculate.delay(initial_args, corpus, subchash, query, samplesize)
    return initial_args


@app.task(ignore_result=True)  # TODO ignore? what about errors?
def calculate(initial_args, corpus, subchash, query, samplesize):
    task = wcelery.CeleryCalculation()
    return task(initial_args, corpus, subchash, query, samplesize)


@app.task
def archive_concordance(cron_interval, key_prefix, dry_run):
    from plugins.ucnk_conc_persistence2 import KEY_ALPHABET, PERSIST_LEVEL_KEY
    archive_m = load_script_module('archive', './scripts/plugins/ucnk_conc_persistence2/archive.py')
    ans = archive_m.run(conf=settings, key_prefix=key_prefix, cron_interval=cron_interval, dry_run=dry_run,
                        persist_level_key=PERSIST_LEVEL_KEY, key_alphabet=KEY_ALPHABET)
    return ans


@app.task
def sync_user_db(interval, dry_run):
    sync_mysql = load_script_module('syncdb', './scripts/plugins/ucnk_remote_auth2/syncdb.py')
    ans = sync_mysql.run(syncdb_conf_path='./conf/mysql2redis.json', kontext_conf=settings,
                         interval=interval, dry_run=dry_run)
    return ans


@app.task
def conc_cache_cleanup(ttl, subdir, dry_run):
    from plugins.default_conc_cache import CacheMapping
    cleanup_mod = load_script_module('cleanup', './scripts/plugins/default_conc_cache/cleanup.py')
    return cleanup_mod.run(root_dir=settings.get('plugins', 'conc_cache')['default:cache_dir'],
                           corpus_id=None, ttl=ttl, subdir=subdir, dry_run=dry_run,
                           cache_map_filename=CacheMapping.CACHE_FILENAME,
                           locking_plugin=plugins.get('locking'))
