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

settings.load('%s/conf/config.xml' % CURR_PATH)
os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')
initializer.init_plugin('db')
initializer.init_plugin('locking')
initializer.init_plugin('conc_cache')

from concworker import wcelery


_, conf = settings.get_full('global', 'conc_calc_backend')
app = Celery('kontext', config_source=wcelery.load_config_module(conf['conf']))


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
