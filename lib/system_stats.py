#! /usr/bin/env python
# Copyright (c) 2013 Institute of the Czech National Corpus
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

import re
import json
import sys
import datetime


def update_count(d, key):
    if not key in d:
        d[key] = 1
    else:
        d[key] += 1


def analyze_line(line, stats):
    update_count(stats['date_counts'], line['date'].split(' ')[0])
    update_count(stats['user_counts'], line['user'])
    if 'corpname' in line['params']:
        update_count(stats['corpora_counts'], line['params']['corpname'])
    if 'queryselector' in line['params']:
        update_count(stats['query_type_counts'], line['params']['queryselector'])


def format_stats_item(name, data, minv, maxv):
    s = "\n\n%s\n%s\n" % (name, ''.join(['-' for i in range(len(name))]))
    for k in sorted(data.keys()):
        per_item = maxv / 40.0
        s += ''.join(['#' for i in range(int(round(data[k] / per_item)))])
        s += ' | %s: %s\n' % (k, data[k])
    return s


def format_stats(stats):
    ans = ''
    for label, data in stats.items():
        min_v, max_v = get_max_min(data)
        ans += format_stats_item(label, data, min_v, max_v)
    return ans


def get_max_min(values):
    """
    Returns
    -------
    tuple of (min, max) values
    """
    max_val = 0
    min_val = sys.maxint

    for lab, v in values:
        max_val = max(v, max_val)
        min_val = min(v, min_val)
    return min_val, max_val


def load(path, from_date, to_date, min_occur):
    f = open(path, 'r')
    stats = {
        'date_counts': {},
        'user_counts': {},
        'corpora_counts': {},
        'query_type_counts': {}
    }
    if from_date:
        from_date = datetime.datetime.strptime(from_date, '%Y-%m-%d')
    if to_date:
        to_date = datetime.datetime.strptime(to_date, '%Y-%m-%d')
    if not min_occur:
        min_occur = 0
    else:
        min_occur = int(min_occur)
    for line in f:
        q_ans = re.search(r'^.+\[QUERY\]\s+INFO:\s*(.+)$', line)
        if q_ans is not None:
            d = json.loads(q_ans.groups()[0])
            if 'date' in d:
                item_date = datetime.datetime.strptime(d['date'].split(' ')[0], '%Y-%m-%d')
                if (not from_date or item_date >= from_date) and (not to_date or item_date <= to_date):
                    analyze_line(d, stats)

    out = {}
    for section, data in stats.items():
        out[section] = sorted([(k2, v2) for k2, v2 in data.items() if v2 >= min_occur], key=lambda x: x[0])

    return out
