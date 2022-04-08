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

import argparse
import asyncio
import logging
import os
import sys
from collections import defaultdict
from typing import Callable, Optional, Tuple

import aiofiles
import aiofiles.os
from aiofiles.threadpool.text import AsyncTextIOWrapper

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
import plugins
from plugin_types.corparch.install import InstallJson
from plugin_types.corparch.registry.parser import Parser, RegistryConf
from plugin_types.corparch.registry.tokenizer import Tokenizer
from plugins.mysql_corparch.backendw import Backend, WriteBackend

logging.basicConfig(
    format='%(asctime)s %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=logging.INFO)


async def parse_registry(infile: AsyncTextIOWrapper, variant: str, wbackend: WriteBackend) -> Tuple[str, RegistryConf]:
    logging.getLogger(__name__).info(f'Parsing file {infile.name}')
    corpus_id = os.path.basename(infile.name)
    tokenize = Tokenizer(infile)
    tokens = await tokenize()
    parse = Parser(corpus_id, variant, tokens, wbackend)
    return corpus_id, parse()


async def compare_registry_and_db(infile: AsyncTextIOWrapper, variant: str, rbackend: Backend, wbackend: WriteBackend):
    """
    Perform basic comparison of defined posattrs and structattrs
    """
    corpus_id, registry_conf = await parse_registry(infile, variant, wbackend)
    # posattrs
    async with rbackend.cursor() as cursor:
        reg_pos = set(x.name for x in registry_conf.posattrs)
        db_pos = set(x['name'] for x in await rbackend.load_corpus_posattrs(cursor, corpus_id))
        if len(reg_pos - db_pos) > 0:
            print('Configuration inconsistency detected:')
            print(f'\t registry has extra pos. attribute(s): {(reg_pos - db_pos)}')
        elif len(db_pos - reg_pos) > 0:
            print('Configuration inconsistency detected:')
            print(f'\t database has extra pos. attribute(s): {(db_pos - reg_pos)}')
        # structs
        reg_struct = set(x.name for x in registry_conf.structs)
        db_struct = set(x['name'] for x in await rbackend.load_corpus_structures(cursor, corpus_id))
        if len(reg_struct - db_struct) > 0:
            print('Configuration inconsistency detected:')
            print(f'\t registry has extra structure(s): {(reg_struct - db_struct)}')
        elif len(db_struct - reg_struct) > 0:
            print('Configuration inconsistency detected:')
            print(f'\t database has extra structure(s): {(db_struct - reg_struct)}')
        # structattrs
        reg_sattr = set(
            f'{struct.name}.{x.name}' for struct in registry_conf.structs for x in struct.attributes)
        db_sattr = set(f'{struct}.{x["name"]}' for struct in db_struct for x in await rbackend.load_corpus_structattrs(
            cursor, corpus_id, struct))
        if len(reg_sattr - db_sattr) > 0:
            print('Configuration inconsistency detected:')
            print(f'\t registry has extra structural attribute(s): {(reg_sattr - db_sattr)}')
        elif len(db_sattr - reg_sattr) > 0:
            print('Configuration inconsistency detected:')
            print(f'\t database has extra structural attribute(s):: {(db_sattr - reg_sattr)}')


async def compare_registry_dir_and_db(dir_path: str, variant: str, rbackend: Backend, wbackend: WriteBackend):
    for item in os.listdir(dir_path):
        fpath = os.path.join(dir_path, item)
        async with aiofiles.open(fpath) as fr:
            await compare_registry_and_db(fr, variant, rbackend, wbackend)


async def parse_registry_and_import(
        infile: AsyncTextIOWrapper, collator_locale: str, variant: str, rbackend: Backend,
        wbackend: WriteBackend, corp_factory: Callable, update_if_exists: bool):
    corpus_id, registry_conf = await parse_registry(infile, variant, wbackend)
    iconf = InstallJson(ident=corpus_id, collator_locale=collator_locale)
    try:
        corp = corp_factory(infile.name)
        csize = corp.size()
    except Exception as ex:
        print('WARNING: {}'.format(ex))
        csize = 0
    async with rbackend.cursor() as cursor:
        tst = await rbackend.load_corpus(cursor, corpus_id)
        if tst is None:
            await wbackend.save_corpus_config(cursor, iconf, registry_conf, csize)
        elif update_if_exists:
            logging.getLogger(__file__).warning(
                f'Corpus {corpus_id} already in database - registry-related data will be updated based '
                'on the provided registry file')
            await wbackend.update_corpus_config(cursor, iconf, registry_conf, csize)
        else:
            raise Exception(
                f'Corpus {corpus_id} already in database - use the "-u" option to update registry-based data')
        return await registry_conf.save()


def remove_comments(infile):
    ans = []
    for line in infile:
        if not line.strip().startswith('#'):
            ans.append(line)
    return ''.join(ans)


async def process_directory(
        dir_path: str, variant: Optional[str], rbackend: Backend, wbackend: WriteBackend,
        corp_factory: Callable, collator_locale: str, auto_align: bool, update_if_exists: bool):
    if variant:
        dir_path = os.path.join(dir_path, variant)
    aligned = {}
    id_map = {}
    created_rt = {}
    for item in os.listdir(dir_path):
        fpath = os.path.join(dir_path, item)
        if await aiofiles.os.path.isfile(fpath):
            try:
                async with aiofiles.open(fpath) as fr:
                    ans = await parse_registry_and_import(
                        infile=fr, variant=variant, rbackend=rbackend, wbackend=wbackend,
                        corp_factory=corp_factory, collator_locale=collator_locale, update_if_exists=update_if_exists)
                    created_rt[ans['corpus_id']] = ans['created_rt']
                    if not auto_align:
                        aligned[ans['corpus_id']] = ans['aligned']
                    id_map[ans['corpus_id']] = ans['corpus_id']
            except Exception as ex:
                print(f'Failed to process corpus {item} due to: {ex}')

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
    async with wbackend.cursor() as cursor:
        for corpus_id, aligned_ids in list(aligned_ids_map.items()):
            if created_rt.get(corpus_id, False):
                await wbackend.save_corpus_alignments(cursor, corpus_id, aligned_ids)


async def main():
    parser = argparse.ArgumentParser(
        description='Import corpora to KonText with mysql_integration_db from Manatee registry file(s)')
    parser.add_argument(
        'action', metavar='ACTION', type=str, help='Action to be performed ("import", "compare")')
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
    parser.add_argument(
        '-k', '--ucnk', action='store_const', const=True,
        help='Customize the script for use with UCNK (CNC) database')

    args = parser.parse_args()
    import manatee
    import settings
    from action.plugin import initializer
    conf_path = args.conf if args.conf else os.path.realpath(
        os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'conf', 'config.xml'))
    settings.load(conf_path, defaultdict(lambda: None))
    initializer.init_plugin('db')
    initializer.init_plugin('integration_db')
    initializer.init_plugin('user_items')
    initializer.init_plugin('corparch')

    db = plugins.runtime.INTEGRATION_DB.instance
    if args.ucnk:
        rbackend = Backend(
            db, user_table='user', corp_table='corpora', group_acc_table='relation',
            user_acc_table='user_corpus_relation', user_acc_corp_attr='corpus_id', group_acc_corp_attr='corpora',
            group_acc_group_attr='corplist')
        wbackend = WriteBackend(
            db, rbackend, user_table='user', corp_table='corpora', group_acc_table='relation',
            user_acc_table='user_corpus_relation', user_acc_corp_attr='corpus_id', group_acc_corp_attr='corpora',
            group_acc_group_attr='corplist')
    else:
        rbackend = Backend(db)
        wbackend = WriteBackend(db, rbackend)

    def corp_factory(reg_path):
        return manatee.Corpus(reg_path)

    if db.is_autocommit:
        logging.getLogger(__name__).info(
            'Detected auto-commit feature. Starting explicit transaction')
    async with db.connection() as conn:
        await conn.begin()
        try:
            if args.action == 'import':
                if await aiofiles.os.path.isdir(args.rpath):
                    await process_directory(
                        dir_path=args.rpath, variant=None, rbackend=rbackend, wbackend=wbackend, auto_align=args.auto_align,
                        collator_locale=args.collator_locale, corp_factory=corp_factory, update_if_exists=args.update)
                    if args.variant:
                        await process_directory(
                            dir_path=args.rpath, variant=args.variant, wbackend=wbackend, rbackend=rbackend,
                            auto_align=args.auto_align, collator_locale=args.collator_locale, corp_factory=corp_factory,
                            update_if_exists=args.update)
                else:
                    async with aiofiles.open(args.rpath) as fr:
                        await parse_registry_and_import(
                            infile=fr, wbackend=wbackend, rbackend=rbackend, variant=args.variant,
                            corp_factory=corp_factory, collator_locale=args.collator_locale,
                            update_if_exists=args.update)
            elif args.action == 'compare':
                print('About to compare registry with respective database records...')
                if await aiofiles.os.path.isdir(args.rpath):
                    await compare_registry_dir_and_db(args.rpath, args.variant, rbackend, wbackend)
                else:
                    async with aiofiles.open(args.rpath) as fr:
                        await compare_registry_and_db(fr, args.variant, rbackend, wbackend)
            else:
                await conn.rollback()
                print(f'Invalid action {args.action}')
                sys.exit(1)
            await conn.commit()
        except Exception as ex:
            print(ex)
            print('Rolling back database operations')
            await conn.rollback()
            if args.verbose:
                import traceback
                traceback.print_exc()


if __name__ == '__main__':
    asyncio.run(main())
