# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import logging
import json
import argparse
import sys
logger = logging.getLogger('')


def parse_word_line(line: str, pos_idx: int, feat_idx: int):
    """
    parses word line to get POS and features
    """

    line_parts = line.split('\t')
    pos = line_parts[pos_idx]
    feature = line_parts[feat_idx]
    data = [
        tuple(k_v.split('='))
        for k_v in feature.split('|')
        if k_v != '_'  # `_` denotes absence according to Universal Dependencies
    ]
    data.append(('POS', pos))

    # check multiple keys of the same kind
    if len([x[0] for x in data]) > len(set(x[0] for x in data)):
        logger.warning('multiple keys in {}'.format(data))

    # return tuple of tuples (key, value) sorted by key
    return tuple(sorted(data, key=lambda x: x[0]))


def load_variations(src_path, pos_idx: int, feat_idx: int):
    # prepare all variations from vertical data
    variations = set()
    example_shown = False
    with open(src_path, 'r') as fr:
        i = -1
        for line in fr:
            i += 1
            if i % 1000000 == 0:
                logging.getLogger(__name__).info(f'Processed {i} lines')
            if line.strip().startswith('<'):  # skip lines with xml tags
                continue
            parsed = parse_word_line(line, pos_idx, feat_idx)
            if not example_shown:
                logger.info('Parsed example: {}'.format(parsed))
                example_shown = True
            variations.add(parsed)
    return list(variations)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Extract UD key-value properties from a vertical file')
    parser.add_argument('vertical', metavar='VERTICAL', type=str)
    parser.add_argument('output', metavar='OUTPUT', type=str)
    parser.add_argument('-p', '--pos-idx', type=int, default=3,
                        help='A position of the POS attribute')
    parser.add_argument('-f', '--feat-idx', type=int, default=4,
                        help='A position of the FEATURE attribute')
    args = parser.parse_args()

    shandler = logging.StreamHandler(sys.stdout)
    shandler.setFormatter(logging.Formatter(fmt='%(asctime)s %(levelname)s: %(message)s'))
    logger.addHandler(shandler)
    logger.setLevel(logging.INFO)

    logger.info('Loading resource from {}...'.format(args.vertical))
    variations = load_variations(args.vertical, pos_idx=args.pos_idx, feat_idx=args.feat_idx)
    with open(args.output, 'w') as fw:
        json.dump(variations, fw)
    logger.info('...saved to a json file {} ({} items)'.format(args.output, len(variations)))
