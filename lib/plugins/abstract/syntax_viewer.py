# Copyright (c) 2016 Czech National Corpus
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


class SyntaxViewerPlugin(CorpusDependentPlugin):

    def search_by_token_id(self, corp, canonical_corpname, token_id, kwic_len):
        raise NotImplementedError()

    def is_enabled_for(self, corpname):
        raise NotImplementedError()


class SyntaxDataBackendError(Exception):
    pass


class MaximumContextExceeded(Exception):
    """
    This should be thrown by SearchBackend.get_data() in case
    a processed sentence reaches out of available Manatee context
    for a searched phrase (MAXCONTEXT, see
    https://www.sketchengine.co.uk/xdocumentation/wiki/SkE/Config/FullDoc#MAXCONTEXT
    for more details).
    """
    pass


class SearchBackend(object):

    def import_parent_values(self, v):
        """
        Returns a list of possible parents encoded in a string. Please
        note that due to generality we must assume multiple parents
        even if it does not make sense in a single tree.

        Override this method in case your data is encoded
        somehow (i.e. there is more than just number expected there).

        Args:
            v (str): one or more parent values encoded in a single string

        Returns (list of int):
            numeric value representation
        """
        return [int(v)] if v.isdigit() else []

    def get_data(self, corpus, canonical_corpus_id, token_id, kwic_len):
        """
        Args:
            corpus (manatee.Corpus): a respective corpus instance
            canonical_corpus_id (str): canonical corpus identifier
            token_id (int): token numeric ID
            kwic_len (int): number of tokens in KWIC
        Returns (tuple(list_of_nodes, TreeNodeEncoder))

        """
        raise NotImplementedError()
