# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import plugins
import ujson as json
from action.control import http_action
from action.krequest import KRequest
from action.model.user import UserActionModel
from action.response import KResponse
from plugin_types.auth import AbstractAuth
from plugin_types.user_items import (
    AbstractUserItems, FavoriteItem, UserItemException)
from plugins import inject
from plugins.common.mysql import MySQLConf
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.mysql_integration_db import MySqlIntegrationDb
from sanic.blueprints import Blueprint

from .backend import Backend

bp = Blueprint('mysql_user_items')


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
    ans.subcorpus_name = data.get('subcorpus_orig_id', ans.subcorpus_id)
    ans.size = data.get('size', None)
    ans.size_info = data.get('size_info', None)
    return ans


@bp.route('/user/set_favorite_item', methods=['POST'])
@http_action(return_type='json', access_level=2, action_model=UserActionModel)
async def set_favorite_item(amodel: UserActionModel, req: KRequest, resp: KResponse):
    """
    """
    corpora = []
    req_corpora = req.form_getlist('corpora')
    subc = req.form.get('subcorpus_id')
    if subc:
        with plugins.runtime.SUBC_STORAGE as sa:
            ident = await sa.get_info(subc)
            maincorp = await amodel.cf.get_corpus(ident)
            subcorpus_name = ident.name
            subcorpus_id = ident.id
    else:
        maincorp = await amodel.cf.get_corpus(req_corpora[0])
        subcorpus_name = None
        subcorpus_id = None

    main_size = maincorp.search_size
    for i, c_id in enumerate(req_corpora):
        if i == 0:
            corp = maincorp
        else:
            corp = await amodel.cf.get_corpus(c_id)
        corpora.append(dict(id=c_id, name=corp.get_conf('NAME')))
    item = FavoriteItem(
        ident=None,  # will be updated after database insert (autoincrement)
        name=' || '.join(c['name'] for c in corpora) +
        (' / ' + subcorpus_name if subcorpus_name else ''),
        corpora=corpora,
        subcorpus_id=subcorpus_id,
        subcorpus_name=subcorpus_name,
        size=main_size
    )
    with plugins.runtime.USER_ITEMS as uit:
        await uit.add_user_item(amodel.plugin_ctx, item)
        return item.to_dict()


@bp.route('/user/unset_favorite_item', methods=['POST'])
@http_action(return_type='json', access_level=2, action_model=UserActionModel)
async def unset_favorite_item(amodel, req, resp):
    with plugins.runtime.USER_ITEMS as uit:
        await uit.delete_user_item(amodel.plugin_ctx, req.form.get('id'))
        return dict(id=req.form.get('id'))


class MySQLUserItems(AbstractUserItems):
    """
    A mysql implementation of user_items plug-in.
    """

    def __init__(self, settings, db_backend: Backend, auth: AbstractAuth):
        super(MySQLUserItems, self).__init__()
        self._settings = settings
        self._auth = auth
        self._backend = db_backend

    def serialize(self, obj):
        """
        This is used for server-side serialization only
        """
        return json.dumps(obj.to_dict())

    async def get_user_items(self, plugin_ctx):
        ans = []
        if self._auth.anonymous_user(plugin_ctx)['id'] != plugin_ctx.user_id:
            ans = await self._backend.get_favitems(plugin_ctx.user_id)
            # ans = l10n.sort(ans, plugin_ctx.user_lang, key=lambda itm: itm.sort_key, reverse=False)
        return ans

    async def add_user_item(self, plugin_ctx, item):
        if (await self._backend.count_favitems(plugin_ctx.user_id))['count'] >= self.max_num_favorites:
            raise UserItemException(
                'Max. number of fav. items exceeded', error_code='defaultCorparch__err001',
                error_args={'maxNum': self.max_num_favorites})
        await self._backend.insert_favitem(plugin_ctx.user_id, item)

    async def delete_user_item(self, plugin_ctx, item_id):
        await self._backend.delete_favitem(item_id)

    @staticmethod
    def export_actions():
        return bp

    @property
    def max_num_favorites(self):
        return int(self._settings.get('plugins', 'user_items')['max_num_favorites'])

    async def on_response(self):
        await self._backend.close()


@inject(plugins.runtime.INTEGRATION_DB, plugins.runtime.AUTH)
def create_instance(settings, integ_db: MySqlIntegrationDb, auth: AbstractAuth):
    plugin_conf = settings.get('plugins', 'user_items')
    if integ_db.is_active and 'mysql_host' not in plugin_conf:
        logging.getLogger(__name__).info(f'mysql_user_items uses integration_db[{integ_db.info}]')
        db_backend = Backend(integ_db)
    else:
        logging.getLogger(__name__).info(
            'mysql_user_items uses custom database configuration {}@{}'.format(
                plugin_conf['mysql_user'], plugin_conf['mysql_host']))
        db_backend = Backend(AdhocDB(MySQLConf.from_conf(plugin_conf)))
    return MySQLUserItems(settings, db_backend, auth)
