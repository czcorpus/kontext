# Copyright (c) 2016 Czech National Corpus
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

import smtplib
from email.mime.text import MIMEText
import time
import logging

from translation import ugettext as _
import settings


def send_concordance_url(auth, plugin_api, recipient, url):
    user_info = auth.get_user_info(plugin_api)
    user_email = user_info['email']
    username = user_info['username']
    smtp_server = settings.get('mailing', 'smtp_server')
    sender = settings.get('mailing', 'sender')

    text = _('KonText user %s has sent a concordance link to you') % (username, ) + ':'
    text += '\n\n'
    text += url + '\n\n'
    text += '\n---------------------\n'
    text += time.strftime('%d.%m. %Y %H:%M')
    text += '\n'

    s = smtplib.SMTP(smtp_server)

    msg = MIMEText(text, 'plain', 'utf-8')
    msg['Subject'] = _('KonText concordance link')
    msg['From'] = sender
    msg['To'] = recipient
    msg.add_header('Reply-To', user_email)
    try:
        s.sendmail(sender, [recipient], msg.as_string())
        ans = True
    except Exception as ex:
        logging.getLogger(__name__).warn(
            'There were errors sending concordance link via e-mail(s): %s' % (ex,))
        ans = False
    finally:
        s.quit()
    return ans
