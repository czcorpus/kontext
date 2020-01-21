# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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


import os
import sys

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../..')))
import autoconf
import plugins
import MySQLdb

if __name__ == '__main__':
    print("Migration of subcorpora directories - version for the Czech National Corpus")
    print("(for default_auth based installations, please use updsubc.py instead)")
    print('')
    subc_root = autoconf.settings.get('corpora', 'users_subcpath')
    conn = MySQLdb.connect(host='skalicka', user='manatee',
                           passwd=input('password? '),
                           db='manatee',
                           use_unicode=True, charset='utf-8')
    cur = conn.cursor()
    cur.execute('SELECT id, user FROM user ORDER by user')
    rows = cur.fetchall()
    for row in rows:
        user_id = row[0]
        username = row[1]
        from_path = os.path.join(subc_root, username)
        to_path = os.path.join(subc_root, str(user_id))
        if os.path.exists(from_path) and not os.path.exists(to_path):
            try:
                print(('%s ---> %s' % (from_path, to_path)))
                os.rename(from_path, to_path)
            except Exception as e:
                print(('    ERR: %s' % (e,)))
        elif os.path.exists(to_path):
            print(('    ERR: path collision: %s  vs. %s' % (from_path, to_path)))
    print('')
