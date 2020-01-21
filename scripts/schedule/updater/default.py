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


class Scheduler(object):
    """
    A task scheduler for the default installation.
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

    def get_recipients(self, task_data):
        recipients = task_data.get('recipients', None)
        if recipients is None:
            ans = self._db.hash_get_all('user_index')
        else:
            ans = {}
            for recipient in recipients:
                ans[recipient] = self._db.hash_get('user_index', recipient)
        return ans

    def add_user_task(self, data):
        anonymous_user = self._get_anonymous_key()
        for username, record_id in list(self.get_recipients(data).items()):
            if not record_id:
                print(('unknown recipient \'%s\'; omitting' % username))
            elif record_id == anonymous_user:
                print('omitting anonymous user')
            else:
                settings_key = 'settings:%s' % record_id
                task = self._create_task_fn(data, username, record_id)
                user_settings = self._db.get(settings_key)
                if user_settings is None:
                    user_settings = {}
                if not self._settings_action_key in user_settings:
                    user_settings[self._settings_action_key] = []
                user_settings[self._settings_action_key].append(task)
                if not self._dry_run:
                    self._db.set(settings_key, user_settings)
                else:
                    print(('%s --> %s\n' % (settings_key, task)))

    def process_tasks(self):
        for task in self._conf['tasks']:
            self.add_user_task(task)
