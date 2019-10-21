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
import conclib
import os


class EmptySubcorpusException(Exception):
    pass


class CreateSubcorpusTask(object):

    def __init__(self, user_id, corpus_id, author, description):
        self._user_id = user_id
        self._cm = corplib.CorpusManager()
        self._corp = self._cm.get_Corpus(corpus_id)
        self._author = author
        self._description = description

    def run(self, tt_query, cql, path, publish_path):
        """
        returns:
        True in case of success
        In case of an empty subcorus, EmptySubcorpusException is thrown
        """
        conc = conclib.get_conc(self._corp, self._user_id, q=cql, async=0)
        ans = corplib.subcorpus_from_conc(path, conc)
        # we must set write perms for group as this is created by Celery and we won't be
        # able to create hardlinks otherwise
        os.chmod(path, 0664)
        if ans is False:
            raise EmptySubcorpusException('Empty subcorpus')
        if publish_path:
            corplib.mk_publish_links(path, publish_path, self._author, self._description)
        return ans
