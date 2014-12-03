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
"""
A custom featured_corpora plug-in implementation. List is taken
from defined XML subtree (/kontext/plugins/featured_corpora/list)
and compared with user-available corpora - the intersection of
both sets is returned.

User's corpus list may contain prefixed corpora IDs - in such case
only 'basename' is searched in featured list but full ID (i.e. the
one user has access to) is returned.

This allows promoting a corpus with multiple configurations (e.g.
if KonText configuration promotes "BNC" and user has access to
"limited/BNC" then she obtains "BNC" in her featured list too but
once she selects it, "limited/BNC" will be loaded.
"""

from abstract.featured_corpora import AbstractFeaturedCorpora


class FeaturedCorpora(AbstractFeaturedCorpora):

    def __init__(self, conf, db):
        """
        arguments:
        conf -- a dict containing plug-in configuration
        db -- a KeyValueStorage implementation
        """
        self._conf = conf
        self._db = db

    @staticmethod
    def _mk_db_key(user_id):
        return 'featured_corpora:user:%d' % user_id

    @staticmethod
    def _partial_match(featured_corpus, user_corpora):
        """
        arguments:
        featured_corpus -- an ID of a featured corpus

        returns:
        a user corpus ID matching partially (i.e. the featured one is a suffix of the user one)
        featured corpus ID or None if no match is found
        """
        for name in user_corpora:
            parts = name.rsplit('/', 1)
            if len(parts) == 2 and parts[-1] == featured_corpus:
                return name
        return None

    def get_corpora(self, user_id, user_corplist):
        """
        arguments:
        user_id -- an ID of a user
        user_corplist -- list of dicts where each contains at least 'id' and 'name' keys

        returns:
        tuple of 2-tuples (corpus_id, corpus_name)
        """
        featured = self._db.get(self._mk_db_key(user_id))
        user_corpora = dict([(x['id'], x) for x in user_corplist])

        if featured is None:
            featured = []
            for featured_corp in self._conf.get('list', []):
                if featured_corp in user_corpora:
                    featured.append(featured_corp)
                else:
                    part_m = self._partial_match(featured_corp, user_corpora.keys())
                    if part_m is not None:
                        featured.append(part_m)
            self._db.set(self._mk_db_key(user_id), featured)
        return tuple([(x, user_corpora[x].get('name', None)) for x in featured])


def create_instance(conf, db):
    """
    arguments:
    conf -- the 'settings' module (or some compatible dict-like object)
    db -- a KeyValueStorage implementation
    """
    return FeaturedCorpora(conf.get('plugins', 'featured_corpora'), db)