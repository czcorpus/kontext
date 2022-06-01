# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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


import sys
import sqlite3

def cartesian_product(prev_vals, next_vals):
    """
    Create cartesian product of list of tuples with list of values:
    [(a1, a2, a3), (b1, b2, b3)] with [c1, c2] produces:
    [(a1, a2, a3, c1), (a1, a2, a3, c2), (b1, b2, b3, c1), (b1, b2, b3, c2)]
    In case prev_vals is empty then it converts the next_vals list
    to list of 1-size tuples (e.g. [a, b, c] becomes [(a,), (b,), (c,)])
    """
    ans = []
    if len(prev_vals) == 0:
        return [(x, ) for x in next_vals]
    for v1_tuple in prev_vals:
        for v2 in next_vals:
            ans.append((*v1_tuple, v2))
    return ans

def process_row(db, row, attrs):
    mv_mapping = {}
    for attr in attrs:
        mv_mapping[attr] = row[attr].split('|')
    wv = []
    items = list(mv_mapping.items())
    keys = []
    for mv_k, mv_vals in items:
        wv = cartesian_product(wv, mv_vals)
        keys.append(mv_k)
    for new_item in wv:
        new_row = dict(row)
        for i in range(len(keys)):
            new_row[keys[i]] = new_item[i]
        print('NEW ROW: {}'.format(new_row))
        del (new_row['id'])
        ins_items = list(new_row.items())
        db.execute('INSERT INTO item_new ({}) VALUES ({})'.format(','.join([k for k,_ in ins_items]), ', '.join('?' * len(ins_items))), [v for _,v in ins_items])



def process_db(path, attrs):
    with sqlite3.connect(path) as db:
        db.row_factory = sqlite3.Row
        db.execute('DROP TABLE IF EXISTS item_new')
        db.execute('CREATE TABLE item_new AS SELECT * FROM item WHERE 0')
        print('attrs: {}'.format(attrs))
        rows = db.execute('SELECT * FROM item')
        for row in rows:
            process_row(db, row, attrs)


def get_mv_attrs():
    i = 2
    ans = []
    while i < len(sys.argv):
        ans.append(sys.argv[i])
        i += 1
    return ans

if __name__ == '__main__':
    print('Transform pipe-separated multi-values of specified attributes into individual records.')
    process_db(sys.argv[1], get_mv_attrs())

