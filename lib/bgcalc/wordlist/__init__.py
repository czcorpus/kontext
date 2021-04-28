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

from functools import wraps
import hashlib
import os
from typing import List, Dict, Any, Tuple, Optional, Set
from corplib.corpus import KCorpus
from corplib import frq_db
import re
import csv
import sys
import l10n
from argmapping.wordlist import WordlistFormArgs
from manatee import Structure   # TODO wrap this out
from bgcalc.wordlist.errors import WordlistResultNotFound
from corplib.errors import MissingSubCorpFreqFile
from bgcalc.csv_cache import load_cached_partial, load_cached_full
import settings


def _create_cache_path(form: WordlistFormArgs) -> str:
    key = (f'{form.corpname}:{form.usesubcorp}:{form.wlattr}:{form.wlpat}:{form.pfilter_words}:{form.nfilter_words}:'
           f'{form.include_nonwords}:{form.wltype}:{form.wlnums}')
    result_id = hashlib.sha1(key.encode('utf-8')).hexdigest()
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), f'wlist_{result_id}.csv')


def require_existing_wordlist(form: WordlistFormArgs, wlsort: str, reverse: bool, offset: int, limit: int,
                              collator_locale: str) -> Tuple[int, List[Tuple[str, int]]]:
    path = _create_cache_path(form)
    if not os.path.exists(path):
        raise WordlistResultNotFound('The result does not exist')
    else:
        if wlsort == 'f':
            total, rows = load_cached_full(path)
            return (total,
                    sorted(rows, key=lambda x: x[1], reverse=reverse)[offset:offset + limit])
        else:
            if reverse is True:
                return load_cached_partial(path, offset, limit)
            else:
                total, rows = load_cached_full(path)
                return total, list(reversed(rows))[offset:offset + limit]


def cached(f):
    """
    A decorator for caching freq merge results (using "pickle" serialization)
    """
    @wraps(f)
    def wrapper(corp: KCorpus, args: WordlistFormArgs, max_items: int):
        path = _create_cache_path(args)

        if os.path.exists(path):
            with open(path, 'r') as fr:
                csv_reader = csv.reader(fr)
                return [item for item in csv_reader]
        else:
            ans = f(corp, args, sys.maxsize)
            num_lines = len(ans)
            with open(path, 'w') as fw:
                csv_writer = csv.writer(fw)
                csv_writer.writerow(('__total__', num_lines))
                csv_writer.writerows(ans[1:])
            return ans[1:max_items]

    return wrapper


def _wordlist_from_list(attr, attrfreq, pfilter_words, nfilter_words, wlminfreq, wlnums):
    items = []
    for word in pfilter_words:
        id = attr.str2id(word)
        if id == -1:
            frq = 0
        else:
            frq = attrfreq[id]
        if word and frq >= wlminfreq and (not nfilter_words or word not in nfilter_words):
            if wlnums == 'arf':
                items.append((word, round(frq, 1)))
            else:
                items.append((word, frq))
    return items


def _wordlist_by_pattern(attr, attrfreq, enc_pattern, excl_pattern, wlminfreq, pfilter_words, nfilter_words,
                         wlnums):
    try:
        gen = attr.regexp2ids(enc_pattern, 0, excl_pattern)
    except TypeError:
        gen = attr.regexp2ids(enc_pattern, 0)
    items = []
    while not gen.end():
        wid = gen.next()
        frq = attrfreq[wid]
        if not frq:
            continue
        id_value = attr.id2str(wid)
        if frq >= wlminfreq and (not pfilter_words or id_value in pfilter_words) and (not nfilter_words or id_value not in nfilter_words):
            if wlnums == 'arf':
                items.append((id_value, round(frq, 1)))
            else:
                items.append((id_value, frq))
    return items


def doc_sizes(corp: KCorpus, struct: Structure, attrname: str, i: int, normvals: Dict[int, int]) -> int:
    r = corp.filter_query(struct.attr_val(attrname.split('.')[1], i))
    cnt = 0
    while not r.end():
        cnt += normvals[r.peek_beg()]
        r.next()
    return cnt


def _get_attrfreq(corp: KCorpus, attr, wlattr, wlnums):
    if '.' in wlattr:  # attribute of a structure
        struct = corp.get_struct(wlattr.split('.')[0])
        if wlnums == 'doc sizes':
            normvals = dict([(struct.beg(i), struct.end(i) - struct.beg(i))
                             for i in range(struct.size())])
        else:
            normvals = dict([(struct.beg(i), 1) for i in range(struct.size())])
        attrfreq = dict([(i, doc_sizes(corp, struct, wlattr, i, normvals))
                         for i in range(attr.id_range())])
    else:  # positional attribute
        attrfreq = frq_db(corp, wlattr, wlnums)
    return attrfreq


@cached
def wordlist(corp: KCorpus, args: WordlistFormArgs, max_items: int) -> List[Tuple[str, int]]:
    """
    Note: 'pfilter_words' and 'nfilter_words' are expected to contain utf-8-encoded strings.
    """
    attr = corp.get_attr(args.wlattr)
    attrfreq = _get_attrfreq(corp=corp, attr=attr, wlattr=args.wlattr, wlnums=args.wlnums)
    if args.pfilter_words and args.wlpat == '.*':  # word list just for given words
        items = _wordlist_from_list(attr=attr, attrfreq=attrfreq, pfilter_words=args.pfilter_words,
                                    nfilter_words=args.nfilter_words, wlminfreq=args.wlminfreq,
                                    wlnums=args.wlnums)
    else:  # word list according to pattern
        if not args.include_nonwords:
            nwre = corp.get_conf('NONWORDRE')
        else:
            nwre = ''
        items = _wordlist_by_pattern(attr=attr, enc_pattern=args.wlpat.strip(), excl_pattern=nwre,
                                     wlminfreq=args.wlminfreq, pfilter_words=args.pfilter_words,
                                     nfilter_words=args.nfilter_words, wlnums=args.wlnums,
                                     attrfreq=attrfreq)
    del items[max_items:]
    return items


def make_wl_query(self, wlattr: str, wlpat: str, include_nonwords, pfilter_words, nfilter_words,
                  non_word_re: str = ''):
    qparts = []
    if self.args.wlpat:
        qparts.append(f'{wlattr}="{wlpat}"')
    if not include_nonwords:
        qparts.append(f'{wlattr}!="{non_word_re}"')
    pfilter_words = [w for w in re.split('\s+', pfilter_words.strip()) if w]
    nfilter_words = [w for w in re.split('\s+', nfilter_words.strip()) if w]
    if len(pfilter_words) > 0:
        qq = [f'{wlattr}=="{w.strip()}"' for w in pfilter_words]
        qparts.append('(' + '|'.join(qq) + ')')
    for w in nfilter_words:
        qparts.append(f'{wlattr}!=="{w.strip()}"')
    return ['q[' + '&'.join(qparts) + ']']
