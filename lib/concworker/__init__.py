# Copyright (c) 2003-2014  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright (c) 2014 Institute of the Czech National Corpus
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

import logging
import time
import cPickle
import os
import settings
import uuid

import plugins
from conclib import PyConc


class Sender(object):
    """
    Sends initial calculation data (pidfile etc.). This is
    used by the worker process to inform KonText that the
    calculation started (or failed to start).
    """
    def send(self, data):
        raise NotImplementedError()


class Receiver(object):
    """
    Receives calculation data from worker.
    """
    def receive(self):
        raise NotImplementedError()


class InitialNotifierFactory(object):
    """
    A factory returning a 2-tuple containing receiver and sender. This is
    in fact a generalization of multiprocessing's Pipe function.
    """
    def __call__(self):
        return Receiver(), Sender()


class GeneralWorker(object):

    def __init__(self):
        self._cache_factory = plugins.get('conc_cache')
        self._lock_factory = plugins.get('locking')

    @staticmethod
    def _update_pidfile(file_path, **kwargs):
        with open(file_path, 'r') as pf:
            data = cPickle.load(pf)
        data.update(kwargs)
        with open(file_path, 'w') as pf:
            cPickle.dump(data, pf)

    @staticmethod
    def _create_pid_file():
        pidfile = os.path.normpath('%s/%s.pid' % (settings.get('corpora', 'calc_pid_dir'),
                                                  uuid.uuid1()))
        with open(pidfile, 'wb') as pf:
            cPickle.dump(
                {
                    'pid': os.getpid(),
                    'last_check': int(time.time()),
                    # in case we check status before any calculation (represented by the
                    # BackgroundCalc class) starts (the calculation updates curr_wait as it
                    # runs), we want to be sure the limit is big enough for BackgroundCalc to
                    # be considered alive
                    'curr_wait': 100,
                    'error': None
                },
                pf)
        os.chmod(pidfile, 0o664)
        return pidfile

    def get_cached_conc_sizes(self, corp, q=None, cachefile=None):
        """
        arguments:
        corp -- manatee.Corpus instance
        q -- a list containing preprocessed query
        cachefile -- if not provided then the path is determined automatically
        using CACHE_ROOT_DIR and corpus name, corpus name and the query

        returns:
        a dictionary {
            finished : 0/1,
            concsize : int,
            fullsize : int,
            relconcsize : float (concordance size recalculated to a million corpus)
        }
        """
        import struct

        if q is None:
            q = []
        ans = {'finished': False, 'concsize': None, 'fullsize': None, 'relconcsize': None}
        if not cachefile:  # AJAX call
            q = tuple(q)
            subchash = getattr(corp, 'subchash', None)
            cache_map = self._cache_factory.get_mapping(corp)
            cachefile = cache_map.cache_file_path(subchash, q)

        if cachefile and os.path.isfile(cachefile):
            with self._lock_factory.create(cachefile):
                cache = open(cachefile, 'rb')
                cache.seek(15)
                finished = bool(ord(cache.read(1)))
                (fullsize,) = struct.unpack('q', cache.read(8))
                cache.seek(32)
                (concsize,) = struct.unpack('i', cache.read(4))

            if fullsize > 0:
                relconcsize = 1000000.0 * fullsize / corp.search_size()
            else:
                relconcsize = 1000000.0 * concsize / corp.search_size()

            ans['finished'] = finished
            ans['concsize'] = concsize
            ans['fullsize'] = fullsize
            ans['relconcsize'] = relconcsize
        return ans

    def compute_conc(self, corp, q, samplesize):
        start_time = time.time()
        q = tuple(q)
        if q[0][0] != 'R':
            ans_conc = PyConc(corp, q[0][0], q[0][1:], samplesize)
        else:
            raise NotImplementedError('Function "online sample" is not supported')
        logging.getLogger(__name__).debug('compute_conc(%s, [%s]) -> %01.4f' %
                                          (corp.corpname, ','.join(q), time.time() - start_time))
        return ans_conc
