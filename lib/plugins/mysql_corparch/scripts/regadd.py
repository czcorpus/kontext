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

import os
import argparse
import sys
import logging
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from plugins.abstract.corparch.registry.parser import Tokenizer, Parser, infer_encoding
from plugins.mysql_corparch.backendw import WritableBackend

logging.basicConfig(format='%(asctime)s %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S',
                    level=logging.INFO)


def parse_registry(infile, variant, backend, encoding):
    logging.getLogger(__name__).info('Parsing file {0}'.format(infile.name))
    corpus_id = os.path.basename(infile.name)
    tokenize = Tokenizer(infile, encoding)
    tokens = tokenize()
    parse = Parser(corpus_id, variant, tokens, backend)
    items = parse()
    return items.save()


def remove_comments(infile):
    ans = []
    for line in infile:
        if not line.strip().startswith('#'):
            ans.append(line)
    return ''.join(ans)


def process_directory(dir_path, variant, backend, auto_align, verbose):
    if variant:
        dir_path = os.path.join(dir_path, variant)
    aligned = {}
    id_map = {}
    created_rt = {}
    for item in os.listdir(dir_path):
        fpath = os.path.join(dir_path, item)
        if os.path.isfile(fpath):
            enc = infer_encoding(fpath)
            with open(fpath) as fr:
                try:
                    ans = parse_registry(fr, variant=variant, backend=backend, encoding=enc)
                    created_rt[ans['corpus_id']] = ans['created_rt']
                    if not auto_align:
                        aligned[ans['corpus_id']] = ans['aligned']
                    id_map[ans['corpus_id']] = ans['corpus_id']
                except Exception as ex:
                    logging.getLogger(__name__).error(ex)
                    if verbose:
                        import traceback
                        traceback.print_exc(ex)
    aligned_ids_map = defaultdict(lambda: [])
    if auto_align:
        ids = set(id_map.values())
        for k in ids:
            aligned_ids_map[k] = list(ids - set([k]))
    else:
        for id, alig in list(aligned.items()):
            for a in alig:
                try:
                    aligned_ids_map[id].append(id_map[a])
                except KeyError:
                    logging.getLogger(__name__).warning(
                        'Ignored alignment {0} --> {1}'.format(id, a))

    for corpus_id, aligned_ids in list(aligned_ids_map.items()):
        if created_rt.get(corpus_id, False):
            backend.save_corpus_alignments(corpus_id, aligned_ids)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Import a Manatee registry file(s)')
    parser.add_argument('rpath', metavar='REGISTRY_PATH', type=str)
    parser.add_argument('dbpath', metavar='DB_PATH', type=str)
    parser.add_argument('-e', '--encoding', metavar='ENCODING', type=str, default=None)
    parser.add_argument('-a', '--variant', metavar='VARIANT', type=str,
                        help='A subdirectory containing (restricted) variants of corpora')
    parser.add_argument('-l', '--auto-align', metavar='AUTO_ALIGN', action='store_const', const=True,
                        help='Align all the corpus in a directory automatically')
    parser.add_argument('-v', '--verbose', action='store_const', const=True,
                        help='Provide more information during processing (especially errors)')
    args = parser.parse_args()
    backend = WritableBackend(args.dbpath)

    if os.path.isdir(args.rpath):
        process_directory(dir_path=args.rpath, variant=None, backend=backend,
                          auto_align=args.auto_align, verbose=args.verbose)
        if args.variant:
            process_directory(dir_path=args.rpath, variant=args.variant, backend=backend,
                              auto_align=args.auto_align, verbose=args.verbose)
    else:
        with open(args.rpath) as fr:
            parse_registry(fr,
                           backend=backend,
                           variant=args.variant,
                           encoding=args.encoding if args.encoding else infer_encoding(args.rpath))
