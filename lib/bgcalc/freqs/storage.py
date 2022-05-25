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
import logging
import os
import pickle
from functools import wraps

import aiofiles.os
import settings
from bgcalc.freqs.types import FreqCalcArgs, FreqCalcResult


def _cache_file_path(args: FreqCalcArgs):
    v = (str(args.corpname) + str(args.subcname) + str(args.user_id) +
         ''.join(args.q) + str(args.fcrit) + str(args.flimit) + str(args.freq_sort) +
         str(args.ftt_include_empty) + str(args.rel_mode) + str(args.collator_locale))
    filename = '%s.pkl' % hashlib.sha1(v.encode('utf-8')).hexdigest()
    return os.path.join(settings.get('corpora', 'freqs_cache_dir'), filename)


def stored_to_fs(f):
    """
    A decorator for storing freq merge results (as CSV files). Please note that this is not just
    caching but rather an essential part of the query processing. Without this decorator, KonText
    cannot return the result - i.e. the result data must be stored to disk to be readable by a client.
    """
    @wraps(f)
    async def wrapper(args: FreqCalcArgs) -> FreqCalcResult:
        cache_path = _cache_file_path(args)
        if await aiofiles.os.path.exists(cache_path):
            logging.error('loading from cache')
            async with aiofiles.open(cache_path, 'rb') as f:
                data = pickle.loads(await f.read())
        else:
            data = await f(args)
            logging.error('saving to cache')
            async with aiofiles.open(cache_path, 'wb') as f:
                await f.write(pickle.dumps(data))

        return data

        #path = _create_cache_path(pquery)

        # if await aiofiles.os.path.exists(path):
#            async with aiofiles.open(path, 'r') as fr:
 #               csv_reader = aiocsv.AsyncReader(fr)
  #              return [item async for item in csv_reader]
   #     else:
    #        ans = await f(worker, pquery, raw_queries, subcpath, user_id, collator_locale)
     #       num_lines = ans[0][1]
      #      async with aiofiles.open(path, 'w') as fw:
       #         csv_writer = aiocsv.AsyncWriter(fw)
        #        await csv_writer.writerow(('__total__', num_lines))
        #       await csv_writer.writerows(ans[1:])
        #  return ans[1:]

    return wrapper
