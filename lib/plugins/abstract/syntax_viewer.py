# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import abc
from plugins.abstract import CorpusDependentPlugin


class AbstractSyntaxViewerPlugin(CorpusDependentPlugin):

    @abc.abstractmethod
    def search_by_token_id(self, corp, corpname, token_id, kwic_len):
        pass

    @abc.abstractmethod
    def is_enabled_for(self, plugin_ctx, corpname):
        pass


class BackendException(Exception):
    pass


class MaximumContextExceeded(BackendException):
    """
    This should be thrown by SearchBackend.get_data() in case
    a processed sentence reaches out of available Manatee context
    for a searched phrase (MAXCONTEXT, see
    https://www.sketchengine.co.uk/xdocumentation/wiki/SkE/Config/FullDoc#MAXCONTEXT
    for more details).
    """
    pass


class BackendDataParseException(BackendException):

    def __init__(self, result):
        super(BackendDataParseException, self).__init__(None)
        self._result = result

    @property
    def result(self):
        return self._result

    def __repr__(self):
        return 'BackendDataParseException({0})'.format(self._result)


class SearchBackend(abc.ABC):
    """
    SearchBackend represents an object able to obtain
    data needed to construct syntax trees. It may be
    fetched either from Manatee index or from some other
    resource in case syntactic data are stored separately.
    """

    def import_parent_values(self, v):
        """
        Return a list of possible parents encoded in a string. Please
        note that due to generality we must assume multiple parents
        even if it does not make sense in a single tree.

        Override this method in case your data is encoded
        somehow (i.e. there is more than just number expected there).

        Args:
            v (str): one or more parent values encoded in a single string

        Returns (list of int):
            numeric value representation
        """
        try:
            return [int(v)]
        except ValueError:
            return []

    @abc.abstractmethod
    def get_data(self, corpus, corpus_id, token_id, kwic_len):
        """
        Return syntax tree data for a specified token and a proper
        JSON encoder to be able to serialize the data.

        Args:
            corpus (manatee.Corpus): a respective corpus instance
            corpus_id (str): corpus identifier
            token_id (int): token numeric ID
            kwic_len (int): number of tokens in KWIC
        Returns (tuple(list_of_nodes, TreeNodeEncoder))

        """

    def get_detail_attr_orders(self, corpus_id, corpus):
        """
        The data format used by js-treex-view which we
        are compliant with uses a dict type for
        node detail which makes assuring of explicit order
        for items impossible. This function provides a way
        how to pass additional information to the client-side
        of the plug-in where some order can be created.

        Returns a dict containing orders of detail attributes
        for individual trees. In case there is no data for
        a specific corpus, the client-side should use some
        other logic (either a default iteration of an object
        or some sorting).
        """
        return {}

    @staticmethod
    def is_error_node(node):
        return isinstance(node, BackendDataParseException)
