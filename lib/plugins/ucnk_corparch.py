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
from plugins.default_corparch import CorpTree
import l10n
from controller import exposed
import actions.user
from translation import ugettext as _

DEFAULT_LANG = 'en'


@exposed(acess_level=1, return_type='json')
def ask_corpus_access(controller, request):
    ans = {}
    status = plugins.get('corparch').send_request_email(corpus_id=request.form['corpusId'],
                                                        user=controller._session_get('user', 'user'),
                                                        user_id=controller._session_get('user', 'id'))
    if status is False:
        ans['error'] = _(
            'Failed to send e-mail. Please try again later or contact system administrator')
    return ans


class UcnkCorpArch(CorpTree):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    def __init__(self, auth, user_items, file_path, root_xpath, tag_prefix, max_num_hints,
                 max_page_size, access_req_sender, access_req_smtp_server,
                 access_req_recipients):
        super(UcnkCorpArch, self).__init__(auth=auth, user_items=user_items, file_path=file_path,
                                           root_xpath=root_xpath, tag_prefix=tag_prefix,
                                           max_num_hints=max_num_hints, max_page_size=max_page_size)
        self.access_req_sender = access_req_sender
        self.access_req_smtp_server = access_req_smtp_server
        self.access_req_recipients = access_req_recipients

    def send_request_email(self, corpus_id, user, user_id):
        """
        returns:
        True if at least one recipient has been reached else False
        """
        errors = []

        text = u'Žádost o zpřístupnění korpusu zaslaná z KonTextu:\n\n'
        text += u'datum a čas žádosti: %s\n' % time.strftime('%d. %m. %Y %H:%M')
        text += u'uživatel: %s (ID = %s)\n' % (user, user_id)
        text += u'korpus ID: %s\n' % corpus_id

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
        if len(errors) < len(self.access_req_recipients):
            logging.getLogger(__name__).warn(
                'There were errors sending corpus access request e-mail(s): %s' % ', '.join(errors))
            return True
        else:
            return False

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
                           'user_access': canonical_id in user_allowed_corpora
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
                                                       'corparch')['ucnk:access_req_recipients'])
