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

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../scripts')))
import autoconf
import plugins
import initializer
initializer.init_plugin('db')

if __name__ == '__main__':
    subc_root = autoconf.settings.get('corpora', 'users_subcpath')
    for username, user_key in list(plugins.runtime.DB.instance.hash_get_all('user_index').items()):
        user_id = user_key.split(':')[1]

        from_path = os.path.join(subc_root, username)
        to_path = os.path.join(subc_root, user_id)
        if os.path.exists(from_path) and not os.path.exists(to_path):
            try:
                print(('%s ---> %s' % (from_path, to_path)))
                os.rename(from_path, to_path)
            except Exception as e:
                print(('    ERR: %s' % (e,)))
        elif os.path.exists(to_path):
            print(('    ERR: path collision: %s  vs. %s' % (from_path, to_path)))
        print('')
