# Copyright (c) 2014 Institute of the Czech National Corpus
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

from abstract.auth import AbstractInternalAuth, AuthException
from translation import ugettext as _
from plugins import inject


IMPLICIT_CORPUS = 'susanne'


class DefaultAuthHandler(AbstractInternalAuth):
    """
    Sample authentication handler
    """

    def __init__(self, db, sessions, anonymous_user_id):
        """
        arguments:
        db -- a 'db' plug-in
        sessions -- a 'sessions' plugin
        """
        super(DefaultAuthHandler, self).__init__(anonymous_user_id)
        self.db = db
        self.sessions = sessions

    @staticmethod
    def _mk_user_key(user_id):
        return 'user:%d' % user_id

    @staticmethod
    def _mk_list_key(user_id):
        return 'corplist:user:%s' % user_id

    def validate_user(self, username, password):
        user_data = self._find_user(username)
        valid_pwd = False
        if user_data:
            if len(user_data['pwd_hash']) == 32:
                pwd_hash = hashlib.md5(password).hexdigest()
                if user_data['pwd_hash'] == pwd_hash:
                    valid_pwd = True
            else:
                import crypt
                if crypt.crypt(password, user_data['pwd_hash']) == user_data['pwd_hash']:
                    valid_pwd = True

            if user_data['username'] == username and valid_pwd:
                return {
                    'id': user_data['id'],
                    'user': user_data['username'],
                    'fullname': '%s %s' % (user_data['firstname'], user_data['lastname'])
                }
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
            user_data['pwd_hash'] = hashlib.md5(password).hexdigest()
            self.db.set(user_key, user_data)
        else:
            raise AuthException(_('User %s not found.') % user_id)

    def canonical_corpname(self, corpname):
        """
        KonText introduces a convention that corpus_id can have a path-like prefix
        which represents a different Manatee registry file. This allows attaching
        a specially configured corpus to a user according to his access rights.

        Example: let's say we have 'syn2010' and 'spec/syn2010' corpora where the latter
        has some limitations (e.g. user can explore only a small KWIC range). These two
        corpora are internally represented by two distinct Manatee registry files:
        (/path/to/registry/syn2010 and /path/to/registry/spec/syn2010).
        User cannot see the string 'spec/syn2010' anywhere in the interface (only in URL).

        By the term 'canonical' we mean the original id (= Manatee registry file name).
        """
        return corpname.rsplit('/', 1)[-1]

    def permitted_corpora(self, user_id):
        corpora = self.db.get(self._mk_list_key(user_id), [])
        if IMPLICIT_CORPUS not in corpora:
            corpora.append(IMPLICIT_CORPUS)
        return dict([(self.canonical_corpname(c), c) for c in corpora])

    def get_user_info(self, user_id):
        user_key = self._mk_user_key(user_id)
        info = self.db.get(user_key)
        info.pop('pwd_hash', None)
        info.pop('recovery_hash', None)
        return info

    def is_administrator(self, user_id):
        """
        Tests whether the current user's name belongs to the 'administrators' group
        """
        return True

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
            return '/user/login?continue=%s' % urllib.quote(return_url)
        else:
            return '/user/login'

    def get_logout_url(self, return_url=None):
        if return_url is not None:
            return '/user/logoutx?continue=%s' % urllib.quote(return_url)
        else:
            return '/user/logoutx'

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


@inject('db', 'sessions')
def create_instance(conf, db, sessions):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    return DefaultAuthHandler(db, sessions, conf.get_int('global', 'anonymous_user_id'))

