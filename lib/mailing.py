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
import logging
import settings


def smtp_factory():
    """
    Create a new SMTP instance with some predefined stuff
    :return:
    """
    username = settings.get('mailing', 'auth_username')
    password = settings.get('mailing', 'auth_password')
    port = settings.get_int('maining', 'smtp_port', 25)
    use_tls = settings.get_bool('mailing', 'use_tls', False)
    server = smtplib.SMTP(settings.get('mailing', 'smtp_server'), port=port)
    if use_tls:
        server.starttls()
    if username and password:
        server.login(username, password)
    return server


def message_factory(recipients, subject, text, reply_to=None):
    """
    Create message instance with some predefined properties
    """
    msg = MIMEText(text, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = settings.get('mailing', 'sender')
    msg['To'] = recipients[0]
    if reply_to:
        msg.add_header('Reply-To', reply_to)
    return msg


def send_mail(server, msg, recipients):
    sender = settings.get('mailing', 'sender')
    try:
        server.sendmail(sender, recipients, msg.as_string())
        ans = True
    except Exception as ex:
        logging.getLogger(__name__).warn(
            'There were errors sending e-mail: %s' % (ex,))
        ans = False
    finally:
        server.quit()
    return ans
