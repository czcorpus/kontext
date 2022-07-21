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

import logging
import os
import time

import aiofiles.os
import conclib.search
import corplib


class EmptySubcorpusException(Exception):
    pass


class CreateSubcorpusTask(object):

    def __init__(self, user_id: int, corpus_id: str):
        self._user_id = user_id
        self._cm = corplib.CorpusManager()
        self._corpus_id = corpus_id

    async def run(self, tt_query, cql, path):
        """
        returns:
        True in case of success
        In case of an empty subcorus, EmptySubcorpusException is thrown
        """
        corp = await self._cm.get_corpus(self._corpus_id)
        conc = await conclib.search.get_conc(corp, self._user_id, q=cql, asnc=0)
        if conc.size() == 0:
            raise EmptySubcorpusException('Empty subcorpus')
        ans = corplib.subcorpus_from_conc(path, conc)
        if ans is False:
            raise EmptySubcorpusException('Failed to create the subcorpus from a concordance')
        # this should not happen but it looks like it did
        if not await aiofiles.os.path.isfile(path):
            logging.getLogger(__name__).warning(
                'Sync. called conc. file not created (path: {})'.format(path))
            time.sleep(5)
        os.chmod(path, 0o664)
        return ans
