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


Required config.xml/plugins entries:

<corparch>
    <module>corparch</module>
    <file>[a path to a configuration XML file]</file>
    <root_elm_path>
        [an XPath query leading to a root element where configuration can be found]
    </root_elm_path>
    <tag_prefix extension-by="default">
        [a spec. character specifying that the following string is a tag/label]
    </tag_prefix>
    <max_num_hints>
        [the maximum number of hints corpus selection widget shows (even if there are more results
         available]
    </max_num_hints>
    <default_page_list_size extension-by="default">
        [number of items on the 'corplist' page]
    </default_page_list_size>
    <access_req_smtp_server extension-by="ucnk">
        [an address of a SMTP server KonText will send corpus access request through]
    </access_req_smtp_server>
    <access_req_sender extension-by="ucnk">
        [an e-email sender address user will see once she gets the message]
    </access_req_sender>
    <access_req_recipients extension-by="ucnk">
        [a list of recipients/adminstrators who will be notified about request; use child
         elements here]
    </access_req_recipients>
    <default_label extension-by="ucnk">
        [corpus label to be selected by default in case user has not already selected anything]
    </default_label>
</corparch>

How does the corpus list specification XML entry looks like:

<a_root_elm>
  <corpus sentence_struct="p" ident="SUSANNE" collator_locale="cs_CZ" tagset="pp_tagset"
      web="http://www.korpus.cz/syn2010.php">
    <metadata>
      <featured />
      <keywords>
        <item>foreign_language_corpora</item>
        <item>written_corpora</item>
      </keywords>
    </metadata>
  </corpus>
   ...
</a_root_elm>

"""

try:
    from markdown import markdown
except ImportError:
    markdown = lambda s: s
import smtplib
from email.mime.text import MIMEText
import time
import logging

import plugins
from plugins import inject
from plugins.default_corparch import CorpusArchive, CorpSearch, parse_query
from plugins.abstract.corpora import CorpusInfo
import l10n
from controller import exposed
import actions.user
from translation import ugettext as _

DEFAULT_LANG = 'en'


class UcnkCorpusInfo(CorpusInfo):
    """
    A modified CorpusInfo containing 'internal' flag
    """
    def __init__(self):
        super(UcnkCorpusInfo, self).__init__()
        self.requestable = False


@exposed(acess_level=1, return_type='json', skip_corpus_init=True)
def ask_corpus_access(controller, request):
    ans = {}
    status = plugins.get('corparch').send_request_email(corpus_id=request.form['corpusId'],
                                                        user=controller._session_get('user', 'user'),
                                                        user_id=controller._session_get('user', 'id'),
                                                        custom_message=request.form['customMessage'])
    if status is False:
        ans['error'] = _(
            'Failed to send e-mail. Please try again later or contact system administrator')
    return ans


class UcnkCorpArch(CorpusArchive):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    SESSION_KEYWORDS_KEY = 'plugin_ucnkcorparch_default_keywords'

    def __init__(self, auth, user_items, file_path, root_xpath, tag_prefix, max_num_hints,
                 max_page_size, access_req_sender, access_req_smtp_server,
                 access_req_recipients, default_label):
        super(UcnkCorpArch, self).__init__(auth=auth, user_items=user_items, file_path=file_path,
                                           root_xpath=root_xpath, tag_prefix=tag_prefix,
                                           max_num_hints=max_num_hints, max_page_size=max_page_size)
        self.access_req_sender = access_req_sender
        self.access_req_smtp_server = access_req_smtp_server
        self.access_req_recipients = access_req_recipients
        self.default_label = default_label

    def export(self, plugin_api, user_id, *args):
        ans = super(UcnkCorpArch, self).export(plugin_api, user_id, *args)
        ans['initial_keywords'] = plugin_api.session.get(self.SESSION_KEYWORDS_KEY, [self.default_label])
        return ans

    def search(self, plugin_api, user_id, query, offset=0, limit=None, filter_dict=None):
        if self.SESSION_KEYWORDS_KEY not in plugin_api.session:
            plugin_api.session[self.SESSION_KEYWORDS_KEY] = [self.default_label]
        initial_query = query
        if query is False:
            query = ''
        query_substrs, query_keywords = parse_query(self._tag_prefix, query)
        if len(query_keywords) == 0 and initial_query is False:
            query_keywords = plugin_api.session[self.SESSION_KEYWORDS_KEY]
        else:
            plugin_api.session[self.SESSION_KEYWORDS_KEY] = query_keywords
        query = ' '.join(query_substrs) \
                + ' ' + ' '.join('%s%s' % (self._tag_prefix, s) for s in query_keywords)
        search_obj = CorpSearch(plugin_api, self._auth, self, self._tag_prefix)
        return super(UcnkCorpArch, self).search_via_service(search_obj, user_id, query, offset,
                                                            limit, filter_dict)

    def send_request_email(self, corpus_id, user, user_id, custom_message):
        """
        returns:
        True if at least one recipient has been reached else False
        """
        errors = []

        text = u'Žádost o zpřístupnění korpusu zaslaná z KonTextu:\n\n'
        text += u'datum a čas žádosti: %s\n' % time.strftime('%d.%m. %Y %H:%M')
        text += u'uživatel: %s (ID = %s)\n' % (user, user_id)
        text += u'korpus ID: %s\n' % corpus_id

        if custom_message:
            text += u'Doplňující zpráva od uživatele:\n\n'
            text += custom_message + '\n\n'

        text += u'\n---------------------\nNa tento e-mail prosím neodpovídejte.\n'

        s = smtplib.SMTP(self.access_req_smtp_server)

        for recipient in self.access_req_recipients:
            msg = MIMEText(text, 'plain', 'utf-8')
            msg['Subject'] = u'Žádost o zpřístupnění korpusu zaslaná z KonTextu'
            msg['From'] = self.access_req_sender
            msg['To'] = recipient
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

    def customize_corpus_info(self, corpus_info, node):
        corpus_info.requestable = self._decode_bool(node.attrib.get('requestable'))

    def customize_search_result_item(self, plugin_api, item, permitted_corpora, corpus_info):
        item['requestable'] = corpus_info.requestable and corpus_info.id not in permitted_corpora \
                              and not plugin_api.user_is_anonymous

    def custom_filter(self, plugin_api, corpus_info, permitted_corpora):
        return corpus_info.id in permitted_corpora or (corpus_info.requestable and not plugin_api.user_is_anonymous)

    def get_list(self, user_allowed_corpora):
        """
        arguments:
        user_allowed_corpora -- a dict (corpus_canonical_id, corpus_id) containing corpora ids
                                accessible by the current user
        """
        cl = []
        for item in self._raw_list().values():
            canonical_id, path, web = item['id'], item['path'], item['sentence_struct']
            corp_id = user_allowed_corpora.get(canonical_id, canonical_id)
            try:
                corp_info = self._manatee_corpora.get_info(corp_id)
                cl.append({'id': corp_id,
                           'canonical_id': canonical_id,
                           'name': l10n.import_string(corp_info.name,
                                                      from_encoding=corp_info.encoding),
                           'desc': l10n.import_string(corp_info.description,
                                                      from_encoding=corp_info.encoding),
                           'size': corp_info.size,
                           'path': path,
                           'requestable': item.get('requestable', False)
                           })
            except Exception, e:
                import logging
                logging.getLogger(__name__).warn(
                    u'Failed to fetch info about %s with error %s (%r)' % (corp_id,
                                                                           type(e).__name__, e))
                cl.append({
                    'id': corp_id, 'canonical_id': canonical_id, 'name': corp_id,
                    'path': path, 'desc': '', 'size': None})
        return cl

    def export_actions(self):
        return {actions.user.User: [ask_corpus_access]}


@inject('auth', 'user_items')
def create_instance(conf, auth, user_items):
    """
    Interface function called by KonText creates new plugin instance
    """
    return UcnkCorpArch(auth=auth,
                        user_items=user_items,
                        file_path=conf.get('plugins', 'corparch')['file'],
                        root_xpath=conf.get('plugins', 'corparch')['root_elm_path'],
                        tag_prefix=conf.get('plugins', 'corparch')['default:tag_prefix'],
                        max_num_hints=conf.get('plugins', 'corparch')['default:max_num_hints'],
                        max_page_size=conf.get('plugins', 'corparch').get(
                            'default:default_page_list_size', None),
                        access_req_smtp_server=conf.get('plugins',
                                                        'corparch')['ucnk:access_req_smtp_server'],
                        access_req_sender=conf.get('plugins', 'corparch')['ucnk:access_req_sender'],
                        access_req_recipients=conf.get('plugins',
                                                       'corparch')['ucnk:access_req_recipients'],
                        default_label=conf.get('plugins', 'corparch')['ucnk:default_label'])
