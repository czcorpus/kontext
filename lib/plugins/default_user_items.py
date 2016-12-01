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
from plugins import inject
import plugins
import l10n
from controller import exposed
from actions.user import User as UserController


class ItemEncoder(json.JSONEncoder):
    """
    Provides a consistent encoding of GeneralItem objects into the JSON format.
    In accordance with plug-in's 'serialize()' required signature also a list of
    GeneralItem instances is supported.
    """
    @staticmethod
    def _convert_single(obj):
        d = [(k, v) for k, v in obj.__dict__.items() if not k.startswith('_')]
        d.append(('id', obj.id))
        d.append(('type', obj.type))
        return dict(d)

    def default(self, obj):
        if hasattr(obj, '__iter__'):
            return [self._convert_single(item) for item in obj]
        else:
            return self._convert_single(obj)


def import_from_json(obj, recursive=False):
    """
    Provides a consistent decoding of JSON-encoded GeneralItem objects.
    If a new GeneralItem implementation occurs then this method must
    be updated accordingly.

    arguments:
    obj -- a dict representing decoded JSON
    """
    def set_common(item_obj, src_data):
        item_obj.corpus_id = src_data['corpus_id']
        item_obj.canonical_id = src_data['canonical_id']
        item_obj.size = src_data.get('size', None)   # can be None in case item_obj is an aligned corp.
        item_obj.size_info = src_data.get('size_info', None)  # can be None in case item_obj is an aligned corp.

    item_type = obj.get('type', None)
    if item_type == 'corpus':
        ans = CorpusItem(name=obj['name'])
        set_common(ans, obj)
    elif item_type == 'subcorpus':
        ans = SubcorpusItem(obj['name'])
        set_common(ans, obj)
        ans.subcorpus_id = obj['subcorpus_id']
    elif item_type == 'aligned_corpora':
        ans = AlignedCorporaItem(obj['name'])
        set_common(ans, obj)
        if not recursive:
            ans.corpora = obj['corpora']
        else:
            ans.corpora = [import_from_json(c) for c in obj['corpora']]
    else:
        raise UserItemException('Unknown/undefined item type: %s' % item_type)
    return ans


@exposed(return_type='json', access_level=1, skip_corpus_init=True)
def get_favorite_corpora(ctrl, request):
    return [fc.to_dict() for fc in plugins.get('user_items').get_user_items(ctrl._session_get('user', 'id'))]


@exposed(return_type='json', access_level=1, skip_corpus_init=True)
def set_favorite_item(ctrl, request):
    """
    """
    main_corp = ctrl.cm.get_Corpus(request.form['corpus_id'], request.form['subcorpus_id'])
    corp_size = main_corp.search_size()
    data = {
        'corpora': [],
        'canonical_id': request.form['canonical_id'],
        'corpus_id': request.form['corpus_id'],
        'subcorpus_id': request.form['subcorpus_id'],
        'name': request.form['name'],
        'size': corp_size,
        'size_info': l10n.simplify_num(corp_size),
        'type': request.form['type']
    }
    aligned_corpnames = request.form.getlist('corpora')
    for ac in aligned_corpnames:
        data['corpora'].append({
            'name': ac,  # TODO fetch real name??
            'corpus_id': ac,
            'canonical_id': ctrl._canonical_corpname(ac),
            'type': 'corpus'
        })

    item = plugins.get('user_items').from_dict(data)
    plugins.get('user_items').add_user_item(ctrl._session_get('user', 'id'), item)
    return {'id': item.id}


@exposed(return_type='json', access_level=1, skip_corpus_init=True)
def unset_favorite_item(ctrl, request):
    plugins.get('user_items').delete_user_item(
        ctrl._session_get('user', 'id'), request.form['id'])
    return {}


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

    def __init__(self, settings, db, auth):
        super(UserItems, self).__init__()
        self._settings = settings
        self._db = db
        self._auth = auth

    def setup(self, controller_obj):
        """
        Interface method expected by KonText if a module wants to be set-up by
        some "late" information (like locales).

        Please note that each request calls this method on the same instance
        which means that any client-specific data must be thread-local.
        """
        self.setlocal('lang', getattr(controller_obj, 'ui_lang', None))

    @property
    def max_num_favorites(self):
        return int(self._settings.get('plugins', 'corparch')['default:max_num_favorites'])

    @staticmethod
    def _mk_key(user_id):
        return 'favitems:user:%d' % user_id

    def from_dict(self, data):
        return import_from_json(data, recursive=True)

    def serialize(self, obj):
        """
        This is used for server-side serialization only
        """
        return json.dumps(obj, cls=ItemEncoder)

    def get_user_items(self, user_id):
        ans = []
        if self._auth.anonymous_user()['id'] != user_id:
            for item_id, item in self._db.hash_get_all(self._mk_key(user_id)).items():
                ans.append(self.decoder.decode(item))
            ans = l10n.sort(ans, self.getlocal('lang'), key=lambda itm: itm.name, reverse=False)
        return ans

    def add_user_item(self, user_id, item):
        if len(self.get_user_items(user_id)) >= self.max_num_favorites:
            raise UserItemException('Max. number of fav. items exceeded',
                                    error_code='defaultCorparch__err001',
                                    error_args={'maxNum': self.max_num_favorites})
        self._db.hash_set(self._mk_key(user_id), item.id, self.serialize(item))

    def delete_user_item(self, user_id, item_id):
        self._db.hash_del(self._mk_key(user_id), item_id)

    def infer_item_key(self, corpname, usesubcorp, aligned_corpora):
        return infer_item_key(corpname, usesubcorp, aligned_corpora)

    def export_actions(self):
        return {UserController: [get_favorite_corpora, set_favorite_item, unset_favorite_item]}


@inject('db', 'auth')
def create_instance(settings, db, auth):
    return UserItems(settings, db, auth)
