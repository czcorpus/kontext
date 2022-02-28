# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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

"""
A production-ready authentication module based on MySQL/MariaDB.
The database can be configured either manually or automatically
(in case integration_db is enabled)
"""

import hashlib
import urllib.request
import urllib.parse
import urllib.error
import re
import time
import datetime
import mailing
import logging
from collections import defaultdict
from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor
from typing import List, Union

from plugin_types.auth import AbstractInternalAuth, AuthException, CorpusAccess, SignUpNeedsUpdateException
from plugin_types.auth.hash import mk_pwd_hash, mk_pwd_hash_default, split_pwd_hash
from plugin_types.integration_db import IntegrationDatabase
from .sign_up import SignUpToken
from translation import ugettext as _
import plugins
from plugins import inject
from plugins.common.mysql import MySQLOps, MySQLConf

IMPLICIT_CORPUS = 'susanne'


class MysqlAuthHandler(AbstractInternalAuth):
    """
    Sample authentication handler
    """

    MIN_PASSWORD_LENGTH = 5

    MIN_USERNAME_LENGTH = 3

    DEFAULT_CONFIRM_TOKEN_TTL = 3600  # 1 hour

    def __init__(
            self,
            db: Union[IntegrationDatabase[MySQLConnection, MySQLCursor], MySQLOps],
            sessions,
            anonymous_user_id,
            case_sensitive_corpora_names: bool,
            login_url,
            logout_url,
            smtp_server,
            mail_sender,
            confirmation_token_ttl,
            on_register_get_corpora):
        """
        """
        super().__init__(anonymous_user_id)
        self.db = db
        self.sessions = sessions
        self._login_url = login_url
        self._logout_url = logout_url
        self._smtp_server = smtp_server
        self._mail_sender = mail_sender
        self._confirmation_token_ttl = confirmation_token_ttl
        self._on_register_get_corpora = on_register_get_corpora
        self._case_sensitive_corpora_names = case_sensitive_corpora_names

    def validate_user(self, plugin_ctx, username, password):
        user_data = self._find_user(username)
        valid_pwd = False
        if user_data:
            split = split_pwd_hash(user_data['pwd_hash'])
            if 'salt' not in split:
                if len(user_data['pwd_hash']) == 32:
                    pwd_hash = hashlib.md5(password.encode()).hexdigest()
                    if user_data['pwd_hash'] == pwd_hash:
                        valid_pwd = True
                else:
                    import crypt
                    if crypt.crypt(password, user_data['pwd_hash']) == user_data['pwd_hash']:
                        valid_pwd = True
            else:
                if user_data['pwd_hash'] == mk_pwd_hash(password, split['salt'], split['iterations'],
                                                        split['keylen'], split['algo']):
                    valid_pwd = True

            if user_data['username'] == username and valid_pwd:
                return dict(
                    id=user_data['id'],
                    user=user_data['username'],
                    fullname='{0} {1}'.format(user_data['firstname'], user_data['lastname']),
                    email=user_data.get('email', None))
        return self.anonymous_user()

    def logout(self, session):
        """
        arguments:
        session -- Werkzeug session instance
        """
        self.sessions.delete(session)
        session.clear()

    def update_user_password(self, user_id, password):
        """
        Updates user's password.
        There is no need to hash/encrypt the password - function does it automatically.

        Security note: the calling function must make sure user_id matches the actual user logged in

        arguments:
        user_id -- a database ID of a user
        password -- new password
        """
        cursor = self.db.cursor()
        cursor.execute('SELECT username FROM kontext_user WHERE id = %s', (user_id,))
        row = cursor.fetchone()
        if row is not None:
            cursor.execute('UPDATE kontext_user SET pwd_hash = %s WHERE id = %s',
                           (mk_pwd_hash_default(password), user_id))
            self.db.commit()
        else:
            raise AuthException(_('User %s not found.') % user_id)

    @staticmethod
    def _variant_prefix(corpname):
        return corpname.rsplit('/', 1)[0] if '/' in corpname else ''

    def corpus_access(self, user_dict, corpus_name) -> CorpusAccess:
        if corpus_name == IMPLICIT_CORPUS:
            return False, True, ''
        cursor = self.db.cursor()
        cursor.execute(
            'SELECT guaccess.name, MAX(guaccess.limited) AS limited '
            'FROM '
            '  (SELECT c.name, gr.limited '
            '   FROM kontext_corpus AS c '
            '     JOIN kontext_group_access AS gr ON gr.corpus_name = c.name '
            '     JOIN kontext_user AS ku ON ku.group_access = gr.group_access '
            '   WHERE ku.id = %s AND c.name = %s '
            '   UNION '
            '   SELECT c.name, ucr.limited '
            '   FROM kontext_corpus AS c '
            '     JOIN kontext_user_access AS ucr ON  c.name = ucr.corpus_name '
            '   WHERE ucr.user_id = %s AND c.name = %s) AS guaccess '
            'GROUP BY guaccess.name',
            (user_dict['id'], corpus_name, user_dict['id'], corpus_name))
        row = cursor.fetchone()
        if row is not None:
            return False, True, self._variant_prefix(corpus_name)
        return False, False, ''

    def permitted_corpora(self, user_dict) -> List[str]:
        cursor = self.db.cursor()
        cursor.execute(
            'SELECT guaccess.name, MAX(guaccess.limited) AS limited '
            'FROM '
            '  (SELECT c.name, gr.limited '
            '   FROM kontext_corpus AS c '
            '     JOIN kontext_group_access AS gr ON gr.corpus_name = c.name '
            '     JOIN kontext_user AS ku ON ku.group_access = gr.group_access '
            '   WHERE ku.id = %s '
            '   UNION '
            '   SELECT c.name, ucr.limited '
            '   FROM kontext_corpus AS c '
            '     JOIN kontext_user_access AS ucr ON  c.name = ucr.corpus_name '
            '   WHERE ucr.user_id = %s) AS guaccess '
            'GROUP BY guaccess.name',
            (user_dict['id'], user_dict['id']))
        corpora = [row['name'] for row in cursor.fetchall()]
        if IMPLICIT_CORPUS not in corpora:
            corpora.append(IMPLICIT_CORPUS)
        return corpora

    def ignores_corpora_names_case(self):
        return not self._case_sensitive_corpora_names

    def get_user_info(self, plugin_ctx):
        cursor = self.db.cursor()
        cursor.execute(
            'SELECT id, username, firstname, lastname, email '
            'FROM kontext_user '
            'WHERE id = %s', (plugin_ctx.user_id, ))
        return cursor.fetchone()

    def is_administrator(self, user_id):
        """
        Tests whether the current user's name belongs to the 'administrators' group
        """
        return False

    def validate_new_password(self, password):
        """
        Tests whether the password candidate matches required password properties
        (like minimal length, presence of special characters etc.)

        Returns
        -------
        True on success else False
        """
        return len(password) >= self.MIN_PASSWORD_LENGTH

    def get_required_password_properties(self):
        """
        """
        return _('The string must be at least %s characters long.') % self.MIN_PASSWORD_LENGTH

    def get_login_url(self, return_url=None):
        if return_url is not None:
            return '{0}?continue={1}'.format(self._login_url, urllib.parse.quote(return_url))
        else:
            return self._login_url

    def get_logout_url(self, return_url=None):
        if return_url is not None:
            return '{0}?continue={1}'.format(self._logout_url, urllib.parse.quote(return_url))
        else:
            return self._logout_url

    def _find_user(self, username):
        """
        Searches for user's data by his username. We assume that username is unique.

        arguments:
        username -- log-in username of a user

        returns:
        a dictionary containing user data or None if nothing is found
        """
        cursor = self.db.cursor()
        cursor.execute(
            'SELECT id, username, firstname, lastname, email, pwd_hash, affiliation '
            'FROM kontext_user '
            'WHERE username = %s', (username,))
        return cursor.fetchone()

    def get_required_username_properties(self, plugin_ctx):
        return (_(
            'The value must be at least %s characters long and must contain only a..z, A..Z, 0..9, _, - characters')
            % self.MIN_USERNAME_LENGTH)

    def validate_new_username(self, plugin_ctx, username):
        avail = self._find_user(username) is None and 'admin' not in username
        valid = re.match(r'^[a-zA-Z0-9_-]{3,}$', username) is not None
        return avail, valid

    def sign_up_user(self, plugin_ctx, credentials):
        token = SignUpToken(user_data=credentials,
                            label=_('KonText sign up confirmation'),
                            ttl=self._confirmation_token_ttl)
        errors = defaultdict(lambda: [])
        avail_un, valid_un = self.validate_new_username(plugin_ctx, credentials['username'])
        if not avail_un:
            errors['username'].append(_('Username not available'))
        if not valid_un:
            errors['username'].append(_('Username not valid') + '. ' + self.get_required_username_properties(
                plugin_ctx))
        if credentials['password'] != credentials['password2']:
            errors['password'].append(_('New password and its confirmation do not match.'))
            errors['password2'].append('')
        if not self.validate_new_password(credentials['password']):
            errors['password'].append(_('Password not valid') + '. ' +
                                      self.get_required_password_properties())
        if not credentials['firstname']:
            errors['first_name'].append(_('First name not valid'))
        if not credentials['lastname']:
            errors['last_name'].append(_('Last name not valid'))
        if re.match(r'^[^@]+@[^@]+\.[^@]+$', credentials['email']) is None:  # just a basic e-mail syntax validation
            errors['email'].append(_('E-mail not valid'))

        token.pwd_hash = mk_pwd_hash_default(credentials['password'])
        del credentials['password2']
        if len(errors) == 0:
            token.save(self.db)
            ok = self.send_confirmation_mail(plugin_ctx, credentials['email'], credentials['username'],
                                             credentials['firstname'], credentials['lastname'], token)
            if not ok:
                raise Exception(
                    _('Failed to send a confirmation e-mail. Please check that you entered a valid e-mail and try '
                      'again. Alternatively you can report a problem.'))

        return dict((k, ' '.join(v)) for k, v in errors.items())

    def send_confirmation_mail(self, plugin_ctx, user_email, username, firstname, lastname, token):
        expir_date = (
            datetime.datetime.now().astimezone() +  # system timezone-aware
            datetime.timedelta(seconds=self._confirmation_token_ttl)
        )
        text = ''
        text += _('Hello')
        text += ',\n\n'
        text += _('thank you for using KonText at {url}.').format(url=plugin_ctx.root_url)
        text += '\n'
        tmp = _(
            'To verify your new account {username} (full name: {firstname} {lastname}) please click the link below')
        text += tmp.format(username=username, firstname=firstname, lastname=lastname)
        text += ':\n\n'
        text += plugin_ctx.create_url('user/sign_up_confirm_email', dict(key=token.value))
        text += '\n\n'
        text += time.strftime(_('The confirmation link will expire on %m/%d/%Y at %H:%M'),
                              expir_date.timetuple())
        text += ' ({0:%Z}, {0:%z})'.format(expir_date)
        text += '\n\n\n-----------------------------------------------\n'
        text += _('This e-mail has been generated automatically - please do not reply to it.')
        text += '\n'

        server = mailing.smtp_factory()
        msg = mailing.message_factory(
            recipients=[user_email], subject=_('KonText sign up confirmation'),
            text=text, reply_to=None)
        return mailing.send_mail(server, msg, [user_email])

    def sign_up_confirm(self, plugin_ctx, key):
        self.db.start_transaction()
        try:
            token = SignUpToken(value=key)
            token.load(self.db)
            if token.is_stored():
                curr = self._find_user(token.username)
                if curr:
                    raise SignUpNeedsUpdateException()

                cursor = self.db.cursor()
                cursor.execute(
                    'INSERT INTO kontext_user (username, firstname, lastname, pwd_hash, email, affiliation) '
                    'VALUES (%s, %s, %s, %s, %s, %s)',
                    (token.username, token.firstname, token.lastname,
                     token.pwd_hash, token.email, token.affiliation))
                for corp in self._on_register_get_corpora:
                    cursor.execute(
                        'INSERT INTO kontext_user_access (user_id, corpus_name, limited) '
                        'VALUES (%s, %s, 0) ', (cursor.lastrowid, corp))
                token.delete(self.db)
                self.db.commit()
                return dict(ok=True, label=token.label)
            else:
                self.db.rollback()
                return dict(ok=False)
        except Exception as ex:
            self.db.rollback()
            logging.getLogger(__name__).error(f'Failed to apply sign_up token {key}: {ex}')
            raise ex

    def get_form_props_from_token(self, key):
        token = SignUpToken(value=key)
        token.load(self.db)
        if token.is_stored():
            return token.user
        return None


