# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

import abc
from plugins.abstract import CorpusDependentPlugin


class AbstractLiveAttributes(CorpusDependentPlugin):

    @abc.abstractmethod
    def is_enabled_for(self, plugin_api, corpname):
        """
        Return True if live attributes are enabled for selected corpus
        else return False
        """

    @abc.abstractmethod
    def get_attr_values(self, plugin_api, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None,
                        limit_lists=True):
        """
        Find all the available values of remaining attributes according to the
        provided attr_map and aligned_corpora

        arguments:
        plugin_api --
        corpus -- manatee.corpus object
        attr_map -- a dictionary of attributes and values as selected by a user
        aligned_corpora -- a list/tuple of corpora names aligned to base one (the 'corpus' argument)
        autocomplete_attr -- such attribute will be also part of selection even if it is a part 'WHERE ...' condition
        limit_lists -- if False then configured max length of returned lists is ignored and full attr lists are
                       provided

        returns:
        a dictionary containing matching attributes and values
        """

    #TODO missing raise NotImplementedError ?
    @abc.abstractmethod
    def get_subc_size(self, plugin_api, corpus, attr_map):
        """
        Return a size (in tokens) of a subcorpus defined by selected attributes
        
        plugin_api --
        corpus -- a manatee.Corpus instance
        attr_map -- a dict containing selected attributes and respective values 
        """

    @abc.abstractmethod
    def get_sattr_pair_sizes(self, corpname, sattr1, sattr2, sattr_values):
        """
        Find token numbers for all the provided structural attribute
        value pairs.

        arguments:
        corpname -- a corpus identifier
        sattr1 -- the first structural attribute (e.g. 'doc.genre')
        sattr2 -- the second structural attribute (e.g' 'doc.pubyear')
        sattr_values -- a list of value pairs (e.g.: [('fiction', '1980'), ('fiction', '1981'),...])
        
        returns:
        a list of sizes (in tokens) with an order matching sattr_values
        """

    @abc.abstractmethod
    def get_supported_structures(self, corpname):
        """
        Return a list of structure names the plug-in
        and its data support for the 'corpname' corpus.

        arguments:
        corpname -- a corpus identifier

        returns:
        a list of structures (e.g. ['doc', 'p'])
        """

    @abc.abstractmethod
    def get_bibliography(self, plugin_api, corpus, item_id):
        """
        Returns a list of 2-tuples (attr_name, attr_value).
        """

    @abc.abstractmethod
    def find_bib_titles(self, plugin_api, corpus_id, id_list):
        """
        For a list of bibliography item IDs (= typically unique document IDs)
        find respective titles.

        Returns a list of pairs (bib_id, bib_title) where bib_id is the original
        provided ID
        """
