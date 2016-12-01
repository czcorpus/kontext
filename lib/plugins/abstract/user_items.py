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

from structures import ThreadLocalData
from controller import UserActionException


class UserItemException(UserActionException):
    """
    General error related to
    the plug-in
    """
    pass


def generate_item_key(obj):
    if obj.type == 'corpus':
        return obj.corpus_id
    elif obj.type == 'subcorpus':
        return '%s:%s' % (obj.corpus_id, obj.subcorpus_id)
    elif obj.type == 'aligned_corpora':
        return '+'.join([obj.corpus_id] + [generate_item_key(corp) for corp in obj.corpora])


def infer_item_key(corpname, usesubcorp, aligned_corpora):
    if aligned_corpora is None or (len(aligned_corpora) == 1 and aligned_corpora[0] == ''):
        aligned_corpora = []
    if corpname:
        if usesubcorp:
            return '%s:%s' % (corpname, usesubcorp)
        elif aligned_corpora:
            return '+'.join([corpname] + [infer_item_key(corp, None, None)
                                          for corp in aligned_corpora])
        else:
            return corpname
    else:
        return None


class GeneralItem(object):
    """
    General favorite/promoted/whatever item (corpus, subcorpus,...).
    This should be always extended.
    """
    def __init__(self, name):
        self.name = name

    def generate_id(self):
        """
        ID generator should be the same for all implementations
        """
        raise NotImplementedError()

    @property
    def id(self):
        """
        An unique, read-only identifier of the item (see generate_id).
        """
        return self.generate_id()

    @property
    def type(self):
        """
        A read-only type
        """
        raise NotImplementedError()

    def to_dict(self):
        raise NotImplementedError()


class CorpusItem(GeneralItem):
    """
    A reference to a corpus in user's list
    """
    def __init__(self, name):
        super(CorpusItem, self).__init__(name)
        self.corpus_id = None
        self.canonical_id = None
        self.size = None
        self.size_info = None

    def generate_id(self):
        return generate_item_key(self)

    @property
    def type(self):
        return 'corpus'

    def __repr__(self):
        return 'CorpusItem(id: %s)' % (self.id,)

    def to_dict(self):
        return dict(
            id=self.id,
            name=self.name,
            type=self.type,
            corpus_id=self.corpus_id,
            canonical_id=self.canonical_id,
            size=self.size,
            size_info=self.size_info
        )


class SubcorpusItem(CorpusItem):
    """
    A reference to a sub-corpus in user's list
    """
    def __init__(self, name):
        super(SubcorpusItem, self).__init__(name)
        self.subcorpus_id = None

    def __repr__(self):
        return 'SubcorpusItem(id: %s)' % (self.id,)

    def generate_id(self):
        return generate_item_key(self)

    @property
    def type(self):
        return 'subcorpus'

    def to_dict(self):
        ans = super(SubcorpusItem, self).to_dict()
        ans['subcorpus_id'] = self.subcorpus_id
        return ans


class AlignedCorporaItem(CorpusItem):
    """
    A reference to an n-tuple of aligned corpora
    (eg. (Intercorp_en, intercorp_cs, Intercorp_be).
    """
    def __init__(self, name):
        super(AlignedCorporaItem, self).__init__(name)
        self.corpora = []

    def __repr__(self):
        return 'AlignedCorporaItem(id: %s)' % (self.id,)

    def generate_id(self):
        return generate_item_key(self)

    @property
    def type(self):
        return 'aligned_corpora'

    def to_dict(self):
        ans = super(AlignedCorporaItem, self).to_dict()
        ans['corpora'] = [c.to_dict() for c in self.corpora]
        return ans


class AbstractUserItems(ThreadLocalData):
    """
    A 'user_items' (= favorite corpora, subcorpora, aligned corpora)
    plug-in interface. It inherits from ThreadLocalData
    as it is likely that at least language settings will
    be required to keep lists etc. sorted according to user's
    current settings.

    Please note that to initiate the plug-in with request-specific
    data the 'setup(controller)' method must be implemented. The controller
    detects it automatically and calls it for all active plug-ins implementing
    it.
    """

    def __init__(self):
        super(AbstractUserItems, self).__init__(('lang',))

    def from_dict(self, data):
        """
        According to provided data it returns a proper
        implementation of GeneralItem.

        arguments:
        data -- a dict
        """
        raise NotImplementedError()

    def serialize(self, obj):
        """
        Exports a GeneralItem instance or a list of GeneralItem instances (both variants
         must be supported) to JSON used for internal storage (i.e. no client-side stuff)
        """
        raise NotImplementedError()

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
        Adds (persistently) an item to user's list.

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

    def infer_item_key(self, corpname, usesubcorp, aligned_corpora):
        """
        Infers a user_item key (~ id) from provided parameters
        (e.g. if usesubcorp is empty and so is aligned_corpora we know
        for sure that the unknown item is 'corpus' and the respective
        key will consist only from corpname.

        This is used to extract information about currently used (sub)corpus/aligned
        corpus.

        arguments:
        corpname -- a canonical corpus name
        usesubcorp -- a subcorpus name
        aligned_corpora -- a list of canonical corpora names

        returns:
        a string identifier of guessed object type
        """
        raise NotImplementedError()
