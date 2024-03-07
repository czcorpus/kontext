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

import hashlib
import os
import sys
from functools import wraps
from typing import Dict, List, Tuple

import aiofiles
import aiofiles.os
import l10n
import settings
import ujson as json
from action.argmapping.wordlist import WordlistFormArgs
from bgcalc.jsonl_cache import load_cached_full, load_cached_partial
from bgcalc.wordlist.errors import WordlistResultNotFound
from corplib import frq_db
from corplib.corpus import AbstractKCorpus
from manatee import Structure  # TODO wrap this out
from util import AsyncBatchWriter


def _cache_dir_path(form: WordlistFormArgs) -> str:
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), form.corpname)


def _create_cache_path(form: WordlistFormArgs) -> str:
    key = (f'{form.corpname}:{form.usesubcorp}:{form.wlattr}:{form.wlpat}:{form.pfilter_words}:{form.nfilter_words}:'
           f'{form.include_nonwords}:{form.wltype}:{form.wlnums}:{form.wlminfreq}')
    result_id = hashlib.sha1(key.encode('utf-8')).hexdigest()
    return os.path.join(_cache_dir_path(form), f'wlist_{result_id}.jsonl')


async def require_existing_wordlist(
        form: WordlistFormArgs, wlsort: str, reverse: bool, offset: int, limit: int,
        collator_locale: str) -> Tuple[int, List[Tuple[str, int]]]:
    path = _create_cache_path(form)
    if not await aiofiles.os.path.exists(path):
        raise WordlistResultNotFound('The result does not exist')
    else:
        if wlsort == 'f':
            if reverse:
                return load_cached_partial(path, offset, limit)
            else:
                total, rows = load_cached_full(path)
                return (
                    total,
                    sorted(rows, key=lambda x: x[1], reverse=reverse)[offset:offset + limit]
                )
        else:
            total, rows = load_cached_full(path)
            rows = l10n.sort(rows, key=lambda x: x[0], loc=collator_locale, reverse=reverse)
            return total, rows[offset:offset + limit]


def cached(f):
    """
    A decorator for caching wordlist to a CSV file
    """
    @wraps(f)
    async def wrapper(corp: AbstractKCorpus, args: WordlistFormArgs, max_items: int):
        path = _create_cache_path(args)

        if await aiofiles.os.path.exists(path):
            with open(path, 'r') as fr:
                fr.readline()
                return [json.loads(item) for item in fr]
        else:
            cache_dir = _cache_dir_path(args)
            if not await aiofiles.os.path.isdir(cache_dir):
                await aiofiles.os.makedirs(cache_dir)
                os.chmod(cache_dir, 0o775)

            ans = await f(corp, args, sys.maxsize)
            ans = sorted(ans, key=lambda x: x[1], reverse=True)
            num_lines = len(ans)
            async with AsyncBatchWriter(path, 'w', 100) as bw:
                await bw.write(json.dumps(dict(total=num_lines)) + '\n')
                for item in ans:
                    await bw.write(json.dumps(item) + '\n')
            return ans[:max_items]

    return wrapper


def _wordlist_from_list(attr, attrfreq, pfilter_words: List[str], nfilter_words: List[str], wlminfreq, wlnums):
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


def wordlist_by_pattern(
        attr, attrfreq, enc_pattern, excl_pattern, wlminfreq, pfilter_words, nfilter_words, wlnums):
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


def doc_sizes(corp: AbstractKCorpus, struct: Structure, attrname: str, i: int, normvals: Dict[int, int]) -> int:
    r = corp.filter_query(struct.attr_val(attrname.split('.')[1], i))
    cnt = 0
    while not r.end():
        cnt += normvals[r.peek_beg()]
        r.next()
    return cnt


async def get_attrfreq(corp: AbstractKCorpus, attr, wlattr, wlnums):
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
        attrfreq = await frq_db(corp, wlattr, wlnums)
    return attrfreq


@cached
async def wordlist(corp: AbstractKCorpus, args: WordlistFormArgs, max_items: int) -> List[Tuple[str, int]]:
    """
    Note: 'pfilter_words' and 'nfilter_words' are expected to contain utf-8-encoded strings.
    """
    attr = corp.get_attr(args.wlattr)
    attrfreq = await get_attrfreq(corp=corp, attr=attr, wlattr=args.wlattr, wlnums=args.wlnums)
    if args.pfilter_words and args.wlpat in ('.*', '.+', ''):  # word list just for given words
        items = _wordlist_from_list(
            attr=attr, attrfreq=attrfreq, pfilter_words=args.pfilter_words,
            nfilter_words=args.nfilter_words, wlminfreq=args.wlminfreq, wlnums=args.wlnums)
    else:  # word list according to pattern
        if not args.include_nonwords:
            nwre = corp.get_conf('NONWORDRE')
        else:
            nwre = ''
        items = wordlist_by_pattern(
            attr=attr, enc_pattern=args.wlpat.strip(), excl_pattern=nwre,
            wlminfreq=args.wlminfreq, pfilter_words=args.pfilter_words,
            nfilter_words=args.nfilter_words, wlnums=args.wlnums, attrfreq=attrfreq)
    return items[:max_items]


def make_wl_query(
        wlattr: str, wlpat: str, include_nonwords, pfilter_words, nfilter_words,
        non_word_re: str = ''):
    qparts = []
    if wlpat:
        qparts.append(f'{wlattr}="{wlpat}"')
    if not include_nonwords:
        qparts.append(f'{wlattr}!="{non_word_re}"')
    if len(pfilter_words) > 0:
        qq = [f'{wlattr}=="{w.strip()}"' for w in pfilter_words]
        qparts.append('(' + '|'.join(qq) + ')')
    for w in nfilter_words:
        qparts.append(f'{wlattr}!=="{w.strip()}"')
    return ['q[' + '&'.join(qparts) + ']']
