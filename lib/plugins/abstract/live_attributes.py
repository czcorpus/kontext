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


from plugins.abstract import CorpusDependentPlugin


class AbstractLiveAttributes(CorpusDependentPlugin):

    def is_enabled_for(self, plugin_api, corpname):
        """
        Return True if live attributes are enabled for selected corpus
        else return False
        """
        raise NotImplementedError()

    def get_attr_values(self, plugin_api, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None):
        """
        Find all the available values of remaining attributes according to the
        provided attr_map and aligned_corpora

        arguments:
        plugin_api --
        corpus -- manatee.corpus object
        attr_map -- a dictionary of attributes and values as selected by a user
        aligned_corpora -- a list/tuple of corpora names aligned to base one (the 'corpus' argument)
        autocomplete_attr -- such attribute will be also part of selection even if it is a part 'WHERE ...' condition

        returns:
        a dictionary containing matching attributes and values
        """
        raise NotImplementedError()

    def get_bibliography(self, plugin_api, corpus, item_id):
        """
        Returns a list of 2-tuples (attr_name, attr_value).
        """
        raise NotImplementedError()

