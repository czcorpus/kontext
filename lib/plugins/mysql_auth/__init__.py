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

import datetime
import hashlib
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from typing import List

import mailing
import plugins
from action.plugin.ctx import PluginCtx
from plugin_types.auth import (
    AbstractInternalAuth, AuthException, CorpusAccess, GetUserInfo,
    SignUpNeedsUpdateException)
from plugin_types.auth.hash import (
    mk_pwd_hash, mk_pwd_hash_default, split_pwd_hash)
from plugins import inject
from plugins.common.mysql import MySQLConf
from plugins.common.sqldb import DatabaseAdapter
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.mysql_corparch.backend import Backend
from plugins.mysql_integration_db import MySqlIntegrationDb

from .sign_up import SignUpToken

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
            db: DatabaseAdapter,
            corparch_backend,
            anonymous_user_id,
            case_sensitive_corpora_names: bool,
            login_url,
            logout_url,
            smtp_server,
            mail_sender,
            confirmation_token_ttl,
            on_register_get_corpora,
    ):
        """
        """
        super().__init__(anonymous_user_id)
        self.db = db
        self._corparch_backend = corparch_backend
        self._login_url = login_url
        self._logout_url = logout_url
        self._smtp_server = smtp_server
        self._mail_sender = mail_sender
        self._confirmation_token_ttl = confirmation_token_ttl
        self._on_register_get_corpora = on_register_get_corpora
        self._case_sensitive_corpora_names = case_sensitive_corpora_names

    async def validate_user(self, plugin_ctx, username, password):
        user_data = await self._find_user(username)
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
                if user_data['pwd_hash'] == mk_pwd_hash(
                        password, split['salt'], split['iterations'], split['keylen'], split['algo']):
                    valid_pwd = True

            if user_data['username'] == username and valid_pwd:
                return dict(
                    id=user_data['id'],
                    user=user_data['username'],
                    fullname='{0} {1}'.format(user_data['firstname'], user_data['lastname']),
                    email=user_data.get('email', None))
        return self.anonymous_user(plugin_ctx)

    def logout(self, session):
        """
        arguments:
        session -- Werkzeug session instance
        """
        session.clear()

    async def update_user_password(self, plugin_ctx, user_id, password):
        """
        Updates user's password.
        There is no need to hash/encrypt the password - function does it automatically.

        Security note: the calling function must make sure user_id matches the actual user logged in

        arguments:
        user_id -- a database ID of a user
        password -- new password
        """
        async with self.db.cursor() as cursor:
            await self.db.begin_tx(cursor)
            await cursor.execute('SELECT username FROM kontext_user WHERE id = %s', (user_id,))
            row = await cursor.fetchone()
            if row is not None:
                await cursor.execute('UPDATE kontext_user SET pwd_hash = %s WHERE id = %s',
                                     (mk_pwd_hash_default(password), user_id))
                await self.db.commit_tx()
            else:
                raise AuthException(plugin_ctx.translate('User %s not found.') % user_id)

    @staticmethod
    def _variant_prefix(corpname):
        return corpname.rsplit('/', 1)[0] if '/' in corpname else ''

    async def corpus_access(self, user_dict, corpus_name) -> CorpusAccess:
        if corpus_name == IMPLICIT_CORPUS:
            return CorpusAccess(False, True, '')
        async with self._corparch_backend.cursor() as cursor:
            _, access, variant = await self._corparch_backend.corpus_access(cursor, user_dict['id'], corpus_name)
            return CorpusAccess(False, access, variant)

    async def permitted_corpora(self, user_dict) -> List[str]:
        async with self._corparch_backend.cursor() as cursor:
            corpora = await self._corparch_backend.get_permitted_corpora(cursor, str(user_dict['id']))
        if IMPLICIT_CORPUS not in corpora:
            corpora.append(IMPLICIT_CORPUS)
        return corpora

    def ignores_corpora_names_case(self):
        return not self._case_sensitive_corpora_names

    async def get_user_info(self, plugin_ctx: PluginCtx) -> GetUserInfo:
        async with self.db.cursor() as cursor:
            await cursor.execute(
                'SELECT id, username, firstname, lastname, email '
                'FROM kontext_user '
                'WHERE id = %s', (plugin_ctx.user_id, ))
            return await cursor.fetchone()

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

    def get_required_password_properties(self, plugin_ctx):
        """
        """
        return plugin_ctx.translate('The string must be at least %s characters long.') % self.MIN_PASSWORD_LENGTH

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

    async def _find_user(self, username):
        """
        Searches for user's data by his username. We assume that username is unique.

        arguments:
        username -- log-in username of a user

        returns:
        a dictionary containing user data or None if nothing is found
        """
        async with self.db.cursor() as cursor:
            await cursor.execute(
                'SELECT id, username, firstname, lastname, email, pwd_hash, affiliation '
                'FROM kontext_user '
                'WHERE username = %s', (username,))
            return await cursor.fetchone()

    def get_required_username_properties(self, plugin_ctx):
        return (plugin_ctx.translate(
            'The value must be at least %s characters long and must contain only a..z, A..Z, 0..9, _, - characters')
            % self.MIN_USERNAME_LENGTH)

    async def validate_new_username(self, plugin_ctx, username):
        avail = await self._find_user(username) is None and 'admin' not in username
        valid = re.match(r'^[a-zA-Z0-9_-]{3,}$', username) is not None
        return avail, valid

    async def sign_up_user(self, plugin_ctx, credentials):
        token = SignUpToken(user_data=credentials,
                            label=plugin_ctx.translate('KonText sign up confirmation'),
                            ttl=self._confirmation_token_ttl)
        errors = defaultdict(lambda: [])
        avail_un, valid_un = await self.validate_new_username(plugin_ctx, credentials['username'])
        if not avail_un:
            errors['username'].append(plugin_ctx.translate('Username not available'))
        if not valid_un:
            errors['username'].append(plugin_ctx.translate('Username not valid') + '. ' + self.get_required_username_properties(
                plugin_ctx))
        if credentials['password'] != credentials['password2']:
            errors['password'].append(plugin_ctx.translate(
                'New password and its confirmation do not match.'))
            errors['password2'].append('')
        if not self.validate_new_password(credentials['password']):
            errors['password'].append(plugin_ctx.translate('Password not valid') + '. ' +
                                      self.get_required_password_properties(plugin_ctx))
        if not credentials['firstname']:
            errors['first_name'].append(plugin_ctx.translate('First name not valid'))
        if not credentials['lastname']:
            errors['last_name'].append(plugin_ctx.translate('Last name not valid'))
        if re.match(r'^[^@]+@[^@]+\.[^@]+$', credentials['email']) is None:  # just a basic e-mail syntax validation
            errors['email'].append(plugin_ctx.translate('E-mail not valid'))

        token.pwd_hash = mk_pwd_hash_default(credentials['password'])
        del credentials['password2']
        if len(errors) == 0:
            await token.save(self.db)
            ok = self.send_confirmation_mail(plugin_ctx, credentials['email'], credentials['username'],
                                             credentials['firstname'], credentials['lastname'], token)
            if not ok:
                raise Exception(
                    plugin_ctx.translate(
                        'Failed to send a confirmation e-mail. Please check that you entered a valid e-mail and try '
                        'again. Alternatively you can report a problem.'))

        return dict((k, ' '.join(v)) for k, v in errors.items())

    def send_confirmation_mail(self, plugin_ctx, user_email, username, firstname, lastname, token):
        expir_date = (
            datetime.datetime.now().astimezone() +  # system timezone-aware
            datetime.timedelta(seconds=self._confirmation_token_ttl)
        )
        text = ''
        text += plugin_ctx.translate('Hello')
        text += ',\n\n'
        text += plugin_ctx.translate(
            'thank you for using KonText at {url}.').format(url=plugin_ctx.root_url)
        text += '\n'
        tmp = plugin_ctx.translate(
            'To verify your new account {username} (full name: {firstname} {lastname}) please click the link below')
        text += tmp.format(username=username, firstname=firstname, lastname=lastname)
        text += ':\n\n'
        text += plugin_ctx.create_url('user/sign_up_confirm_email', dict(key=token.value))
        text += '\n\n'
        text += time.strftime(plugin_ctx.translate('The confirmation link will expire on %m/%d/%Y at %H:%M'),
                              expir_date.timetuple())
        text += ' ({0:%Z}, {0:%z})'.format(expir_date)
        text += '\n\n\n-----------------------------------------------\n'
        text += plugin_ctx.translate(
            'This e-mail has been generated automatically - please do not reply to it.')
        text += '\n'

        server = mailing.smtp_factory()
        msg = mailing.message_factory(
            recipients=[user_email], subject=plugin_ctx.translate('KonText sign up confirmation'),
            text=text, reply_to=None)
        return mailing.send_mail(server, msg, [user_email])

    async def sign_up_confirm(self, plugin_ctx, key):
        token = SignUpToken(value=key)
        await token.load(self.db)

        async with self.db.connection() as conn:
            try:
                if token.is_stored():
                    curr = await self._find_user(token.username)
                    if curr:
                        raise SignUpNeedsUpdateException()

                    async with await conn.cursor() as cursor:
                        await self.db.begin_tx(cursor)
                        await cursor.execute(
                            'INSERT INTO kontext_user (username, firstname, lastname, pwd_hash, email, affiliation) '
                            'VALUES (%s, %s, %s, %s, %s, %s)',
                            (token.username, token.firstname, token.lastname,
                             token.pwd_hash, token.email, token.affiliation))
                        for corp in self._on_register_get_corpora:
                            await cursor.execute(
                                'INSERT INTO kontext_user_access (user_id, corpus_name, limited) '
                                'VALUES (%s, %s, 0) ', (cursor.lastrowid, corp))
                    await token.delete(conn)
                    await conn.commit()
                    return dict(ok=True, label=token.label)
                else:
                    await conn.rollback()
                    return dict(ok=False)
            except Exception as ex:
                await conn.rollback()
                logging.getLogger(__name__).error(f'Failed to apply sign_up token {key}: {ex}')
                raise ex

    async def get_form_props_from_token(self, key):
        token = SignUpToken(value=key)
        await token.load(self.db)
        if token.is_stored():
            return token.user
        return None

    async def on_response(self):
        if isinstance(self.db, AdhocDB):
            await self.db.close()


