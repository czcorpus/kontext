# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2016 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

import corplib
import logging
from plugins.abstract.general_storage import KeyValueStorage

BASE_KEY = 'ttcache'


class TextTypesCache(object):
    """
    Caches corpus text type information (= available structural attribute values).
    This can be helpful in case of large corpora with rich metadata. In case
    there is no caching directory set values are always loaded directly from
    the corpus.
    """

    def __init__(self, db):
        self._db: KeyValueStorage = db

    @staticmethod
    def _mk_cache_key(corpname):
        return 'ttcache:%s' % (corpname, )

    @staticmethod
    def _mk_attr_cache_key(corpname: str, structname: str, subcnorm: str):
        return f'ttcache:{corpname}:{structname}:{subcnorm}'

    def get_values(self, corp, subcorpattrs, maxlistsize, shrink_list=False, collator_locale=None):
        text_types = self._db.hash_get(BASE_KEY, self._mk_cache_key(corp.corpname))
        if text_types is None:
            text_types = corplib.texttype_values(corp=corp, subcorpattrs=subcorpattrs,
                                                 maxlistsize=maxlistsize, shrink_list=shrink_list,
                                                 collator_locale=collator_locale)
            self._db.hash_set(BASE_KEY, self._mk_cache_key(corp.corpname), text_types)
        return text_types

    def get_attr_values(self, corpname, structname, subcorm):
        ans = self._db.hash_get(BASE_KEY, self._mk_attr_cache_key(corpname, structname, subcorm))
        return ans if ans is not None else {}

    def set_attr_values(self, corpname, structname, subcnorm, data):
        self._db.hash_set(BASE_KEY, self._mk_attr_cache_key(corpname, structname, subcnorm), data)

    def clear(self, corp):
        self._db.hash_del(BASE_KEY, self._mk_cache_key(corp.corpname))

    def clear_all(self):
        logging.getLogger(__name__).warning('Clearing all the ttcache records')
        self._db.remove(BASE_KEY)
