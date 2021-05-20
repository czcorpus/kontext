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

import json
import logging

from .backend import Backend

from plugins.abstract.user_items import AbstractUserItems, UserItemException, FavoriteItem
from plugins import inject
import plugins
import l10n
from controller import exposed
from actions.user import User as UserController


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


@exposed(return_type='json', access_level=1, skip_corpus_init=True, http_method='POST')
def set_favorite_item(ctrl, request):
    """
    """
    corpora = []
    main_size = None
    for i, c_id in enumerate(request.form.getlist('corpora')):
        corp = ctrl.cm.get_corpus(c_id, subcname=request.form['subcorpus_id'] if i == 0 else None)
        if i == 0:
            main_size = corp.search_size
        corpora.append(dict(id=c_id, name=corp.get_conf('NAME')))
    subcorpus_id = request.form['subcorpus_id']
    subcorpus_orig_id = request.form['subcorpus_orig_id']
    item = FavoriteItem(dict(
        name=' || '.join(c['name'] for c in corpora) +
        (' / ' + subcorpus_orig_id if subcorpus_orig_id else ''),
        corpora=corpora,
        subcorpus_id=subcorpus_id,
        subcorpus_orig_id=subcorpus_orig_id,
        size=main_size,
        size_info=l10n.simplify_num(main_size)
    ))
    with plugins.runtime.USER_ITEMS as uit:
        uit.add_user_item(ctrl._plugin_ctx, item)
        return item.to_dict()


@exposed(return_type='json', access_level=1, skip_corpus_init=True, http_method='POST')
def unset_favorite_item(ctrl, request):
    with plugins.runtime.USER_ITEMS as uit:
        uit.delete_user_item(ctrl._plugin_ctx, request.form['id'])
        return dict(id=request.form['id'])


class MySQLUserItems(AbstractUserItems):
    """
    A mysql implementation of user_items plug-in.
    """

    def __init__(self, settings, db, auth):
        super(MySQLUserItems, self).__init__()
        self._settings = settings
        self._db = db
        self._auth = auth
        self._backend = Backend(db)

    def serialize(self, obj):
        """
        This is used for server-side serialization only
        """
        return json.dumps(obj.to_dict())

    def get_user_items(self, plugin_ctx):
        ans = []
        if self._auth.anonymous_user()['id'] != plugin_ctx.user_id:
            ans = self._backend.get_favitems(plugin_ctx.user_id)
            # ans = l10n.sort(ans, plugin_ctx.user_lang, key=lambda itm: itm.sort_key, reverse=False)
        return ans

    def add_user_item(self, plugin_ctx, item):
        if self._backend.count_favitems(plugin_ctx.user_id)['count'] >= self.max_num_favorites:
            raise UserItemException('Max. number of fav. items exceeded',
                                    error_code='defaultCorparch__err001',
                                    error_args={'maxNum': self.max_num_favorites})
        self._backend.insert_favitem(plugin_ctx.user_id, item)

    def delete_user_item(self, plugin_ctx, item_id):
        self._backend.delete_favitem(item_id)

    def export_actions(self):
        return {UserController: [set_favorite_item, unset_favorite_item]}

    @property
    def max_num_favorites(self):
        return int(self._settings.get('plugins', 'user_items')['mysql:max_num_favorites'])


@inject(plugins.runtime.INTEGRATION_DB, plugins.runtime.AUTH)
def create_instance(settings, db, auth):
    return MySQLUserItems(settings, db, auth)
