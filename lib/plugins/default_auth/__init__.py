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


class DefaultAuthHandler(AbstractInternalAuth):
    """
    Sample authentication handler
    """

    def __init__(self, db, sessions, anonymous_user_id, login_url, logout_url):
        """
        """
        super(DefaultAuthHandler, self).__init__(anonymous_user_id)
        self.db = db
        self.sessions = sessions
        self._login_url = login_url
        self._logout_url = logout_url

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
        return len(password) >= 5

    def get_required_password_properties(self):
        """
        """
        return _('The string must be at least 5 characters long.')

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
        user_key = self.db.hash_get('user_index', username)
        return self.db.get(user_key)


@inject(plugins.runtime.DB, plugins.runtime.SESSIONS)
def create_instance(conf, db, sessions):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    plugin_conf = conf.get('plugins', 'auth')
    return DefaultAuthHandler(db=db, sessions=sessions, anonymous_user_id=int(plugin_conf['anonymous_user_id']),
                              login_url=plugin_conf.get('login_url', '/user/login'),
                              logout_url=plugin_conf.get('logout_url', '/user/logoutx'))
