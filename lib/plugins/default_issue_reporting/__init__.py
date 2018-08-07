# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import logging
import smtplib
from email.mime.text import MIMEText
import json
from datetime import datetime

from plugins import inject
import plugins
from plugins.abstract.issue_reporting import AbstractIssueReporting, DynamicReportingAction
import actions.user
from controller import exposed
from translation import ugettext as _


@exposed(return_type='json', http_method='POST', skip_corpus_init=True)
def submit_issue(self, request):
    with plugins.runtime.ISSUE_REPORTING as p:
        p.submit(self._plugin_api, request.form)
    return {}


class DefaultErrorReporting(AbstractIssueReporting):

    def __init__(self, auth, smtp_server, mail_sender, mail_recipients):
        self._auth = auth
        self._smtp_server = smtp_server
        self._mail_sender = mail_sender
        self._mail_recipients = mail_recipients

    def export_report_action(self, plugin_api):
        return DynamicReportingAction()

    def submit(self, plugin_api, args):
        self._send_mail(plugin_api, args['body'], json.loads(args['args']))

    @staticmethod
    def _dump_browser_info(info):
        return '\n'.join(('  {0}: {1}'.format(k, v)) for k, v in info.items())

    def _send_mail(self, plugin_api, body, browser_info):
        user_id = plugin_api.user_id
        user_info = self._auth.get_user_info(user_id)
        user_email = user_info['email']
        username = user_info['username']

        text = _('KonText feedback from user {0}').format(username) + ':'
        text += '\n\n'
        text += body
        text += '\n'
        text += '\n{0}\n'.format(40 * '-')
        text += _('browser info') + ':\n'
        text += self._dump_browser_info(browser_info)
        text += '\n{0}\n'.format(40 * '-')
        text += '\n'

        s = smtplib.SMTP(self._smtp_server)

        msg = MIMEText(text, 'plain', 'utf-8')
        msg['Subject'] = _('KonText feedback from user {0} for {1}').format(
            username, datetime.now().isoformat().rsplit('.')[0])
        msg['From'] = self._mail_sender
        msg['To'] = ', '.join(self._mail_recipients)
        msg.add_header('Reply-To', user_email)
        try:
            s.sendmail(self._mail_sender, self._mail_recipients, msg.as_string())
            ans = True
        except Exception as ex:
            logging.getLogger(__name__).warn(
                'There were errors sending an issue report link via e-mail(s): %s' % (ex,))
            ans = False
        finally:
            s.quit()
        return ans

    def export_actions(self):
        return {actions.user.User: [submit_issue]}


@inject(plugins.runtime.AUTH)
def create_instance(settings, auth):
    plg_conf = settings.get('plugins', 'issue_reporting')
    smtp_server = plg_conf['default:smtp_server']
    sender = plg_conf['default:mail_sender']
    recipients = plg_conf['default:mail_recipients']
    return DefaultErrorReporting(auth=auth, smtp_server=smtp_server, mail_sender=sender,
                                 mail_recipients=recipients)
