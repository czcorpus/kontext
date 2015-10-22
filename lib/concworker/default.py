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
import cPickle
import uuid
import time
import logging
import sys

import settings
from concworker import GeneralWorker


class BackgroundCalc(GeneralWorker):
    """
    This class wraps background calculation of a concordance (see _get_async_conc() function
    below).
    """

    def __init__(self, sending_pipe, corpus, pid_dir, subchash, q):
        """
        arguments:
        sending_pipe -- a multiprocessing.Pipe instance used to send data from this process to its
                        parent
        corpus -- a manatee.Corpus instance
        pid_dir -- a directory where "pidfile" (= file containing information about background
                   calculation) will be temporarily stored
        subchash -- an identifier of current subcorpus (None if no subcorpus is in use)
        q -- a tuple/list containing current query
        """
        super(BackgroundCalc, self).__init__()
        self._pipe = sending_pipe
        self._corpus = corpus
        self._pid_dir = pid_dir
        self._subchash = subchash
        self._q = q

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
        return pidfile

    def __call__(self, samplesize, fullsize):
        sleeptime = None
        try:
            cache_map = self._cache_factory.get_mapping(self._corpus)
            pidfile = self._create_pid_file()
            cachefile, stored_pidfile = cache_map.add_to_map(self._subchash, self._q, 0, pidfile)

            if not stored_pidfile:
                self._pipe.send(cachefile + '\n' + pidfile)
                # The conc object bellow is asynchronous; i.e. you obtain it immediately but it may
                # not be ready yet (this is checked by the 'finished()' method).
                conc = self.compute_conc(self._corpus, self._q, samplesize)
                sleeptime = 0.1
                time.sleep(sleeptime)
                conc.save(cachefile, False, True, False)  # partial
                while not conc.finished():
                    # TODO it looks like append=True does not work with Manatee 2.121.1 properly
                    tmp_cachefile = cachefile + '.tmp'
                    conc.save(tmp_cachefile, False, True, False)
                    os.rename(tmp_cachefile, cachefile)
                    time.sleep(sleeptime)
                    sleeptime += 0.1
                    sizes = self.get_cached_conc_sizes(self._corpus, self._q, cachefile)
                    self._update_pidfile(pidfile, last_check=int(time.time()), curr_wait=sleeptime,
                                         finished=sizes['finished'], concsize=sizes['concsize'],
                                         fullsize=sizes['fullsize'], relconcsize=sizes['relconcsize'])
                tmp_cachefile = cachefile + '.tmp'
                conc.save(tmp_cachefile)  # whole
                os.rename(tmp_cachefile, cachefile)
                # update size in map file
                cache_map.add_to_map(self._subchash, self._q, conc.size())
                os.remove(pidfile)
        except Exception as e:
            # Please note that there is no need to clean any mess (pidfile of failed calculation,
            # unfinished cached concordance etc.) here as this is performed by _get_cached_conc()
            # function in case it detects a problem.
            import traceback
            logging.getLogger(__name__).error('Background calculation error: %s' % e)
            logging.getLogger(__name__).error(''.join(traceback.format_exception(*sys.exc_info())))
            self._update_pidfile(pidfile, last_check=int(time.time()), curr_wait=sleeptime, error=str(e))
