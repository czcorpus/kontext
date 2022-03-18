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
from sanic.blueprints import Blueprint

from plugins import inject
import plugins
from plugin_types.issue_reporting import AbstractIssueReporting, DynamicReportingAction
from action.decorators import http_action
from action.model.authorized import UserActionModel


bp = Blueprint('default_issue_reporting')


@bp.route('/submit_issue', methods=['POST'])
@http_action(return_type='json', action_model=UserActionModel)
def submit_issue(req, amodel):
    with plugins.runtime.ISSUE_REPORTING as p:
        await p.submit(amodel.plugin_ctx, req.form)
    return {}


class DefaultErrorReporting(AbstractIssueReporting):

    def __init__(self, auth, smtp_server, mail_sender, mail_recipients):
        self._auth = auth
        self._smtp_server = smtp_server
        self._mail_sender = mail_sender
        self._mail_recipients = mail_recipients

    def export_report_action(self, plugin_ctx):
        return DynamicReportingAction()

    async def submit(self, plugin_ctx, args):
        await self._send_mail(plugin_ctx, args['body'], json.loads(args['args']))

    @staticmethod
    def _dump_browser_info(info):
        return '\n'.join(('  {0}: {1}'.format(k, v)) for k, v in list(info.items()))

    async def _send_mail(self, plugin_ctx, body, browser_info):
        user_info = await self._auth.get_user_info(plugin_ctx)
        user_email = user_info['email']
        username = user_info['username']

        text = plugin_ctx.translate('KonText feedback from user {0}').format(username) + ':'
        text += '\n\n'
        text += body
        text += '\n'
        text += '\n{0}\n'.format(40 * '-')
        text += plugin_ctx.translate('browser info') + ':\n'
        text += self._dump_browser_info(browser_info)
        text += '\n{0}\n'.format(40 * '-')
        text += '\n'

        s = smtplib.SMTP(self._smtp_server)

        msg = MIMEText(text, 'plain', 'utf-8')
        msg['Subject'] = plugin_ctx.translate('KonText feedback from user {0} for {1}').format(
            username, datetime.now().isoformat().rsplit('.')[0])
        msg['From'] = self._mail_sender
        msg['To'] = ', '.join(self._mail_recipients)
        msg.add_header('Reply-To', user_email)
        try:
            s.sendmail(self._mail_sender, self._mail_recipients, msg.as_string())
            ans = True
        except Exception as ex:
            logging.getLogger(__name__).warning(
                'There were errors sending an issue report link via e-mail(s): %s' % (ex,))
            ans = False
        finally:
            s.quit()
        return ans

    @staticmethod
    def export_actions():
        return bp


@inject(plugins.runtime.AUTH)
def create_instance(settings, auth):
    plg_conf = settings.get('plugins', 'issue_reporting')
    smtp_server = plg_conf['smtp_server']
    sender = plg_conf['mail_sender']
    recipients = plg_conf['mail_recipients']
    return DefaultErrorReporting(auth=auth, smtp_server=smtp_server, mail_sender=sender,
                                 mail_recipients=recipients)
