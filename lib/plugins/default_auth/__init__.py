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
A simple authentication module to start with.
It relies on default_db module which requires no database backend.
"""
import hashlib
import urllib
import os
import re
import uuid
import time
import datetime
import smtplib
from email.mime.text import MIMEText
import logging
from werkzeug.security import pbkdf2_hex
from plugins.abstract.auth import AbstractInternalAuth, AuthException
from translation import ugettext as _
import plugins
from plugins import inject

IMPLICIT_CORPUS = 'ud_fused_test_a'


def mk_pwd_hash_default(data):
    """
    Returns a pbkdf2_hex hash of the passed data with default parameters
    """
    iterations = 1000
    keylen = 24
    algo = 'sha512'
    salt = os.urandom(keylen).encode('hex')
    return mk_pwd_hash(data, salt, iterations, keylen, algo)


def mk_pwd_hash(data, salt, iterations, keylen, algo):
    """
    Returns a pbkdf2_hex hash of the passed data with specified parameters
    """
    hashed = pbkdf2_hex(data, salt, iterations, keylen, algo)
    return algo + "$" + salt + ":" + str(iterations) + "$" + hashed


def split_pwd_hash(hashed):
    """
    Splits a string expected to have an "algorithm$salt:iterations$hashed_pwd" format and returns a dictionary of
    the values. For legacy pwd hashes, a dictionary with a single value (i.e. {'data': legacyHash}) is returned.
    """
    res = {}
    first_split = hashed.split("$")
    # no dollar-sign means legacy pwd format
    if len(first_split) == 1:
        res['data'] = hashed
    else:
        # expected format: "algorithm$salt:iterations$hashed_pwd"
        if len(first_split) == 3:
            res['algo'] = first_split[0]
            res['salt'] = first_split[1].split(":")[0]
            res['iterations'] = int(first_split[1].split(":")[1])
            res['data'] = first_split[2]
            res['keylen'] = len(res['data']) / 2
        else:
            raise TypeError("wrong hash format")
    return res


class SignUpToken(object):

    def __init__(self, value=None, user_data=None, label=None, ttl=300):
        self.value = value if value is not None else hashlib.sha1(str(uuid.uuid4())).hexdigest()
        self.user = user_data if user_data else {}
        self.label = label
        self.created = int(time.time())
        self.ttl = ttl
        self.bound = False

    def _mk_key(self):
        return 'signup:{0}'.format(self.value)

    def save(self, db):
        rec = dict(value=self.value, user=self.user, created=self.created, label=self.label)
        k = self._mk_key()
        db.set(k, rec)
        db.set_ttl(k, self.ttl)
        self.bound = True

    def load(self, db):
        rec = db.get(self._mk_key())
        if rec:
            self.user = rec['user']
            self.created = rec['created']
            self.label = rec['label']
            self.bound = True
        self.ttl = db.get_ttl(self._mk_key())

    def delete(self, db):
        db.remove(self._mk_key())
        self.bound = False

    def is_valid(self, db):
        return db.get_ttl(self._mk_key()) > 0

    def is_stored(self):
        return self.bound


class DefaultAuthHandler(AbstractInternalAuth):
    """
    Sample authentication handler
    """

    MIN_PASSWORD_LENGTH = 5

    MIN_USERNAME_LENGTH = 3

    DEFAULT_CONFIRM_TOKEN_TTL = 60

    LAST_USER_ID_KEY = 'last_user_id'

    USER_INDEX_KEY = 'user_index'

    def __init__(self, db, sessions, anonymous_user_id, login_url, logout_url, smtp_server, mail_sender,
                 confirmation_token_ttl, on_register_get_corpora):
        """
        """
        super(DefaultAuthHandler, self).__init__(anonymous_user_id)
        self.db = db
        self.sessions = sessions
        self._login_url = login_url
        self._logout_url = logout_url
        self._smtp_server = smtp_server
        self._mail_sender = mail_sender
        self._confirmation_token_ttl = confirmation_token_ttl
        self._on_register_get_corpora = on_register_get_corpora

    @staticmethod
    def _mk_user_key(user_id):
        return 'user:%d' % user_id

    @staticmethod
    def _mk_list_key(user_id):
        return 'corplist:user:%s' % user_id

    def validate_user(self, plugin_api, username, password):
        user_data = self._find_user(username)
        valid_pwd = False
        if user_data:
            split = split_pwd_hash(user_data['pwd_hash'])
            if 'salt' not in split:
                if len(user_data['pwd_hash']) == 32:
                    pwd_hash = hashlib.md5(password).hexdigest()
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
                    fullname=u'{0} {1}'.format(user_data['firstname'], user_data['lastname']),
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

        arguments:
        user_id -- a database ID of a user
        password -- new password
        """
        user_key = self._mk_user_key(user_id)
        user_data = self.db.get(user_key)
        if user_data:
            user_data['pwd_hash'] = mk_pwd_hash_default(password)
            self.db.set(user_key, user_data)
        else:
            raise AuthException(_('User %s not found.') % user_id)

    @staticmethod
    def _variant_prefix(corpname):
        return corpname.rsplit('/', 1)[0] if '/' in corpname else ''

    def permitted_corpora(self, user_dict):
        corpora = self.db.get(self._mk_list_key(user_dict['id']), [])
        if IMPLICIT_CORPUS not in corpora:
            corpora.append(IMPLICIT_CORPUS)
        return dict((c, self._variant_prefix(c)) for c in corpora)

    def get_user_info(self, plugin_api):
        user_key = self._mk_user_key(plugin_api.user_id)
        info = self.db.get(user_key)
        info.pop('pwd_hash', None)
        info.pop('recovery_hash', None)
        return info

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
            return '{0}?continue={1}'.format(self._login_url, urllib.quote(return_url))
        else:
            return self._login_url

    def get_logout_url(self, return_url=None):
        if return_url is not None:
            return '{0}?continue={1}'.format(self._logout_url, urllib.quote(return_url))
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
        user_key = self.db.hash_get(self.USER_INDEX_KEY, username)
        return self.db.get(user_key)

    def get_required_username_properties(self, plugin_api):
        return (_(
            'The value must be at least %s characters long and must contain only a..z, A..Z, 0..9, _, - characters')
            % self.MIN_USERNAME_LENGTH)

    def validate_new_username(self, plugin_api, username):
        avail = self._find_user(username) is None and 'admin' not in username
        valid = re.match(r'^[a-zA-Z0-9_-]{3,}$', username) is not None
        return avail, valid

    def sign_up_user(self, plugin_api, credentials):
        token = SignUpToken(user_data=credentials,
                            label=_('KonText sign up confirmation'),
                            ttl=self._confirmation_token_ttl)
        errors = []
        avail_un, valid_un = self.validate_new_username(plugin_api, credentials['username'])
        if not avail_un:
            errors.append(('username', _('Username not available')))
        if not valid_un:
            errors.append(('username', _('Username not valid') + '. ' + self.get_required_username_properties(
                plugin_api)))
        if credentials['password'] != credentials['password2']:
            errors.append(('password', _('New password and its confirmation do not match.')))
            errors.append(('password2', None))
        if not self.validate_new_password(credentials['password']):
            errors.append(('password', _('Password not valid') + '. ' +
                           self.get_required_password_properties()))
        if not credentials['first_name']:
            errors.append(('first_name', _('First name not valid')))
        if not credentials['last_name']:
            errors.append(('last_name', _('Last name not valid')))
        if re.match(r'^[^@]+@[^@]+\.[^@]+$', credentials['email']) is None:  # just a basic e-mail syntax validation
            errors.append(('email', _('E-mail not valid')))

        credentials['password'] = mk_pwd_hash_default(credentials['password'])
        del credentials['password2']
        if len(errors) == 0:
            token.save(self.db)
            ok = self.send_confirmation_mail(plugin_api, credentials['email'], credentials['username'],
                                             credentials['first_name'], credentials['last_name'], token)
            if not ok:
                raise Exception(
                    _('Failed to send a confirmation e-mail. Please check that you entered a valid e-mail and try again. Alternatively you can report a problem.'))

        return errors

    def send_confirmation_mail(self, plugin_api, user_email, username, first_name, last_name, token):
        expir_date = datetime.datetime.now() + datetime.timedelta(0, self._confirmation_token_ttl)
        text = _('Hello')
        text += ',\n\n'
        text += _('thank you for using KonText at {url}.').format(url=plugin_api.root_url)
        text += '\n'
        text += _(
            'To verify your new account {username} (full name: {first_name} {last_name}) please click the link below').format(
            username=username, first_name=first_name, last_name=last_name)
        text += ':\n\n'
        text += plugin_api.create_url('user/sign_up_confirm_email', dict(key=token.value))
        text += '\n\n'
        text += time.strftime(_('The confirmation link will expire on %m/%d/%Y at %H:%M').encode(
            'utf-8'), expir_date.timetuple()).decode('utf-8')
        text += '\n\n\n-----------------------------------------------\n'
        text += _('This e-mail has been generated automatically - please do not reply to it.')
        text += '\n'

        s = smtplib.SMTP(self._smtp_server)

        msg = MIMEText(text, 'plain', 'utf-8')
        msg['Subject'] = _('KonText sign up confirmation')
        msg['From'] = self._mail_sender
        msg['To'] = user_email
        msg.add_header('Reply-To', user_email)

        try:
            s.sendmail(self._mail_sender, [user_email], msg.as_string())
            ans = True
        except Exception as ex:
            logging.getLogger(__name__).warn(
                'There were errors sending registration confirmation link via e-mail(s): %s' % (ex,))
            ans = False
        finally:
            s.quit()
        return ans

    def find_free_user_id(self):
        v = self.db.get(self.LAST_USER_ID_KEY)
        if v is None:
            v = 0
        avail = False
        while not avail:
            v += 1
            avail = (self.db.get(self._mk_user_key(v)) is None)
        return v

    def sign_up_confirm(self, plugin_api, key):
        token = SignUpToken(value=key)
        token.load(self.db)
        if token.is_stored():
            new_id = self.find_free_user_id()
            self.db.set(self._mk_user_key(new_id),
                        dict(id=new_id, username=token.user['username'], firstname=token.user['first_name'],
                             lastname=token.user['last_name'], email=token.user['email'],
                             pwd_hash=token.user['password']))
            self.db.hash_set(self.USER_INDEX_KEY, token.user['username'], self._mk_user_key(new_id))
            self.db.set(self.LAST_USER_ID_KEY, new_id)
            self.db.set(self._mk_list_key(new_id), self._on_register_get_corpora)
            token.delete(self.db)
            return dict(ok=True, label=token.label)
        else:
            return dict(ok=False)


@inject(plugins.runtime.DB, plugins.runtime.SESSIONS)
def create_instance(conf, db, sessions):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    plugin_conf = conf.get('plugins', 'auth')
    return DefaultAuthHandler(db=db,
                              sessions=sessions,
                              anonymous_user_id=int(plugin_conf['anonymous_user_id']),
                              login_url=plugin_conf.get('login_url', '/user/login'),
                              logout_url=plugin_conf.get('logout_url', '/user/logoutx'),
                              smtp_server=conf.get('mailing', 'smtp_server'),
                              mail_sender=conf.get('mailing', 'sender'),
                              confirmation_token_ttl=int(plugin_conf.get('confirmation_token_ttl',
                                                                         DefaultAuthHandler.DEFAULT_CONFIRM_TOKEN_TTL)),
                              on_register_get_corpora=plugin_conf['on_register_get_corpora'])
