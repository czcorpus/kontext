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
A simple featured_corpora plug-in implementation. List is taken
from defined XML subtree (/kontext/plugins/featured_corpora/list)
and compared with user-available corpora - the intersection of
both sets is returned.
"""

from abstract.featured_corpora import AbstractFeaturedCorpora


class FeaturedCorpora(AbstractFeaturedCorpora):

    def __init__(self, conf):
        self._conf = conf

    def mark_featured(self, user_corplist):
        """
        arguments:
        user_id -- an ID of a user
        user_corplist -- list of dicts {'canonical_id': ...} (additional keys are OK)
        """
        featured_corp = self._conf.get('list', [])
        for item in user_corplist:
            if item['canonical_id'] in featured_corp:
                item['featured'] = True
            else:
                item['featured'] = False


def create_instance(conf, *args):
    """
    arguments:
    conf -- the 'settings' module (or some compatible dict-like object)
    """
    return FeaturedCorpora(conf.get('plugins', 'featured_corpora'))