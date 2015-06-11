# Copyright (c) 2015 Institute of the Czech National Corpus
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

"""
Interfaces for concordance cache and its factory. Please note
that the plug-in factory 'create_instance' must return an instance
of AbstractCacheMappingFactory (i.e. not AbstractConcCache).
"""


class AbstractConcCache(object):

    def refresh_map(self):
        """
        Tests whether the data for a given corpus (the one this instance
        has been created for) is ready and valid (e.g. a directory
        for the corpus cache files exists). If there is something missing
        then the method has a chance to fix it.

        Some implementations may probably leave this method empty
        as soon as their other interface methods ensure they can
        handle 'missing initialization / invalid cache' situations
        themselves.
        """
        raise NotImplementedError()

    def cache_file_path(self, subchash, q):
        """
        Returns a path to a cache file matching provided subcorpus hash and query
        elements

        arguments:
        subchash -- hashed subcorpus identifier (corplib.CorpusManager does this)
        q -- a list of query items
        """
        raise NotImplementedError()

    def add_to_map(self, subchash, query, size, pid_file=None):
        """
        adds or updates a cache map entry

        arguments:
        subchash -- a subcorpus identifier hash (see corplib.CorpusManager.get_Corpus)
        query -- a list/tuple of query elements
        size -- current size of a respective concordance (the one defined by corpus, subchash
                and query)
        pid_file -- any value passed here is stored to cache if and only if there
                    is no matching entry present in cache (i.e. a new entry is created)
                    - default is None
        returns:
        2-tuple
            cache_file_path -- path to a respective cache file
            stored_pidfile -- path to a file storing calculation details; it may be present
                              even if the calculation already finished
        """
        raise NotImplementedError()

    def del_full_entry(self, entry_key):
        """
        Removes all the entries with the same base query no matter
        what other parameters (e.g. shuffle) of the query are.

        arguments:
        entry_key -- a 2-tuple (subchash, query) where query is a tuple of min length 1
        """
        raise NotImplementedError()


class AbstractCacheMappingFactory(object):
    """
    A factory which provides AbstractConcCache instances. Please note
    that your module's 'create_instance' should return this factory and
    not the cache itself.
    """
    def get_mapping(self, corpus):
        """
        returns:
        an AbstractConcCache compatible instance
        """
        raise NotImplementedError()
