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


import plugins
from plugins import inject
from plugins.abstract.corparch import CorpusListItem
from plugins.abstract.corparch import CorpusInfo
from plugins.mysql_corparch import MySQLCorparch
from plugins.mysql_corparch.corplist import parse_query
from plugins.mysql_corparch.backend import Backend
from controller import exposed
from controller.errors import ForbiddenException
import actions.user
from translation import ugettext as _

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


@exposed(return_type='json', access_level=1, skip_corpus_init=True)
def get_favorite_corpora(ctrl, request):
    with plugins.runtime.CORPARCH as ca, plugins.runtime.USER_ITEMS as ui:
        return ca.export_favorite(ctrl._plugin_ctx, ui.get_user_items(ctrl._plugin_ctx))


@exposed(access_level=1, return_type='json', skip_corpus_init=True, http_method='POST')
def ask_corpus_access(ctrl, request):
    ans = {}
    plugin_ctx = getattr(ctrl, '_plugin_ctx')
    with plugins.runtime.CORPARCH as ca:
        if plugin_ctx.user_is_anonymous:
            raise ForbiddenException('Anonymous user cannot send the request')
        status = ca.send_request_email(corpus_id=request.form['corpusId'],
                                       plugin_ctx=plugin_ctx,
                                       custom_message=request.form['customMessage'])
    if status is False:
        ans['error'] = _(
            'Failed to send e-mail. Please try again later or contact system administrator')
    return ans


class UcnkCorpArch3(MySQLCorparch):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    SESSION_KEYWORDS_KEY = 'plugin_ucnkcorparch_default_keywords'

    def __init__(self, backend, auth, user_items, tag_prefix, max_num_hints,
                 max_page_size, access_req_sender, access_req_smtp_server,
                 access_req_recipients, default_label, registry_lang):
        super(UcnkCorpArch3, self).__init__(backend=backend, user_items=user_items,
                                            tag_prefix=tag_prefix, max_num_hints=max_num_hints,
                                            max_page_size=max_page_size, registry_lang=registry_lang)
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

    def export(self, plugin_ctx):
        ans = super(UcnkCorpArch3, self).export(plugin_ctx)
        ans['initial_keywords'] = plugin_ctx.session.get(
            self.SESSION_KEYWORDS_KEY, [self.default_label])
        return ans

    def search(self, plugin_ctx, query, offset=0, limit=None, filter_dict=None):
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
        return super(UcnkCorpArch3, self).search(plugin_ctx, query, offset, limit, filter_dict)

    def send_request_email(self, corpus_id, plugin_ctx, custom_message):
        """
        returns:
        True if at least one recipient has been reached else False
        """
        errors = []

        user_info = self._auth.get_user_info(plugin_ctx)
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
            logging.getLogger(__name__).warn(
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
def create_instance(conf, user_items, auth, cnc_db):
    backend = Backend(
        cnc_db, user_table='user', corp_table='corpora', group_acc_table='relation',
        user_acc_table='user_corpus_relation', user_acc_corp_attr='corpus_id',
        group_acc_corp_attr='corpora', group_acc_group_attr='corplist')
    logging.getLogger(__name__).info(f'ucnk_corparch3 uses integration_db[{cnc_db.info}]')
    return UcnkCorpArch3(backend=backend,
                         auth=auth,
                         user_items=user_items,
                         tag_prefix=conf.get('plugins', 'corparch')['ucnk:tag_prefix'],
                         max_num_hints=conf.get('plugins', 'corparch')['ucnk:max_num_hints'],
                         max_page_size=conf.get('plugins', 'corparch').get(
                             'ucnk:default_page_list_size', None),
                         access_req_smtp_server=conf.get('plugins',
                                                         'corparch')['ucnk:access_req_smtp_server'],
                         access_req_sender=conf.get('plugins', 'corparch')[
                             'ucnk:access_req_sender'],
                         access_req_recipients=conf.get('plugins',
                                                        'corparch')['ucnk:access_req_recipients'],
                         default_label=conf.get('plugins', 'corparch')['ucnk:default_label'],
                         registry_lang=conf.get('corpora', 'manatee_registry_locale', 'en_US'))
