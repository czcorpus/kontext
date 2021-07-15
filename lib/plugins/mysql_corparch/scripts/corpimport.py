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

"""
This script can be used to import corpus information from an existing registr file
to a configured MySQL/MariaDB database. Once imported, more information can be
configured for a corpus (e.g. settings for spoken corpora, query suggestion,
multiple tagsets per corpus etc.).
"""

import os
import argparse
import sys
import logging
from collections import defaultdict
from typing import Callable, Optional
import io

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
import plugins.abstract.corparch.registry.parser
from plugins.abstract.corparch.registry.tokenizer import Tokenizer
from plugins.abstract.corparch.registry.parser import Parser
from plugins.abstract.corparch.install import InstallJson
from plugins.mysql_corparch.backendw import WriteBackend, Backend

logging.basicConfig(format='%(asctime)s %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S',
                    level=logging.INFO)


def parse_registry(
        infile: io.StringIO, collator_locale: str, variant: str, rbackend: Backend,
        wbackend: WriteBackend, corp_factory: Callable, update_if_exists: bool):
    logging.getLogger(__name__).info(f'Parsing file {infile.name}')
    corpus_id = os.path.basename(infile.name)
    tokenize = Tokenizer(infile)
    tokens = tokenize()
    parse = Parser(corpus_id, variant, tokens, wbackend)
    registry_conf = parse()
    corp = corp_factory(infile.name)
    iconf = InstallJson(ident=corpus_id, collator_locale=collator_locale)

    tst = rbackend.load_corpus(corpus_id)
    if tst is None:
        wbackend.save_corpus_config(iconf, registry_conf, corp.size())
    elif update_if_exists:
        logging.getLogger(__file__).warning(
            f'Corpus {corpus_id} already in database - registry-related data will be updated based '
            'on the provided registry file')
        wbackend.update_corpus_config(iconf, registry_conf, corp.size())
    else:
        raise Exception(f'Corpus {corpus_id} already in database - use the "-u" option to update registry-based data')
    return registry_conf.save()


def remove_comments(infile):
    ans = []
    for line in infile:
        if not line.strip().startswith('#'):
            ans.append(line)
    return ''.join(ans)


def process_directory(
        dir_path: str, variant: Optional[str], rbackend: Backend, wbackend: WriteBackend,
        corp_factory: Callable, collator_locale: str, auto_align: bool, update_if_exists: bool):
    if variant:
        dir_path = os.path.join(dir_path, variant)
    aligned = {}
    id_map = {}
    created_rt = {}
    for item in os.listdir(dir_path):
        fpath = os.path.join(dir_path, item)
        if os.path.isfile(fpath):
            with open(fpath) as fr:
                ans = parse_registry(
                    infile=fr, variant=variant, rbackend=rbackend, wbackend=wbackend,
                    corp_factory=corp_factory, collator_locale=collator_locale, update_if_exists=update_if_exists)
                created_rt[ans['corpus_id']] = ans['created_rt']
                if not auto_align:
                    aligned[ans['corpus_id']] = ans['aligned']
                id_map[ans['corpus_id']] = ans['corpus_id']

    aligned_ids_map = defaultdict(lambda: [])
    if auto_align:
        ids = set(id_map.values())
        for k in ids:
            aligned_ids_map[k] = list(ids - {k})
    else:
        for id, alig in aligned.items():
            for a in alig:
                try:
                    aligned_ids_map[id].append(id_map[a])
                except KeyError:
                    logging.getLogger(__name__).warning(
                        'Ignored alignment {0} --> {1}'.format(id, a))

    for corpus_id, aligned_ids in list(aligned_ids_map.items()):
        if created_rt.get(corpus_id, False):
            wbackend.save_corpus_alignments(corpus_id, aligned_ids)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Import corpora to KonText with mysql_integration_db from Manatee registry file(s)')
    parser.add_argument(
        'rpath', metavar='REGISTRY_PATH', type=str)
    parser.add_argument(
        '-c', '--conf', metavar='CONF_PATH', type=str,
        help='A custom path to KonText config.xml')
    parser.add_argument(
        '-u', '--update', action='store_true', default=False,
        help='If set then the script will try to update existing records (instead of reporting an error)')
    parser.add_argument(
        '-o', '--collator-locale', metavar='COLLATOR_LOCALE', type=str, default='en_US',
        help='collator locale (e.g. en_US, cs_CZ) applied for one or more processed corpora; default is en_US')
    parser.add_argument(
        '-a', '--variant', metavar='VARIANT', type=str,
        help='A subdirectory containing (restricted) variants of corpora')
    parser.add_argument(
        '-l', '--auto-align', metavar='AUTO_ALIGN', action='store_const', const=True,
        help='Align all the corpus in a directory automatically')
    parser.add_argument(
        '-v', '--verbose', action='store_const', const=True,
        help='Provide more information during processing (especially errors)')
    args = parser.parse_args()
    import manatee
    import initializer
    import settings
    conf_path = args.conf if args.conf else os.path.realpath(
        os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'conf', 'config.xml'))
    settings.load(conf_path, defaultdict(lambda: None))
    initializer.init_plugin('db')
    initializer.init_plugin('integration_db')
    initializer.init_plugin('user_items')
    initializer.init_plugin('corparch')

    db = plugins.runtime.INTEGRATION_DB.instance
    rbackend = Backend(db)
    wbackend = WriteBackend(db, rbackend)

    def corp_factory(reg_path):
        return manatee.Corpus(reg_path)

    if db.is_autocommit:
        logging.getLogger(__name__).info('Detected auto-commit feature. Starting explicit transaction')
    db.start_transaction()
    try:
        if os.path.isdir(args.rpath):
            process_directory(
                dir_path=args.rpath, variant=None, rbackend=rbackend, wbackend=wbackend, auto_align=args.auto_align,
                collator_locale=args.collator_locale, corp_factory=corp_factory, update_if_exists=args.update)
            if args.variant:
                process_directory(
                    dir_path=args.rpath, variant=args.variant, wbackend=wbackend, rbackend=rbackend,
                    auto_align=args.auto_align, collator_locale=args.collator_locale, corp_factory=corp_factory,
                    update_if_exists=args.update)
        else:
            with open(args.rpath) as fr:
                parse_registry(
                    infile=fr, wbackend=wbackend, rbackend=rbackend, variant=args.variant,
                    corp_factory=corp_factory, collator_locale=args.collator_locale,
                    update_if_exists=args.update)
        db.commit()
    except Exception as ex:
        print(ex)
        print('Rolling back database operations')
        db.rollback()
        if args.verbose:
            import traceback
            traceback.print_exc()