@inject(plugins.runtime.INTEGRATION_DB, plugins.runtime.SESSIONS)
def create_instance(conf, integ_db: IntegrationDatabase[MySQLConnection, MySQLCursor], sessions):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    plugin_conf = conf.get('plugins', 'auth')
    if integ_db and integ_db.is_active and 'mysql_host' not in plugin_conf:
        dbx = integ_db
        logging.getLogger(__name__).info(f'mysql_auth uses integration_db[{integ_db.info}]')
    else:
        dbx = MySQLOps(MySQLConf(plugin_conf))
        logging.getLogger(__name__).info(
            'mysql_auth uses custom database configuration {}@{}'.format(
                plugin_conf['mysql_user'], plugin_conf['mysql_host']))
    return MysqlAuthHandler(
        db=dbx,
        sessions=sessions,
        anonymous_user_id=int(plugin_conf['anonymous_user_id']),
        case_sensitive_corpora_names=plugin_conf.get('case_sensitive_corpora_names', False),
        login_url=plugin_conf.get('login_url', '/user/login'),
        logout_url=plugin_conf.get('logout_url', '/user/logoutx'),
        smtp_server=conf.get('mailing', 'smtp_server'),
        mail_sender=conf.get('mailing', 'sender'),
        confirmation_token_ttl=int(
            plugin_conf.get('confirmation_token_ttl', MysqlAuthHandler.DEFAULT_CONFIRM_TOKEN_TTL)),
        on_register_get_corpora=plugin_conf.get('on_register_get_corpora', ('susanne',)))
