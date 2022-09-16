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
from typing import Union

import aiofiles.os
import conclib.search
import corplib
import plugins
from action.argmapping.subcorpus import (
    CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs)
from corplib.abstract import SubcorpusIdent
from corplib.subcorpus import subcorpus_from_conc
from plugin_types.auth import UserInfo


class EmptySubcorpusException(Exception):
    pass


class CreateSubcorpusTask(object):

    def __init__(self, author: UserInfo):
        self._author = author
        self._cf = corplib.CorpusFactory()

    async def run(
            self,
            specification: Union[CreateSubcorpusArgs, CreateSubcorpusWithinArgs, CreateSubcorpusRawCQLArgs],
            subcorpus_id: SubcorpusIdent,
            path: str
    ):
        """
        returns:
        True in case of success
        In case of an empty subcorus, EmptySubcorpusException is thrown
        """
        if isinstance(specification, CreateSubcorpusWithinArgs):
            full_cql = f'aword,[] {specification.deserialize()}'
        elif isinstance(specification, CreateSubcorpusRawCQLArgs):
            full_cql = f'aword,[] {specification.cql}'
        else:
            full_cql = f'aword,[] {specification.text_types_cql}'

        corp = await self._cf.get_corpus(subcorpus_id.corpus_name)
        conc = await conclib.search.get_conc(corp, self._author['id'], q=(full_cql,), asnc=0)
        conc.sync()
        if conc.size() == 0:
            raise EmptySubcorpusException('Empty subcorpus')
        ans = subcorpus_from_conc(path, conc)
        if ans is False:
            raise EmptySubcorpusException('Failed to create the subcorpus from a concordance')
        # this should not happen but it looks like it did
        if not await aiofiles.os.path.isfile(path):
            logging.getLogger(__name__).warning(
                'Sync. called conc. file not created (path: {})'.format(path))
            time.sleep(5)
        os.chmod(path, 0o664)

        with plugins.runtime.SUBC_STORAGE as sr:
            await sr.create(
                ident=subcorpus_id.id,
                author=self._author,
                size=conc.size(),
                public_description=specification.description,
                data=specification)
        return ans
