# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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
A session handler compatible with secure_cookie.session.SessionStore.
It uses a general_storage.KeyValueStorage as its backend (currently default_db and redis_db modules).

The plug-in implements

required config.xml entries:

element sessions {
  element module { "default_sessions" }
  element ttl { xsd:integer }
}

Important note: Werkzeug's session store listens for data change (callbacks on __setitem__,
__delitem__). But this of course does not apply if you change some nested object:

a)
session['foo'] = {'x': 10}  # this triggers should_save = True

b)
session['foo']['x'] = 'whatever'  # this keeps should_save = False

In such case it is better to do something like this:
tmp = session.get('foo', {})
tmp['x'] = 'whatever'
session['foo'] = tmp

Or if you change nested data all the time you can customize app.py
to ignore 'should_save' attribute and save each time server finishes
request processing.

"""

import uuid
import hashlib
import random

from secure_cookie.session import SessionStore, Session

import plugins
from plugins import inject


class DefaultSessions(SessionStore):

    DEFAULT_TTL = 7200

    def __init__(self, settings, db):
        """
        Initialization according to the 'settings' object/module
        """
        super(DefaultSessions, self).__init__(session_class=None)
        self.db = db
        self._cookie_name = settings.get('plugins', 'auth')['auth_cookie_name']
        self.ttl = int(settings.get('plugins', 'sessions').get('ttl', DefaultSessions.DEFAULT_TTL))

    def get_cookie_name(self):
        return self._cookie_name

    def _mk_key(self, session_id):
        return 'session:%s' % (session_id, )

    def _set_ttl(self, key):
        if hasattr(self.db, 'set_ttl'):
            self.db.set_ttl(key, self.ttl)

    def generate_key(self, salt=None):
        return hashlib.sha1(uuid.uuid1().bytes + str(random.random()).encode()).hexdigest()

    def delete(self, session):
        self.db.remove(self._mk_key(session.sid))

    def get(self, sid):
        if not self.is_valid_key(sid):
            return self.new()
        return Session(self.db.get(self._mk_key(sid)), sid)

    def is_valid_key(self, key):
        return self.db.exists(self._mk_key(key))

    def new(self):
        """
        Writes a new session record to the storage
        """
        session_id = self.generate_key()
        data = {}
        sess_key = self._mk_key(session_id)
        self.db.set(sess_key, data)
        self._set_ttl(sess_key)
        return Session(data, session_id)

    def save(self, session):
        sess_key = self._mk_key(session.sid)
        self.db.set(sess_key, dict(session))
        self._set_ttl(sess_key)

    def save_if_modified(self, session):
        if session.should_save:
            self.save(session)


@inject(plugins.runtime.DB)
def create_instance(config, db):
    """
    This is an expected plugin module method to create instance of the service
    """
    return DefaultSessions(config, db)
