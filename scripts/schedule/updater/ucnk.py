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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import json


class Scheduler(object):
    """
    A custom task scheduler for UCNK installation.
    """

    def __init__(self, db, conf, dry_run, settings_action_key, create_task_fn):
        self._db = db
        self._conf = conf
        self._dry_run = dry_run
        self._settings_action_key = settings_action_key
        self._create_task_fn = create_task_fn

    def _get_anonymous_key(self):
        if 'anonymous_user_key' in self._conf:
            return self._conf['anonymous_user_key']
        return 'user:0000'

    def _get_all_users(self):
        return dict(self._db().execute("SELECT user, id FROM user").fetchall())

    def _get_user_settings(self, user_id):
        data = self._db().execute("SELECT data FROM noske_user_settings WHERE user_id = %s", (user_id, )).fetchone()
        if data:
            return json.loads(data[0])
        return {}

    def _set_user_settings(self, user_id, data):
        self._db().execute("UPDATE noske_user_settings SET data = %s WHERE user_id = %s", (json.dumps(data), user_id))

    def get_recipients(self, task_data):
        recipients = task_data.get('recipients', None)
        users = self._get_all_users()

        if recipients is None:
            ans = users
        else:
            ans = {}
            print(users)
            for recipient in recipients:
                if recipient in users:
                    ans[recipient] = users[recipient]
                else:
                    print(('unknown user: %s - omitting' % recipient))
        return ans

    def add_user_task(self, data):
        anonymous_user = self._get_anonymous_key()
        for username, user_id in list(self.get_recipients(data).items()):
            if user_id != anonymous_user:
                task = self._create_task_fn(data, username, user_id)
                user_settings = self._get_user_settings(user_id)
                if user_settings is None:
                    user_settings = {}
                if not self._settings_action_key in user_settings:
                    user_settings[self._settings_action_key] = []
                user_settings[self._settings_action_key].append(task)
                if not self._dry_run:
                    self._set_user_settings(user_id, user_settings)
                else:
                    print(('%s --> %s\n' % (user_id, task)))

    def process_tasks(self):
        for task in self._conf['tasks']:
            self.add_user_task(task)
