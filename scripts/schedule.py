#!/usr/bin/env python
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

"""
A script to schedule tasks of defined type (see lib/scheduled.py) for user accounts.
This allows sending messages to users create subcorpora for them etc.

TODO: task JSON format specification
"""


import sys
import os
import uuid
from functools import wraps

app_path = os.path.realpath('%s/..' % os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '%s/lib' % app_path)
import settings
import kontext


def auto_id(fn):
    @wraps(fn)
    def wrapper(data, username, user_key):
        task = fn(data, username, user_key)
        task['id'] = str(uuid.uuid1())
        return task
    return wrapper


@auto_id
def message_task_factory(data, username, user_key):
    task = {
        'action': data['action'],
        'message': data['message'] % {'username': username, 'user_key': user_key}
    }
    return task


@auto_id
def subcorpus_task_factory(data, username, user_key):
    task = {
        'action': data['action'],
        'files': data['files'],
        'username': username,
        'user_key': user_key
    }
    return task


def create_task(data, username, user_key):
    fn = {
        'show_message': message_task_factory,
        'add_subcorpus': subcorpus_task_factory
    }[data['action']]
    return fn(data, username, user_key)


class Scheduler(object):

    def __init__(self, db, conf, dry_run):
        self._db = db
        self._conf = conf
        self._dry_run = dry_run

    def _get_anonymous_key(self):
        if 'anonymous_user_key' in self._conf:
            return self._conf['anonymous_user_key']
        return 'user:0000'

    def get_recipients(self, task_data):
        recipients = task_data.get('recipients', None)
        if recipients is None:
            ans = db.hash_get_all('user_index')
        else:
            ans = {}
            for recipient in recipients:
                ans[recipient] = db.hash_get('user_index', recipient)
        return ans

    def add_user_task(self, data):
        anonymous_user = self._get_anonymous_key()
        for username, record_id in self.get_recipients(data).items():
            if record_id != anonymous_user:
                settings_key = 'settings:%s' % record_id
                task = create_task(data, username, record_id)
                user_settings = self._db.get(settings_key)
                if user_settings is None:
                    user_settings = {}
                if not kontext.Kontext.SCHEDULED_ACTIONS_KEY in user_settings:
                    user_settings[kontext.Kontext.SCHEDULED_ACTIONS_KEY] = []
                user_settings[kontext.Kontext.SCHEDULED_ACTIONS_KEY].append(task)
                if not self._dry_run:
                    self._db.set(settings_key, user_settings)
                else:
                    print('%s --> %s\n' % (settings_key, task))

    def process_tasks(self):
        for task in self._conf['tasks']:
            self.add_user_task(task)

if __name__ == '__main__':
    import argparse
    import json
    import sys

    argparser = argparse.ArgumentParser(description="Scheduler")
    argparser.add_argument('file', metavar="FILE", help="a JSON file containing task(s) specification")
    argparser.add_argument('-d', '--dry-run', action='store_true', help="allows running without affecting storage data")
    args = argparser.parse_args()

    settings.load('%s/config.xml' % app_path)
    db_adapter = __import__('plugins.%s' % settings.get('plugins', 'db')['module'], fromlist=['create_instance'])
    db = db_adapter.create_instance(settings.get('plugins', 'db'))

    with open(args.file, 'r') as conf_file:
        conf = json.load(conf_file)
        if not 'tasks' in conf:
            print('Invalid configuration format - a \'task\' key must be present.')
            sys.exit(1)
        scheduler = Scheduler(db, conf, dry_run=args.dry_run)
        scheduler.process_tasks()

