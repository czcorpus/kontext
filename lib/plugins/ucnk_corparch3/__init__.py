# -*- coding: utf-8 -*-
# Copyright (c) 2013 Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

"""
A plug-in providing user's favorite and global featured corpora lists. The data
are passed through via the 'export' method which is recognized by KonText and then
interpreted via a custom JavaScript (which is an integral part of the plug-in).


Required config.xml/plugins entries: please see config.rng

To see the format of the "corplist.xml" file please
see default_corparch/resources/corplist.rng.

"""
try:
    from markdown import markdown
except ImportError:
    def markdown(s): return s
import smtplib
from email.mime.text import MIMEText
import time
import logging
from collections import defaultdict
import os
from sanic import Blueprint
from plugin_types.integration_db import IntegrationDatabase


import plugins
from plugins import inject
from plugin_types.corparch import CorpusListItem
from plugin_types.corparch import CorpusInfo
from plugins.mysql_corparch import MySQLCorparch
from plugins.mysql_corparch.corplist import parse_query
from plugins.mysql_corparch.backend import Backend
from action.errors import ForbiddenException
from action.decorators import http_action
from action.model.authorized import UserActionModel
from util import as_async

bp = Blueprint('ucnk_corparch3')


DEFAULT_LANG = 'en'


class UcnkCorpusListItem(CorpusListItem):
    """
    A modified CorpusListInfo containing 'requestable' flag
    """

    def __init__(self):
        super(CorpusListItem, self).__init__()
        self.requestable = False


class UcnkCorpusInfo(CorpusInfo):
    """
    A modified CorpusInfo containing 'requestable' flag
    """

    def __init__(self):
        super(UcnkCorpusInfo, self).__init__()
        self.requestable = False


@bp.route('/get_favorite_corpora')
@http_action(return_type='json', access_level=1, action_model=UserActionModel)
def get_favorite_corpora(amodel, req, resp):
    with plugins.runtime.CORPARCH as ca, plugins.runtime.USER_ITEMS as ui:
        return ca.export_favorite(amodel.plugin_ctx, ui.get_user_items(amodel.plugin_ctx))


@bp.route('/ask_corpus_access', methods=['POST'])
@http_action(access_level=1, return_type='json', action_model=UserActionModel)
async def ask_corpus_access(amodel, req, resp):
    ans = {}
    with plugins.runtime.CORPARCH as ca:
        if amodel.plugin_ctx.user_is_anonymous:
            raise ForbiddenException('Anonymous user cannot send the request')
        status = await ca.send_request_email(
            corpus_id=req.form.get('corpusId'),
            plugin_ctx=amodel.plugin_ctx,
            custom_message=req.form.get('customMessage'))
    if status is False:
        ans['error'] = req.translate(
            'Failed to send e-mail. Please try again later or contact system administrator')
    return ans


