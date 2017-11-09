# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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

import json
import os

import zlib
import time

import lz4 as lz4

import settings
from plugins.default_token_detail import DefaultTokenDetail, init_provider
# -----------
# aux methods
# -----------
from plugins.default_token_detail.cache_man import CacheMan

conf_path = os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../conf/config.xml'))
settings.load(conf_path)

conf = settings.get('plugins', 'token_detail')
if conf:
    with open(conf['default:providers_conf'], 'rb') as fr:
        providers_conf = json.load(fr)
        for b in providers_conf:
            print b

cacheMan = CacheMan()
cacheMan.prepare_cache()
cacheMan.fill_cache()

corparch = None
tok_det = DefaultTokenDetail(dict((b['ident'], init_provider(b)) for b in providers_conf), corparch)

print "--- via default: ---"
cacheMan.list_cached()

tok_det.fetch_data(['wiktionary_for_ic_9_en'], "word", "lemma", "pos", "aligned_corpora", "lang")

cacheMan.list_cached()

# cacheMan.clear_expired()
cacheMan.clear_extra_rows()
cacheMan.list_cached()

print "--- after: ---"
cacheMan.list_cached()

print "--- via default again: ---"
tok_det.fetch_data(['wiktionary_for_ic_9_en'], "word", "lemma", "pos", "aligned_corpora", "lang")
tok_det.fetch_data(['wiktionary_for_ic_9_en'], "word", "position", "pos", "aligned_corpora", "lang")
cacheMan.list_cached()
print cacheMan.get_numrows()

res = cacheMan.get_specific_row("f34f02a9038e9f5ca3bc20e243c62c66")
print res

if res:
    print "length", len(res)
    start_time = time.time()
    compr = zlib.compress(res[0].encode('utf-8'))
    decompr = zlib.decompress(compr)
    print "compress/decompress time: ",time.time()-start_time

    print len(compr)
