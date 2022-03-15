# Copyright (c) 2003-2014  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright (c) 2014 Institute of the Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import sys
from typing import Tuple, List

import manatee
import settings
from kwiclib_common import tokens2strclass
import plugins
from corplib.corpus import KCorpus, AbstractKCorpus

from .common import KConc


def conc_is_sorted(q: Tuple[str, ...]) -> bool:
    ans = True
    for item in q:
        if item[0] in ('r', 'f'):
            ans = False
        elif item[0] in ('s', ):
            ans = True
    return ans


def get_conc_desc(corpus: AbstractKCorpus, q=None, translate=True, skip_internals=True, translator=lambda x: x):
    """
    arguments:
    corpus -- a KCorpus instance
    q -- tuple/list of query elements
    translate -- if True then all the messages are translated according to the current
                 thread's locale information
    """
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corpus)
    q = tuple(q)

    def get_size(pos):
        return cache_map.get_stored_size(corpus.subchash, q[:pos + 1])

    def is_aligned_op(query_items, pos):
        return (query_items[pos].startswith('x-') and query_items[pos + 1] == 'p0 0 1 []' and
                query_items[pos + 2].startswith('x-'))

    def detect_internal_op(qx, pos):
        if pos > len(qx) - 3 or not skip_internals:
            return False, get_size(pos)
        align_end = 0
        for j in range(pos, len(qx) - 2, 3):
            if is_aligned_op(qx, j):
                align_end = j + 2
        return align_end > 0, get_size(align_end)

    if q is None:
        q = []

    def _t(s): return translator(s) if translate else lambda s: s

    desctext = {'q': _t('Query'),
                'a': _t('Query'),
                'r': _t('Random sample'),
                's': _t('Sort'),
                'f': _t('Shuffle'),
                'D': translator('Remove nested matches'),
                'F': translator('First hits in documents'),
                'n': _t('Negative filter'),
                'N': _t('Negative filter (excluding KWIC)'),
                'p': _t('Positive filter'),
                'P': _t('Positive filter (excluding KWIC)'),
                'x': _t('Switch KWIC'),
                }
    desc = []
    i = 0
    while i < len(q):
        is_align_op, size = detect_internal_op(q, i)
        # in case of aligned corpus (= 3 operations) we update previous
        # user operation and ignore the rest (as it is just an internal operation
        # a common user does not understand).
        if is_align_op:
            last_user_op_idx = i - 1
            while is_align_op:
                if last_user_op_idx >= 0:
                    tmp = desc[last_user_op_idx]
                    desc[last_user_op_idx] = tmp[:4] + (size,) + tmp[-1:]
                i += 3  # ignore aligned corpus operation, i is now the next valid operation
                is_align_op, size = detect_internal_op(q, i)
            if i > len(q) - 1:
                break
        size = get_size(i)
        opid = q[i][0]
        args = q[i][1:]
        url1 = [('q', qi) for qi in q[:i]]
        url2 = [('q', qi) for qi in q[:i + 1]]
        op = desctext.get(opid)

        if opid == 's' and args[0] != '*' and i > 0:
            sortopt = {'-1<0': 'left context',
                       '0<0~': 'node',
                       '1>0~': 'right context'}
            sortattrs = args.split()
            if len(sortattrs) > 2:
                op = 'Multilevel Sort'
            args = '%s in %s' % (sortattrs[0].split('/')[0],
                                 sortopt.get(sortattrs[1][:4], sortattrs[1]))
            url1.append(('skey', {'-1': 'lc', '0<': 'kw', '1>': 'rc'}.get(sortattrs[1][:2], '')))
        elif opid == 'f':
            size = ''
            args = translator('enabled')
        elif opid == 'X':  # aligned corpora changes (<= orig_size) total size
            desc[-1] = desc[-1][:4] + (size,) + desc[-1][5:]
        if op:
            desc.append((op, args, url1, url2, size, opid))
        i += 1
    return desc


def get_full_ref(corp, pos, translator=lambda x: x):
    data = {}
    refs = [(n == '#' and ('#', str(pos)) or
             (n, corp.get_attr(n).pos2str(pos)))
            for n in corp.get_conf('FULLREF').split(',') if n != settings.get('corpora', 'speech_segment_struct_attr')]
    data['Refs'] = [{'name': n == '#' and translator('Token number') or corp.get_conf(f'{n}.LABEL') or n,
                     'val': v} for n, v in refs]
    for n, v in refs:
        data[n.replace('.', '_')] = v
    return data


