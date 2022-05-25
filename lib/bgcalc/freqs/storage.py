# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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
import json
import os
from functools import wraps

import aiocsv
import aiofiles.os
import settings
from bgcalc.freqs.types import FreqCalcArgs, FreqCalcResult
from conclib.freq import FreqData, FreqItem
from util import anext


def _cache_file_path(args: FreqCalcArgs):
    v = ''.join([
        str(args.corpname),
        str(args.subcname),
        str(args.user_id),
        ''.join(args.q),
        str(args.fcrit),
        str(args.flimit),
        str(args.freq_sort),
        str(args.ftt_include_empty),
        str(args.rel_mode),
        str(args.collator_locale),
    ])
    filename = '{}.csv'.format(hashlib.sha1(v.encode('utf-8')).hexdigest())
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), filename)


def stored_to_fs(func):
    """
    A decorator for storing freq merge results (as CSV files). Please note that this is not just
    caching but rather an essential part of the query processing. Without this decorator, KonText
    cannot return the result - i.e. the result data must be stored to disk to be readable by a client.
    """
    @wraps(func)
    async def wrapper(args: FreqCalcArgs) -> FreqCalcResult:
        cache_path = _cache_file_path(args)

        if await aiofiles.os.path.exists(cache_path):
            async with aiofiles.open(cache_path, 'r') as fr:
                csv_reader = aiocsv.AsyncReader(fr)
                data = FreqCalcResult(freqs=[], conc_size=int((await anext(csv_reader))[0]))
                blocks = int((await anext(csv_reader))[0])

                for _ in range(blocks):
                    head = json.loads((await anext(csv_reader))[0])
                    skipped_empty = bool(int((await anext(csv_reader))[0]))
                    no_rel_sorting = bool(int((await anext(csv_reader))[0]))
                    freq = FreqData(Head=head, Items=[], SkippedEmpty=skipped_empty,
                                    NoRelSorting=no_rel_sorting)
                    total = int((await anext(csv_reader))[0])
                    for _ in range(total):
                        row = await anext(csv_reader)
                        freq.Items.append(FreqItem(json.loads(row[0]), int(
                            row[1]), int(row[2]), float(row[3])))
                    data.freqs.append(freq)

        else:
            data: FreqCalcResult = await func(args)
            async with aiofiles.open(cache_path, 'w') as fw:
                csv_writer = aiocsv.AsyncWriter(fw)
                await csv_writer.writerow((data.conc_size,))
                await csv_writer.writerow((len(data.freqs),))
                for freq in data.freqs:
                    await csv_writer.writerow((json.dumps(freq.Head),))
                    await csv_writer.writerow((1 if freq.SkippedEmpty else 0,))
                    await csv_writer.writerow((1 if freq.NoRelSorting else 0,))
                    await csv_writer.writerow((len(freq.Items),))
                    await csv_writer.writerows((json.dumps(item.Word), item.freq, item.norm, item.rel) for item in freq.Items)

        return data

    return wrapper