@inject(plugins.runtime.INTEGRATION_DB)
def create_instance(conf, integ_db: MySqlIntegrationDb):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    plugin_conf = conf.get('plugins', 'auth')
    if integ_db and integ_db.is_active and 'mysql_host' not in plugin_conf:
        dbx = integ_db
        logging.getLogger(__name__).info(f'mysql_auth uses integration_db[{integ_db.info}]')
        corparch_backend = Backend(integ_db, enable_parallel_acc=True)
    else:
        dbx = AdhocDB(MySQLConf.from_conf(plugin_conf))
        logging.getLogger(__name__).info(
            'mysql_auth uses custom database configuration {}@{}'.format(
                plugin_conf['mysql_user'], plugin_conf['mysql_host']))
        corparch_backend = Backend(dbx)
    return MysqlAuthHandler(
        db=dbx,
        corparch_backend=corparch_backend,
        anonymous_user_id=int(plugin_conf['anonymous_user_id']),
        case_sensitive_corpora_names=plugin_conf.get('case_sensitive_corpora_names', False),
        login_url=plugin_conf.get('login_url', '/user/login'),
        logout_url=plugin_conf.get('logout_url', '/user/logoutx'),
        smtp_server=conf.get('mailing', 'smtp_server'),
        mail_sender=conf.get('mailing', 'sender'),
        confirmation_token_ttl=int(
            plugin_conf.get('confirmation_token_ttl', MysqlAuthHandler.DEFAULT_CONFIRM_TOKEN_TTL)),
        on_register_get_corpora=plugin_conf.get('on_register_get_corpora', ('susanne',)))
