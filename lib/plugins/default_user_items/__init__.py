# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import l10n
import plugins
import ujson as json
from action.control import http_action
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse
from plugin_types.auth import AbstractAuth
from plugin_types.general_storage import KeyValueStorage
from plugin_types.user_items import (
    AbstractUserItems, FavoriteItem, UserItemException)
from plugins import inject
from sanic import Blueprint
from corplib.abstract import SubcorpusIdent

bp = Blueprint('default_user_items')


def import_legacy_record(data):
    ans = FavoriteItem()
    ans.ident = data['id']
    ans.name = data.get('name', '??')
    ans.corpora = [dict(id=data['corpus_id'], name=data['name'])]
    if data.get('corpora', None):
        for item in data.get('corpora', []):
            try:
                ans.corpora.append(dict(id=item['canonical_id'], name=item['name']))
            except Exception as ex:
                logging.getLogger(__name__).warning(
                    'Failed to import legacy fav. item record component: {0}'.format(ex))
    ans.subcorpus_id = data.get('subcorpus_id', None)
    ans.subcorpus_orig_id = data.get('subcorpus_orig_id', ans.subcorpus_id)
    ans.size = data.get('size', None)
    ans.size_info = data.get('size_info', None)
    return ans


def import_record(obj):
    """
    Provides a consistent decoding of JSON-encoded GeneralItem objects.
    If a new GeneralItem implementation occurs then this method must
    be updated accordingly.

    arguments:
    obj -- a dictionary as loaded from store
    """
    if 'type' in obj:
        return import_legacy_record(obj)
    else:
        return FavoriteItem(data=obj)


@bp.route('/user/set_favorite_item', methods=['POST'])
@http_action(return_type='json', access_level=1, action_model=CorpusActionModel)
async def set_favorite_item(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    """
    """
    corpora = []
    main_size = None
    for i, c_id in enumerate(req.form_getlist('corpora')):
        subc_id = req.form.get('subcorpus_id')
        if subc_id:
            corp_ident = SubcorpusIdent(id=subc_id, corpus_name=c_id)
        else:
            corp_ident = c_id
        corp = await amodel.cf.get_corpus(corp_ident)
        if i == 0:
            main_size = corp.search_size
        corpora.append(dict(id=c_id, name=corp.get_conf('NAME')))
    subcorpus_id = req.form.get('subcorpus_id')
    subcorpus_orig_id = req.form.get('subcorpus_orig_id')
    item = FavoriteItem(dict(
        name=' || '.join(c['name'] for c in corpora) +
        (' / ' + subcorpus_orig_id if subcorpus_orig_id else ''),
        corpora=corpora,
        subcorpus_id=subcorpus_id,
        subcorpus_orig_id=subcorpus_orig_id,
        size=main_size
    ))
    with plugins.runtime.USER_ITEMS as uit:
        await uit.add_user_item(amodel.plugin_ctx, item)
        return item.to_dict()


@bp.route('/user/unset_favorite_item', methods=['POST'])
@http_action(return_type='json', access_level=1, action_model=CorpusActionModel)
async def unset_favorite_item(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.USER_ITEMS as uit:
        await uit.delete_user_item(amodel.plugin_ctx, req.form.get('id'))
        return dict(id=req.form.get('id'))


class UserItems(AbstractUserItems):
    """
    A default implementation of user_items plug-in. Based on
    key-value storage.
    Items are stored in a hash type (i.e. it is a hash within
    a hash - data[user_id][user_item_id]). In case a list
    is produced (e.g. get_user_items) the order is expected to
    be random - i.e. sorting must be performed externally.
    """

    def __init__(self, settings, db: KeyValueStorage, auth: AbstractAuth):
        super(UserItems, self).__init__()
        self._settings = settings
        self._db = db
        self._auth = auth

    @property
    def max_num_favorites(self):
        return int(self._settings.get('plugins', 'user_items')['max_num_favorites'])

    @staticmethod
    def _mk_key(user_id):
        return 'favitems:user:%d' % user_id

    def serialize(self, obj):
        """
        This is used for server-side serialization only
        """
        return json.dumps(obj.to_dict())

    async def get_user_items(self, plugin_ctx):
        ans = []
        if self._auth.anonymous_user(plugin_ctx)['id'] != plugin_ctx.user_id:
            for item_id, item in (await self._db.hash_get_all(self._mk_key(plugin_ctx.user_id))).items():
                ans.append(import_record(item))
            ans = l10n.sort(ans, plugin_ctx.user_lang, key=lambda itm: itm.sort_key, reverse=False)
        return ans

    async def add_user_item(self, plugin_ctx, item):
        if len(await self.get_user_items(plugin_ctx)) >= self.max_num_favorites:
            raise UserItemException('Max. number of fav. items exceeded',
                                    error_code='defaultCorparch__err001',
                                    error_args={'maxNum': self.max_num_favorites})
        await self._db.hash_set(self._mk_key(plugin_ctx.user_id), item.ident, item.to_dict())

    async def delete_user_item(self, plugin_ctx, item_id):
        await self._db.hash_del(self._mk_key(plugin_ctx.user_id), item_id)

    @staticmethod
    def export_actions():
        return bp


@inject(plugins.runtime.DB, plugins.runtime.AUTH)
def create_instance(settings, db: KeyValueStorage, auth: AbstractAuth):
    return UserItems(settings, db, auth)
