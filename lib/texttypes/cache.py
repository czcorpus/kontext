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


class TextTypesCache(object):
    """
    Caches corpus text type information (= available structural attribute values).
    This can be helpful in case of large corpora with rich metadata. In case
    there is no caching directory set values are always loaded directly from
    the corpus.
    """

    def __init__(self, db):
        self._db = db

    @staticmethod
    def _mk_cache_key(corpname):
        return 'ttcache:%s' % (corpname, )

    def get_values(self, corp, subcorpattrs, maxlistsize, shrink_list=False, collator_locale=None):
        text_types = self._db.get(self._mk_cache_key(corp.corpname))
        if text_types is None:
            text_types = corplib.texttype_values(corp=corp, subcorpattrs=subcorpattrs,
                                                 maxlistsize=maxlistsize, shrink_list=shrink_list,
                                                 collator_locale=collator_locale)
            self._db.set(self._mk_cache_key(corp.corpname), text_types)
        return text_types

    def clear(self, corp):
        self._db.remove(self._mk_cache_key(corp.corpname))
