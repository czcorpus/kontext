# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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
from action.control import http_action
from action.krequest import KRequest
from action.model.user import UserActionModel
from action.response import KResponse
from plugin_types.auth import AbstractAuth
from plugin_types.user_items import FavoriteItem
from plugins import inject
from plugins.common.mysql import MySQLConf, MySQLOps
from plugins.mysql_integration_db import MySqlIntegrationDb
from plugins.mysql_user_items import MySQLUserItems
from plugins.mysql_user_items.backend import Backend
from sanic.blueprints import Blueprint

bp = Blueprint('ucnk_user_items')


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


@inject(plugins.runtime.INTEGRATION_DB, plugins.runtime.AUTH)
def create_instance(settings, integ_db: MySqlIntegrationDb, auth: AbstractAuth):
    plugin_conf = settings.get('plugins', 'user_items')
    if integ_db.is_active and 'mysql_host' not in plugin_conf:
        logging.getLogger(__name__).info(f'ucnk_user_items uses integration_db[{integ_db.info}]')
        db_backend = Backend(integ_db, user_table='user', corp_table='corpora', group_acc_table='corplist_corpus', user_acc_table='user_corpus',
                             user_acc_corp_attr='corpus_id', group_acc_corp_attr='corpus_id', group_acc_group_attr='corplist_id')
    else:
        logging.getLogger(__name__).info(
            'ucnk_user_items uses custom database configuration {}@{}'.format(
                plugin_conf['mysql_user'], plugin_conf['mysql_host']))
        db = MySQLOps(**MySQLConf.from_conf(plugin_conf).conn_dict)
        db_backend = Backend(
            db, user_table='user', corp_table='corpora', group_acc_table='corplist_corpus',
            user_acc_table='user_corpus', user_acc_corp_attr='corpus_id', group_acc_corp_attr='corpus_id',
            group_acc_group_attr='corplist_id')
    return MySQLUserItems(settings, db_backend, auth)
