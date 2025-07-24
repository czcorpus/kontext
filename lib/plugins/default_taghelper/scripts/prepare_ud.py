# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

import argparse
import json
import logging
import sys

logger = logging.getLogger('')


def parse_word_line(line: str, pos_idx: int, feat_idx: int):
    """
    parses word line to get POS and features
    """

    line_parts = line.split('\t')
    poses = line_parts[pos_idx].split('|')
    features = line_parts[feat_idx].split('||')
    for pos, feature in zip(poses, features):
        data = [
            tuple(k_v.split('='))
            for k_v in feature.split('|')
            if k_v and k_v != '_'  # `_` denotes absence according to Universal Dependencies
        ]
        data.append(('POS', pos))

        # check multiple keys of the same kind
        if len([x[0] for x in data]) > len(set(x[0] for x in data)):
            logger.warning('multiple keys in {}'.format(data))

        # return tuple of tuples (key, value) sorted by key
        yield tuple(sorted(data, key=lambda x: x[0]))


def load_variations(src_path, pos_idx: int, feat_idx: int):
    # prepare all variations from vertical data
    variations = set()
    example_shown = False
    with open(src_path, 'r') as fr:
        for i, line in enumerate(fr):
            if i % 1000000 == 0:
                logging.getLogger(__name__).info(f'Processed {i} lines')
            if line.strip().startswith('<'):  # skip lines with xml tags
                continue
            for parsed in parse_word_line(line, pos_idx, feat_idx):
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
    parser.add_argument('-p', '--pos-idx', type=int, required=True,
                        help='A position of the POS attribute')
    parser.add_argument('-f', '--feat-idx', type=int, required=True,
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
