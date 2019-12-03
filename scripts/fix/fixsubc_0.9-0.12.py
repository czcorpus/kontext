import sys
import os

sys.path.insert(0, os.path.realpath('%s/..' % os.path.dirname(__file__)))
import autoconf
import plugins

from plugins import lindat_db
plugins.install_plugin('db', lindat_db, autoconf.settings)

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Rename subcorpora directories')
    parser.add_argument('--old-user_dict-key', dest='old_key', default='username', help='The old '
                        'key used to name directories, e.g. username in 0.9')
    parser.add_argument('--new-user_dict-key', dest='new_key', default='id', help='The new key '
                        'used to name directories, e.g. id in 0.12')

    args = parser.parse_args()
    subcpath = autoconf.settings.get('corpora', 'users_subcpath')
    redis_db = plugins.runtime.DB.instance
    db = redis_db.get_instance('auth')
    keys = list([key for key in list(db.keys()) if key != '__user_count'])
    users = {db.hash_get(key, args.old_key): db.hash_get_all(key) for key in keys}

    for user_subc_dir in [f for f in os.listdir(subcpath) if os.path.isdir(os.path.join(subcpath, f))]:
        key = user_subc_dir
        if args.old_key == 'id':
            key = int(user_subc_dir)
        user = users[key]
        new_val = user[args.new_key]
        if args.new_key == 'id':
            new_val = str(user[args.new_key])
        os.rename(os.path.join(subcpath, user_subc_dir), os.path.join(subcpath, new_val))
