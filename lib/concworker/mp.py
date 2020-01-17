# Copyright (c) 2017 Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from multiprocessing import Process
import concworker
import uuid

import settings
import plugins


class EmptyTask(object):
    def start(self):
        pass


def create_task(user_id, corp, subchash, q, samplesize):
    task_id = str(uuid.uuid1())
    reg_fn = concworker.TaskRegistration(task_id=task_id)
    corpus_id = corp.corpname
    subcname = getattr(corp, 'subcname', None)
    subc_path = '%s/%s' % (settings.get('corpora', 'users_subcpath'), user_id)
    initial_args = reg_fn(corpus_id, subcname, subchash, subc_path, q, samplesize)
    if not initial_args['already_running']:  # we are first trying to calc this
        def run():
            with plugins.runtime.CONC_CACHE as cc:
                task = concworker.ConcCalculation(task_id=task_id, cache_factory=cc.fork())
            return task(initial_args, subc_path, corpus_id, subcname, subchash, q, samplesize)
        proc = Process(target=run)
    else:
        proc = EmptyTask()
    return proc
