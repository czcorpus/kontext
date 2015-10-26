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

import time
import os
import logging
import sys
import imp

import concworker
from corplib import CorpusManager


def load_config_module(path):
    return imp.load_source('celeryconfig', path)


class Sender(concworker.Sender):
    """
    A Pipe-based sender
    """
    def send(self, data):
        pass


class Receiver(concworker.Receiver):
    """
    A Pipe-based receiver
    """
    def __init__(self, async_result):
        self._async_result = async_result

    def receive(self):
        ans = self._async_result.get()
        return ans.cachefile, ans.pidfile


class NotifierFactory(concworker.InitialNotifierFactory):
    def __init__(self, async_result):
        self._async_result = async_result

    def __call__(self):
        return Receiver(self._async_result), Sender()


class InitialArgs(object):
    def __init__(self, **kwargs):
        self.cachefile = kwargs.get('cachefile')
        self.pidfile = kwargs.get('pidfile')
        self.stored_pidfile = kwargs.get('stored_pidfile')

    def __repr__(self):
        return 'InitialArgs{cachefile: %s, pidfile: %s, stored_pidfile: %s}' % (self.cachefile,
                                                                                self.pidfile,
                                                                                self.stored_pidfile)


class TaskRegistration(concworker.GeneralWorker):
    def __init__(self):
        super(TaskRegistration, self).__init__()

    def __call__(self, corpus, subchash, query, samplesize):
        corpus_manager = CorpusManager()
        corpus_obj = corpus_manager.get_Corpus(corpus)
        cache_map = self._cache_factory.get_mapping(corpus_obj)
        pidfile = self._create_pid_file()
        cachefile, stored_pidfile = cache_map.add_to_map(subchash, query, 0, pidfile)
        return InitialArgs(cachefile=cachefile, pidfile=pidfile, stored_pidfile=stored_pidfile)


class CeleryCalculation(concworker.GeneralWorker):

    def __init__(self):
        """
        """
        super(CeleryCalculation, self).__init__()

    def __call__(self, initial_args, corpus, subchash, query, samplesize):
        """
        initial_args -- InitialArgs instance
        corpus -- a corpus identifier
        subchash -- an identifier of current subcorpus (None if no subcorpus is in use)
        query -- a tuple/list containing current query
        samplesize -- ???
        """
        sleeptime = None
        try:
            corpus_manager = CorpusManager()
            corpus_obj = corpus_manager.get_Corpus(corpus)
            cache_map = self._cache_factory.get_mapping(corpus_obj)

            if not initial_args.stored_pidfile:
                # The conc object bellow is asynchronous; i.e. you obtain it immediately but it may
                # not be ready yet (this is checked by the 'finished()' method).
                conc = self.compute_conc(corpus_obj, query, samplesize)
                sleeptime = 0.1
                time.sleep(sleeptime)
                conc.save(initial_args.cachefile, False, True, False)  # partial
                while not conc.finished():
                    # TODO it looks like append=True does not work with Manatee 2.121.1 properly
                    tmp_cachefile = initial_args.cachefile + '.tmp'
                    conc.save(tmp_cachefile, False, True, False)
                    os.rename(tmp_cachefile, initial_args.cachefile)
                    time.sleep(sleeptime)
                    sleeptime += 0.1
                    sizes = self.get_cached_conc_sizes(corpus_obj, query, initial_args.cachefile)
                    self._update_pidfile(initial_args.pidfile, last_check=int(time.time()),
                                         curr_wait=sleeptime, finished=sizes['finished'],
                                         concsize=sizes['concsize'], fullsize=sizes['fullsize'],
                                         relconcsize=sizes['relconcsize'])
                tmp_cachefile = initial_args.cachefile + '.tmp'
                conc.save(tmp_cachefile)  # whole
                os.rename(tmp_cachefile, initial_args.cachefile)
                # update size in map file
                cache_map.add_to_map(subchash, query, conc.size())
                os.remove(initial_args.pidfile)
        except Exception as e:
            # Please note that there is no need to clean any mess (pidfile of failed calculation,
            # unfinished cached concordance etc.) here as this is performed by _get_cached_conc()
            # function in case it detects a problem.
            import traceback
            logging.getLogger(__name__).error('Background calculation error: %s' % e)
            logging.getLogger(__name__).error(''.join(traceback.format_exception(*sys.exc_info())))
            self._update_pidfile(initial_args.pidfile, last_check=int(time.time()), curr_wait=sleeptime, error=str(e))