def get_detail_context(corp: KCorpus, pos, hitlen=1, detail_left_ctx=40, detail_right_ctx=40,
                       attrs=None, structs='', detail_ctx_incr=60):
    data = {}
    wrapdetail = corp.get_conf('WRAPDETAIL')
    if wrapdetail:
        data['wrapdetail'] = '<%s>' % wrapdetail
        if not wrapdetail in structs.split(','):
            data['deletewrap'] = True
        structs = wrapdetail + ',' + structs
    else:
        data['wrapdetail'] = ''
    try:
        maxdetail = int(corp.get_conf('MAXDETAIL'))
        if maxdetail == 0:
            maxdetail = int(corp.get_conf('MAXCONTEXT'))
            if maxdetail == 0:
                maxdetail = sys.maxsize
    except:
        maxdetail = 0
    if maxdetail:
        if detail_left_ctx > maxdetail:
            detail_left_ctx = maxdetail
        if detail_right_ctx > maxdetail:
            detail_right_ctx = maxdetail
    if detail_left_ctx > pos:
        detail_left_ctx = pos
    query_attrs = 'word' if attrs is None else ','.join(attrs)

    # we get left and right overlapping regions with kwic region to get also structures between regions
    cr = manatee.CorpRegion(corp.unwrap(), query_attrs, structs)
    region_left = tokens2strclass(cr.region(pos - detail_left_ctx, pos + 1))
    region_kwic = tokens2strclass(cr.region(pos, pos + hitlen))
    region_right = tokens2strclass(cr.region(pos + hitlen - 1, pos + hitlen + detail_right_ctx))
    for seg in region_left + region_kwic + region_right:
        seg['str'] = seg['str'].replace('===NONE===', '')

    # here we subtract kwic region from left and right regions...
    left_kwic_part = tokens2strclass(cr.region(pos, pos + 1))[0]['str']
    if region_left[-1]['str'].endswith(left_kwic_part):
        region_left[-1]['str'] = region_left[-1]['str'].rsplit(left_kwic_part, 1)[0]
    right_kwic_part = tokens2strclass(cr.region(pos + hitlen - 1, pos + hitlen))[0]['str']
    if region_right[0]['str'].startswith(right_kwic_part):
        region_right[0]['str'] = region_right[0]['str'].split(right_kwic_part, 1)[1]

    # ...and remove empty strings
    region_left = [v for v in region_left if v['str']]
    region_right = [v for v in region_right if v['str']]

    for seg in region_kwic:
        if not seg['class']:
            seg['class'] = 'coll'
    data['content'] = region_left + region_kwic + region_right
    refbase = [('pos', pos)]
    if hitlen != 1:
        refbase.append(('hitlen', hitlen))
    data['expand_left_args'] = dict(refbase + [('detail_left_ctx', detail_left_ctx + detail_ctx_incr),
                                               ('detail_right_ctx', detail_right_ctx)])
    data['expand_right_args'] = dict(refbase + [('detail_left_ctx', detail_left_ctx),
                                                ('detail_right_ctx', detail_right_ctx + detail_ctx_incr)])
    data['righttoleft'] = corp.get_conf('RIGHTTOLEFT')
    data['pos'] = pos
    data['maxdetail'] = maxdetail
    return data


def fcs_scan(corpname, scan_query, max_ter, start):
    """
    aux function for federated content search: operation=scan
    """
    if not scan_query:
        raise Exception(7, 'scan_query', 'Mandatory parameter not supplied')
    query = scan_query.replace('+', ' ')  # convert URL spaces
    exact_match = False
    if 'exact' in query.lower() and not '=' in query:  # lemma ExacT "dog"
        pos = query.lower().index('exact')  # first occurence of EXACT
        query = query[:pos] + '=' + query[pos + 5:]  # 1st exact > =
        exact_match = True
    corp = manatee.Corpus(corpname)
    attrs = corp.get_conf('ATTRLIST').split(',')  # list of available attrs
    try:
        if '=' in query:
            attr, value = query.split('=')
            attr = attr.strip()
            value = value.strip()
        else:  # must be in format attr = value
            raise Exception
        if '"' in attr:
            raise Exception
        if '"' in value:
            if value[0] == '"' and value[-1] == '"':
                value = value[1:-1].strip()
            else:
                raise Exception
    except Exception:
        raise Exception(10, scan_query, 'Query syntax error')
    if attr not in attrs:
        raise Exception(16, attr, 'Unsupported index')
    import corplib
    if exact_match:
        wlpattern = '^' + value + '$'
    else:
        wlpattern = '.*' + value + '.*'
    wl = corplib.wordlist(corp, wlattr=attr, wlpat=wlpattern, wlsort='f')
    return [(d['str'], d['freq']) for d in wl][start:][:max_ter]


def sort_line_groups(conc: KConc, group_ids: List[int]):
    ids = manatee.IntVector()
    strs = manatee.StrVector()
    for g in group_ids:
        ids.append(g)
        strs.append('%05d' % g)
    conc.linegroup_sort(ids, strs)