class UcnkCorpArch3(MySQLCorparch):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    SESSION_KEYWORDS_KEY = 'plugin_ucnkcorparch_default_keywords'

    def __init__(self, db_backend, auth, user_items, tag_prefix, max_num_hints,
                 max_page_size, access_req_sender, access_req_smtp_server,
                 access_req_recipients, default_label, registry_lang):
        super().__init__(
            db_backend=db_backend, user_items=user_items, tag_prefix=tag_prefix,
            max_num_hints=max_num_hints, max_page_size=max_page_size, registry_lang=registry_lang)
        self._auth = auth
        self.access_req_sender = access_req_sender
        self.access_req_smtp_server = access_req_smtp_server
        self.access_req_recipients = access_req_recipients
        self.default_label = default_label

    def corpus_list_item_from_row(self, plugin_ctx, row):
        obj = super(UcnkCorpArch3, self).corpus_list_item_from_row(plugin_ctx, row)
        obj.requestable = row['requestable']
        return obj

    def list_corpora(self, plugin_ctx, substrs=None, keywords=None, min_size=0, max_size=None, requestable=False,
                     offset=0, limit=-1, favourites=()):
        return super(UcnkCorpArch3, self).list_corpora(plugin_ctx=plugin_ctx, substrs=substrs, keywords=keywords,
                                                       min_size=min_size, max_size=max_size, requestable=requestable,
                                                       offset=offset, limit=limit if limit > -1 else 1000000000,
                                                       favourites=favourites)

    async def export(self, plugin_ctx):
        ans = await super(UcnkCorpArch3, self).export(plugin_ctx)
        ans['initial_keywords'] = plugin_ctx.session.get(
            self.SESSION_KEYWORDS_KEY, [self.default_label])
        return ans

    async def search(self, plugin_ctx, query, offset=0, limit=None, filter_dict=None):
        if self.SESSION_KEYWORDS_KEY not in plugin_ctx.session:
            plugin_ctx.session[self.SESSION_KEYWORDS_KEY] = [self.default_label]
        initial_query = query
        if query is False:
            query = ''
        query_substrs, query_keywords = parse_query(self._tag_prefix, query)
        if len(query_keywords) == 0 and initial_query is False:
            query_keywords = plugin_ctx.session[self.SESSION_KEYWORDS_KEY]
        else:
            plugin_ctx.session[self.SESSION_KEYWORDS_KEY] = query_keywords
        query = (' '.join(query_substrs) + ' ' + ' '.join('%s%s' %
                                                          (self._tag_prefix, s) for s in query_keywords))
        return await super(UcnkCorpArch3, self).search(plugin_ctx, query, offset, limit, filter_dict)

    async def send_request_email(self, corpus_id, plugin_ctx, custom_message):
        """
        returns:
        True if at least one recipient has been reached else False
        """
        errors = []

        user_info = await self._auth.get_user_info(plugin_ctx)
        user_email = user_info['email']
        username = user_info['username']

        text = 'Žádost o zpřístupnění korpusu zaslaná z KonTextu:\n\n'
        text += 'datum a čas žádosti: %s\n' % time.strftime('%d.%m. %Y %H:%M')
        text += 'uživatel: %s (ID = %s, e-mail: %s)\n' % (username, plugin_ctx.user_id, user_email)
        text += 'korpus ID: %s\n' % corpus_id

        if custom_message:
            text += 'Doplňující zpráva od uživatele:\n\n'
            text += custom_message + '\n\n'

        text += '\n---------------------\n'

        s = smtplib.SMTP(self.access_req_smtp_server)

        for recipient in self.access_req_recipients:
            msg = MIMEText(text, 'plain', 'utf-8')
            msg['Subject'] = 'Žádost o zpřístupnění korpusu zaslaná z KonTextu'
            msg['From'] = self.access_req_sender
            msg['To'] = recipient
            msg.add_header('Reply-To', user_email)
            try:
                s.sendmail(self.access_req_sender, [recipient], msg.as_string())
            except Exception as ex:
                errors.append('Failed to send an e-email to <%s>, error: %r' % (recipient, ex))
        s.quit()
        if 0 < len(errors) < len(self.access_req_recipients):
            logging.getLogger(__name__).warning(
                'There were errors sending corpus access request e-mail(s): %s' % ', '.join(errors))
            return True
        elif len(errors) == 0:
            return True
        else:
            return False

    def create_corpus_info(self):
        return UcnkCorpusInfo()

    def export_actions(self):
        return {actions.user.User: [ask_corpus_access, get_favorite_corpora]}

    def on_soft_reset(self):
        num_items = len(self._corpus_info_cache)
        self._corpus_info_cache = {}
        self._keywords = None
        self._colors = {}
        self._descriptions = defaultdict(lambda: {})
        logging.getLogger(__name__).warning(
            'soft reset, cleaning all corpus info caches (pid {}: {} corpora)'.format(os.getpid(), num_items))


@inject(plugins.runtime.USER_ITEMS, plugins.runtime.AUTH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, user_items, auth, cnc_db: IntegrationDatabase):
    db_backend = Backend(
        cnc_db, user_table='user', corp_table='corpora', corp_id_attr='id',
        group_acc_table='relation', group_acc_corp_attr='corpora', group_acc_group_attr='corplist',
        user_acc_table='user_corpus_relation', user_acc_corp_attr='corpus_id')
    logging.getLogger(__name__).info(f'ucnk_corparch3 uses integration_db[{cnc_db.info}]')
    return UcnkCorpArch3(
        db_backend=db_backend,
        auth=auth,
        user_items=user_items,
        tag_prefix=conf.get('plugins', 'corparch')['tag_prefix'],
        max_num_hints=conf.get('plugins', 'corparch')['max_num_hints'],
        max_page_size=conf.get('plugins', 'corparch').get('default_page_list_size', None),
        access_req_smtp_server=conf.get('plugins', 'corparch')['access_req_smtp_server'],
        access_req_sender=conf.get('plugins', 'corparch')['access_req_sender'],
        access_req_recipients=conf.get('plugins', 'corparch')['access_req_recipients'],
        default_label=conf.get('plugins', 'corparch')['default_label'],
        registry_lang=conf.get('corpora', 'manatee_registry_locale', 'en_US'))
