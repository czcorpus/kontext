# Copyright (c) 2016 Institute of the Czech National Corpus
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

import corplib
import conclib.search
import os
import time
import logging


class EmptySubcorpusException(Exception):
    pass


class CreateSubcorpusTask(object):

    def __init__(self, user_id, corpus_id, author, description):
        self._user_id = user_id
        self._cm = corplib.CorpusManager()
        self._corp = self._cm.get_corpus(corpus_id)
        self._author = author
        self._description = description

    def run(self, tt_query, cql, path, publish_path):
        """
        returns:
        True in case of success
        In case of an empty subcorus, EmptySubcorpusException is thrown
        """
        conc = conclib.search.get_conc(self._corp, self._user_id, q=cql, asnc=0)
        if conc.size() == 0:
            raise EmptySubcorpusException('Empty subcorpus')
        ans = corplib.subcorpus_from_conc(path, conc)
        if ans is False:
            raise EmptySubcorpusException('Failed to create the subcorpus from a concordance')
        if not os.path.isfile(path):  # this should not happen but it looks like it did
            logging.getLogger(__name__).warning(
                'Sync. called conc. file not created (path: {})'.format(path))
            time.sleep(5)
        # we must set write perms for group as this is created by Celery and we won't be
        # able to create hardlinks otherwise
        os.chmod(path, 0o664)
        if publish_path:
            corplib.mk_publish_links(path, publish_path, self._author, self._description)
        return ans
