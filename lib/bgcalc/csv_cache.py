# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import csv


def load_cached_partial(path, offset, limit):
    with open(path, 'r') as fr:
        csv_reader = csv.reader(fr)
        _, total_str = next(csv_reader)
        for i in range(0, offset):
            next(csv_reader)
        ans = []
        i = offset
        for row in csv_reader:
            if i == offset + limit:
                break
            ans.append((row[0], int(row[1])))
            i += 1
    return int(total_str), ans


def load_cached_full(path):
    ans = []
    with open(path, 'r') as fr:
        csv_reader = csv.reader(fr)
        _, total_str = next(csv_reader)
        for row in csv_reader:
            ans.append((row[0], int(row[1])))
    return int(total_str), ans
