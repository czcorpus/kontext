# Copyright (c) 2014 Institute of Formal and Applied Linguistics
# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek @ gmail.com>
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
A custom authentication module for the Institute of Formal and Applied Linguistics.
You probably want to implement an authentication solution of your own. Please refer
to the documentation or read the dummy_auth.py module to see the required interface.
"""
import crypt
import MySQLdb

from translation import ugettext as _
import plugins
from plugins.abstract.auth import AbstractSemiInternalAuth
from plugins.tree_corparch import CorptreeParser


class DbConnection(object):

    def __init__(self, conn):
        self.conn = conn

    def get(self):
        return self.conn


def open_db(conf):
    conn = MySQLdb.connect(host=conf['lindat:auth_db_host'], user=conf['lindat:auth_db_username'],
                           passwd=conf['lindat:auth_db_password'], db=conf['lindat:auth_db_name'])
    conn.set_character_set('utf8')
    return DbConnection(conn)


class LINDATAuth(AbstractSemiInternalAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    MIN_PASSWORD_LENGTH = 5

    def __init__(self, db_conn, sessions, corplist, admins, anonymous_id):
        """
        arguments:
        db_conn -- a database connection
        sessions -- a session plugin
        corplist -- a list of permitted corpora
        admins -- list of usernames with administrator privileges
        anonymous_id -- an ID of a public/anonymous user
        """
        super(LINDATAuth, self).__init__(anonymous_id=anonymous_id)
        self.db_conn = db_conn
        self.sessions = sessions
        self.corplist = corplist
        self.admins = admins

    def anonymous_user(self):
        return dict(id=0, user=None, fullname=_('anonymous'))

    def validate_user(self, plugin_api, username, password):
        """
        returns:
        a dict with user properties or empty dict
        """
        getenv = plugin_api.get_from_environ
        if username is not None and username != '':
            cols = ('id', 'user', 'pass', 'firstName', 'surname')
            cursor = self.db_conn.cursor()
            cursor.execute("SELECT %s FROM user WHERE user = %%s" % ','.join(cols), (username, ))
            row = cursor.fetchone()
            if row and crypt.crypt(password, row[2]) == row[2]:
                row = dict(zip(cols, row))
            else:
                row = {}
            cursor.close()
            if 'id' in row:
                return dict(id=row['id'],
                            user=row['user'],
                            fullname='%s %s' % (row['firstName'], row['surname']))
            return self.anonymous_user()
        else:
            username = getenv('HTTP_EPPN') or getenv('HTTP_PERSISTENT_ID') or getenv('HTTP_MAIL')
            if username is None or username == '':
                return self.anonymous_user()
            first_name = getenv('HTTP_GIVENNAME')
            surname = getenv('HTTP_SN')
            if not first_name and not surname:
                full_name = getenv('HTTP_DISPLAYNAME') or getenv('HTTP_CN')
                first_name, surname = self.parse_full_name(full_name)
            cols = ('id', 'user', 'pass', 'firstName', 'surname')
            cursor = self.db_conn.cursor()
            cursor.execute("SELECT %s FROM user WHERE user = %%s" % ','.join(cols), (username, ))
            row = cursor.fetchone()
            if not row:
                cursor.execute("INSERT INTO user (user, firstName, surname) VALUES (%s, %s, %s)",
                               (username, first_name, surname))
            else:
                cursor.execute("UPDATE user SET firstName=%s, surname=%s WHERE user=%s",
                               (first_name, surname, username))
            cursor.execute("SELECT %s FROM user WHERE user = %%s" % ','.join(cols),
                           (username, ))
            row = cursor.fetchone()
            row = dict(zip(cols, row)) if row else {}
            cursor.close()
            if 'id' in row:
                return dict(id=row['id'],
                            user=row['user'],
                            fullname='%s %s' % (row['firstName'], row['surname']))
        return self.anonymous_user()

    def logout(self, session):
        self.sessions.delete(session)
        session.clear()

    def permitted_corpora(self, user_dict):
        return self.corplist

    def is_administrator(self, user_id):
        """
        Tests whether the current user's name belongs to the 'administrators' group
        """
        return user_id in self.admins

    def logout_hook(self, plugin_api):
        plugin_api.redirect('%sfirst_form' % (plugin_api.root_url,))

    def get_restricted_corp_variant(self, corpus_name):
        return corpus_name

    def parse_full_name(self, full_name):
        parts = full_name.split(" ")
        first_name = " ".join(parts[:-1])
        surname = parts[-1]
        return first_name, surname


def _load_corplist(corptree_path):
    _, metadata = CorptreeParser().parse_xml_tree(corptree_path)
    return dict((k, k) for k in metadata.keys())


@plugins.inject(plugins.runtime.SESSIONS)
def create_instance(conf, sessions):
    plugin_conf = conf.get('plugins', 'auth')
    allowed_corplist = _load_corplist(conf.get('plugins', 'auth')['lindat:corptree_path'])
    return LINDATAuth(db_conn=open_db(plugin_conf).get(),
                      sessions=sessions,
                      corplist=allowed_corplist,
                      admins=plugin_conf.get('lindat:administrators', []),
                      anonymous_id=int(plugin_conf['anonymous_user_id']))
