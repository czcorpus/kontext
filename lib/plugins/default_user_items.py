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

import json

from abstract.user_items import AbstractUserItems, CorpusItem, SubcorpusItem, UserItemException, AlignedCorporaItem
from abstract.user_items import infer_item_key


class ItemEncoder(json.JSONEncoder):
    """
    Provides a consistent encoding of GeneralItem objects into the JSON format.
    """
    def default(self, obj):
        d = [(k, v) for k, v in obj.__dict__.items() if not k.startswith('_')]
        d.append(('id', obj.id))
        d.append(('type', obj.type))
        return dict(d)


def import_from_json(obj, recursive=False):
    """
    Provides a consistent decoding of JSON-encoded GeneralItem objects.
    If a new GeneralItem implementation occurs then this method must
    be updated accordingly.

    arguments:
    obj -- a dict representing decoded JSON
    """
    item_type = obj.get('type', None)
    if item_type == 'corpus':
        ans = CorpusItem(name=obj['name'])
        ans.corpus_id = obj['corpus_id']
        ans.canonical_id = obj['canonical_id']
    elif item_type == 'subcorpus':
        ans = SubcorpusItem(obj['name'])
        ans.corpus_id = obj['corpus_id']
        ans.canonical_id = obj['canonical_id']
        ans.subcorpus_id = obj['subcorpus_id']
        ans.size = obj['size']
    elif item_type == 'aligned_corpora':
        ans = AlignedCorporaItem(obj['name'])
        ans.corpus_id = obj['corpus_id']
        ans.canonical_id = obj['canonical_id']
        if not recursive:
            ans.corpora = obj['corpora']
        else:
            ans.corpora = [import_from_json(c) for c in obj['corpora']]
    else:
        raise UserItemException('Unknown/undefined item type: %s' % item_type)
    return ans


class UserItems(AbstractUserItems):
    """
    A default implementation of user_items plug-in. Based on
    key-value storage.
    Items are stored in a hash type (i.e. it is a hash within
    a hash - data[user_id][user_item_id]). In case a list
    is produced (e.g. get_user_items) the order is expected to
    be random - i.e. sorting must be performed externally.
    """

    decoder = json.JSONDecoder(object_hook=import_from_json)

    def __init__(self, settings, db):
        self._settings = settings
        self._db = db

    @staticmethod
    def _mk_key(user_id):
        return 'favitems:user:%d' % user_id

    def from_dict(self, data):
        return import_from_json(data, recursive=True)

    def to_json(self, obj):
        return json.dumps(obj, cls=ItemEncoder)

    def get_user_items(self, user_id):
        ans = []
        for item_id, item in self._db.hash_get_all(self._mk_key(user_id)).items():
            ans.append(self.decoder.decode(item))
        return ans

    def add_user_item(self, user_id, item):
        data_json = self.to_json(item)
        self._db.hash_set(self._mk_key(user_id), item.id, data_json)

    def delete_user_item(self, user_id, item_id):
        self._db.hash_del(self._mk_key(user_id), item_id)

    def infer_item_key(self, corpname, usesubcorp, aligned_corpora):
        return infer_item_key(corpname, usesubcorp, aligned_corpora)


def create_instance(settings, db):
    return UserItems(settings, db)