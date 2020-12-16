#!/usr/bin/env python3
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
This script is intended for creating 'tasks' triggered by user visiting
KonText. It can be a simple message, adding a new sub-corpus etc. The task
is specified by a JSON-encoded data structure. The concrete specification
can be seen in lib/scheduled.py.

The script should be able to run with any installation as long as the 'updater'
package contains properly defined Scheduler class in a properly named module.
The script chooses proper package by inspecting the 'db' plug-in name.
"""

import sys
import uuid
import os
from functools import wraps


app_path = os.path.realpath('%s/../..' % os.path.dirname(os.path.abspath(__file__)))
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


if __name__ == '__main__':
    import argparse
    import json
    import sys

    argparser = argparse.ArgumentParser(description="Scheduler")
    argparser.add_argument('file', metavar="FILE",
                           help="a JSON file containing task(s) specification")
    argparser.add_argument('-d', '--dry-run', action='store_true',
                           help="allows running without affecting storage data")
    argparser.add_argument('-r', '--recipient', type=str,
                           help="force a single recipient (no matter what JSON conf contains)")
    args = argparser.parse_args()

    settings.load('%s/conf/config.xml' % app_path)
    db_adapter = __import__('plugins.%s' % settings.get('plugins', 'db')
                            ['module'], fromlist=['create_instance'])
    db = db_adapter.create_instance(settings.get('plugins', 'db'))

    with open(args.file, 'r') as conf_file:
        conf = json.load(conf_file)
        if not 'tasks' in conf:
            print('Invalid configuration format - a \'task\' key must be present.')
            sys.exit(1)

        if args.recipient:
            for t in conf['tasks']:
                t['recipients'] = [args.recipient]

        db_plugin = settings.get('plugins', 'db')['module']
        plugin_group = db_plugin.split('_')[0]

        updater_module = __import__('updater.%s' % plugin_group, fromlist=['updater'])
        if not hasattr(updater_module, 'Scheduler'):
            print(('\nERROR: Scheduler class not found in module %s\n' % updater_module.__name__))
            sys.exit(1)
        scheduler = updater_module.Scheduler(db=db,
                                             conf=conf,
                                             dry_run=args.dry_run,
                                             settings_action_key=kontext.Kontext.SCHEDULED_ACTIONS_KEY,
                                             create_task_fn=create_task)
        scheduler.process_tasks()
