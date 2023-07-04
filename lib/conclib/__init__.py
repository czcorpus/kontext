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
from typing import List, Tuple, Union, Optional
from dataclasses import dataclass
from dataclasses_json import dataclass_json

import manatee
import plugins
import settings
from action.argmapping.wordlist import WordlistFormArgs
from bgcalc import wordlist
from corplib.corpus import AbstractKCorpus
from kwiclib.common import tokens2strclass

from .common import KConc


def conc_is_sorted(q: Union[List[str], Tuple[str, ...]]) -> bool:
    ans = True
    for item in q:
        if item[0] in ('r', 'f'):
            ans = False
        elif item[0] in ('s', ):
            ans = True
    return ans


@dataclass
class ConcDescItem:
    op: str
    args: str
    url1: List[Tuple[str, str]]
    url2: List[Tuple[str, str]]
    size: int
    fullsize: int
    opid: str
    nicearg: Optional[List[str]] = None
    conc_persistence_op_id: Optional[str] = None


@dataclass_json
@dataclass
class ConcDescJsonItem:
    op: str
    opid: str
    args: str
    nicearg: str
    tourl: str
    size: int
    fullsize: int
    conc_persistence_op_id: Optional[str] = None


async def get_conc_desc(
        corpus: AbstractKCorpus, q=None, cutoff=0, translate=True, skip_internals=True, translator=lambda x: x):
    """
    arguments:
    corpus -- a KCorpus instance
    q -- tuple/list of query elements
    translate -- if True then all the messages are translated according to the current
                 thread's locale information
    """
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corpus)
    q = tuple(q)

    async def get_size(pos):
        return await cache_map.get_stored_size(corpus.cache_key, q[:pos + 1], cutoff)

    def is_aligned_op(query_items, pos):
        return (query_items[pos].startswith('x-') and query_items[pos + 1] == 'p0 0 1 []' and
                query_items[pos + 2].startswith('x-'))

    async def detect_internal_op(qx, pos):
        if pos > len(qx) - 3 or not skip_internals:
            csize, _ = await get_size(pos)
            return False, csize
        align_end = 0
        for j in range(pos, len(qx) - 2, 3):
            if is_aligned_op(qx, j):
                align_end = j + 2
        csize, _ = await get_size(align_end)
        return align_end > 0, csize

    if q is None:
        q = []

    def _t(s): return translator(s) if translate else lambda s: s

    desctext = {'q': _t('Query'),
                'a': _t('Query'),
                'r': _t('Random sample'),
                's': _t('Sort'),
                'f': _t('Shuffle'),
                'D': translator('Remove nested matches'),
                'F': translator('First hits in'),
                'n': _t('Negative filter'),
                'N': _t('Negative filter (excluding KWIC)'),
                'p': _t('Positive filter'),
                'P': _t('Positive filter (excluding KWIC)'),
                'x': _t('Switch KWIC'),
                }
    desc = []
    i = 0
    while i < len(q):
        is_align_op, size = await detect_internal_op(q, i)
        # in case of aligned corpus (= 3 operations) we update previous
        # user operation and ignore the rest (as it is just an internal operation
        # a common user does not understand).
        if is_align_op:
            last_user_op_idx = i - 1
            while is_align_op:
                if last_user_op_idx >= 0:
                    desc[last_user_op_idx].size = size
                i += 3  # ignore aligned corpus operation, i is now the next valid operation
                is_align_op, size = await detect_internal_op(q, i)
            if i > len(q) - 1:
                break
        size, fsize = await get_size(i)
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
            desc[-1].size = size
        if op:
            desc.append(ConcDescItem(op, args, url1, url2, size, fsize, opid))
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


def get_detail_context(
        corp: AbstractKCorpus, pos, hitlen=1, detail_left_ctx=40, detail_right_ctx=40, attrs=None, structs='',
        detail_ctx_incr=60):
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
    left_kwic_parts = tokens2strclass(cr.region(pos, pos + 1))
    for index, lkp in enumerate(reversed(left_kwic_parts)):
        if region_left[-1 - index]['str'].endswith(lkp['str']):
            region_left[-1 - index]['str'] = region_left[-1 - index]['str'].rsplit(lkp['str'], 1)[0]

    right_kwic_parts = tokens2strclass(cr.region(pos + hitlen - 1, pos + hitlen))
    for index, rkp in enumerate(right_kwic_parts):
        if region_right[index]['str'].startswith(rkp['str']):
            region_right[index]['str'] = region_right[index]['str'].split(rkp['str'], 1)[-1]

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


async def fcs_scan(corpname: str, scan_query: str, max_ter: int, start: int):
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

    if exact_match:
        wlpattern = '^' + value + '$'
    else:
        wlpattern = '.*' + value + '.*'

    args = WordlistFormArgs(wlattr=attr, wlpat=wlpattern, wlsort='f')
    wl = await wordlist.wordlist(corp, args, max_ter)
    return [(d['str'], d['freq']) for d in wl][start:][:max_ter]


def sort_line_groups(conc: KConc, group_ids: List[int]):
    ids = manatee.IntVector()
    strs = manatee.StrVector()
    for g in group_ids:
        ids.append(g)
        strs.append('%05d' % g)
    conc.linegroup_sort(ids, strs)
