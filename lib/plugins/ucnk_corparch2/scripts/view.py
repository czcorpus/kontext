# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

from __future__ import print_function
import os
import sys
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from plugins.rdbms_corparch.registry import RegModelSerializer, RegistryConf
from plugins.ucnk_remote_auth4.backend.mysql import Backend


def load_registry(corpus_id, variant, backend):
    conf = RegistryConf(corpus_id=corpus_id, variant=variant, backend=backend)
    conf.load()
    return RegModelSerializer().serialize(conf)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='View database-stored Manatee registry')
    parser.add_argument('dbpath', metavar='DB_PATH', type=str)
    parser.add_argument('corpus_id', metavar='CORPUS_ID', type=str)
    parser.add_argument('-v', '--variant', metavar='VARIANT', type=str,
                        help='A subdirectory containing (restricted) variants of the corpus')
    args = parser.parse_args()
    try:
        backend = Backend(args.dbpath)
        print(load_registry(args.corpus_id, variant=args.variant, backend=backend).encode('utf-8'))
    except Exception as e:
        print(e, file=sys.stderr)
