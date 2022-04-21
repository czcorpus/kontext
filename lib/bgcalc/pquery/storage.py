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
import os.path
from dataclasses import dataclass
from functools import wraps
from typing import List, Tuple

import aiocsv
import aiofiles
import aiofiles.os
import l10n
import settings
from action.argmapping.pquery import PqueryFormArgs
from bgcalc.adapter.abstract import AbstractBgClient
from bgcalc.csv_cache import load_cached_full, load_cached_partial

from .errors import PqueryArgumentError, PqueryResultNotFound


def _create_cache_path(pquery: PqueryFormArgs) -> str:
    corpname = pquery.corpname
    subcname = pquery.usesubcorp
    attr = pquery.attr
    position = pquery.position
    min_freq = pquery.min_freq
    conc_ids = ':'.join(sorted(pquery.conc_ids))
    subset_cond = ':'.join(
        pquery.conc_subset_complements.conc_ids) if pquery.conc_subset_complements else '-'
    subset_limit = pquery.conc_subset_complements.max_non_matching_ratio if pquery.conc_subset_complements else '-'
    superset_cond = pquery.conc_superset.conc_id if pquery.conc_superset else '-'
    superset_limit = pquery.conc_superset.max_non_matching_ratio if pquery.conc_superset else '-'
    key = (f'{corpname}:{subcname}:{conc_ids}:{position}:{attr}:{min_freq}:{subset_cond}:{subset_limit}:'
           f'{superset_cond}:{superset_limit}')
    result_id = hashlib.sha1(key.encode('utf-8')).hexdigest()
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), f'pquery_{result_id}.csv')


def stored_to_fs(f):
    """
    A decorator for storing freq merge results (as CSV files). Please note that this is not just
    caching but rather an essential part of the query processing. Without this decorator, KonText
    cannot return the result - i.e. the result data must be stored to disk to be readable by a client.
    """
    @wraps(f)
    async def wrapper(worker: AbstractBgClient, pquery: PqueryFormArgs, raw_queries, subcpath, user_id, collator_locale):
        path = _create_cache_path(pquery)

        if await aiofiles.os.path.exists(path):
            async with aiofiles.open(path, 'r') as fr:
                csv_reader = aiocsv.AsyncReader(fr)
                return [item async for item in csv_reader]
        else:
            ans = await f(worker, pquery, raw_queries, subcpath, user_id, collator_locale)
            num_lines = ans[0][1]
            async with aiofiles.open(path, 'w') as fw:
                csv_writer = aiocsv.AsyncWriter(fw)
                await csv_writer.writerow(('__total__', num_lines))
                await csv_writer.writerows(ans[1:])
            return ans[1:]

    return wrapper


@dataclass
class PqueryDataLine:
    value: str
    freqs: List[int]


@dataclass
class PqueryData:
    total: int
    rows: List[PqueryDataLine]


async def require_existing_pquery(pquery: PqueryFormArgs, offset: int, limit: int,
                                  collator_locale: str, sort: str, reverse: bool) -> PqueryData:
    path = _create_cache_path(pquery)
    if not await aiofiles.os.path.exists(path):
        raise PqueryResultNotFound('The result does not exist')
    else:
        if sort == 'freq':
            if reverse is True:
                total, rows = await load_cached_partial(path, offset, limit)
                return PqueryData(
                    total,
                    [PqueryDataLine(row[0], row[1:]) for row in rows]
                )
            else:
                total, rows = await load_cached_full(path)
                return PqueryData(
                    total,
                    [
                        PqueryDataLine(row[0], row[1:])
                        for row in list(reversed(rows))[offset:offset + limit]
                    ]
                )
        elif sort == 'value':
            total, rows = await load_cached_full(path)
            return PqueryData(
                total,
                [
                    PqueryDataLine(row[0], row[1:])
                    for row in l10n.sort(rows, key=lambda x: x[0], loc=collator_locale, reverse=reverse)[offset:offset + limit]
                ]
            )

        elif sort.startswith('freq-'):
            conc_idx = pquery.conc_ids.index(sort[len('freq-'):])
            total, rows = await load_cached_full(path)
            return PqueryData(
                total,
                [
                    PqueryDataLine(row[0], row[1:])
                    for row in sorted(rows, key=lambda x: x[conc_idx + 1], reverse=reverse)[offset:offset + limit]
                ]
            )
        else:
            raise PqueryArgumentError(f'Invalid sort argument: {sort}')
