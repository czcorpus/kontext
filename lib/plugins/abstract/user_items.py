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

"""
A plug-in template for managing items (corpora, subcorpora, aligned corpora)
user can access via fast access widget. This is a generalization of
user corpus list.

Expected factory method signature: create_instance(config, db)
"""

import uuid
import hashlib


class UserItemException(Exception):
    """
    General error related to
    the plug-in
    """
    pass


class GeneralItem(object):
    """
    General favorite/promoted/whatever item (corpus, subcorpus,...).
    This should be always extended.
    """
    def __init__(self, item_id, name):
        self._id = item_id if item_id is not None else self.generate_id()
        self.name = name

    @staticmethod
    def generate_id():
        """
        ID generator should be the same for all implementations
        """
        return hashlib.sha1(str(uuid.uuid1())).hexdigest()

    @property
    def id(self):
        """
        An unique, read-only identifier of the item (see generate_id).
        """
        return self._id

    @property
    def type(self):
        """
        A read-only type
        """
        raise NotImplementedError()


class CorpusItem(GeneralItem):
    """
    A reference to a corpus in user's list
    """
    def __init__(self, item_id, name):
        super(CorpusItem, self).__init__(item_id, name)
        self.corpus_id = None
        self.canonical_id = None

    @property
    def type(self):
        return 'corpus'


class SubcorpusItem(CorpusItem):
    """
    A reference to a sub-corpus in user's list
    """
    def __init__(self, item_id, name):
        super(SubcorpusItem, self).__init__(item_id, name)
        self.subcorpus_id = None
        self.size = None

    @property
    def type(self):
        return 'subcorpus'


class AlignedCorporaItem(GeneralItem):
    """
    A reference to an n-tuple of aligned corpora
    (eg. (Intercorp_en, intercorp_cs, Intercorp_be).
    """
    def __init__(self, item_id, name):
        super(AlignedCorporaItem, self).__init__(item_id, name)
        self.corpora = []

    @property
    def type(self):
        return 'aligned_corpora'


class AbstractUserItems(object):
    """
    A plug-in interface
    """

    def get_user_items(self, user_id):
        """
        Returns a list of user items (GeneralItem implementations)

        arguments:
        user_id -- a database ID of a user

        return:
        a list or a compatible structure containing GeneralItem objects
        """
        raise NotImplementedError()

    def add_user_item(self, user_id, item):
        """
        Adds (in a persistent way) an item to user's list.

        arguments:
        user_id -- a database ID of a user
        item -- an instance of GeneralItem implementation
        """
        raise NotImplementedError()

    def delete_user_item(self, user_id, item_id):
        """
        Removes (in a persistent way) an item from user's list.

        arguments:
        user_id -- a databse ID of a user
        item_id -- an ID of GeneralItem instance
        """
        raise NotImplementedError()