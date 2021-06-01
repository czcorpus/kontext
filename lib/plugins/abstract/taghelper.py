# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
This module contains a specification for the server-side of the
'taghelper' widget which provides an interactive way how to write
a PoS tag within a CQL query.

Please note that the specification is more strict than necessary -
there is a concept of 'loaders' and 'fetchers' which is completely
avoidable but we suggest implementers to adopt this approach and
reuse existing 'default_taghelper' plug-in with custom loaders and
fetchers as it should be much easier to accomplish than writing
a new version of 'taghelper'.
"""

import abc
from typing import TypeVar, Generic
from werkzeug.wrappers import Request
from controller.plg import PluginCtx

T = TypeVar('T')
U = TypeVar('U')


class AbstractValueSelectionFetcher(abc.ABC, Generic[T]):
    """
    AbstractValueSelectionFetcher provides way how to
    obtain user tag value search query data from the
    werkzeug.wrappers.Request (see a respective pyi file)
    and encode them in a way suitable for a respective
    loader.
    """

    @abc.abstractmethod
    def fetch(self, request: Request) -> T:
        """
        fetch data from an HTTP request and encode
        using a custom data type
        """

    @abc.abstractmethod
    def is_empty(self, val: T) -> bool:
        """
        Test whether the 'val' (= fetched data)
        contains an empty query.
        """


class AbstractTagsetInfoLoader(abc.ABC, Generic[T, U]):
    """
    AbstractTagsetInfoLoader wraps all the implementation
    details and concrete data format properties of
    a tag set into a general interface Tag Helper plug-in
    can work with.

    The instance is expected to be bound with a concrete corpus.
    I.e. in case multiple corpora support the same tagset, multiple
    loaders will be instantiated.

    Note: Having two methods may seem superfluous as the initial
    values can be seen as getting a variant for an empty query.
    But there is another important difference between the two
    methods. A plug-in developer may want get_initial_values
    to return all the possible values as defined in tagset
    specification no matter how tag-rich a respective corpus is
    (i.e. the corpus may not contain values for some property
    at all but we want it in the selection anyway).
    The 'get_variant' method on the other hand is expected to
    be purely data-driven - i.e. it returns data based on
    actual corpus contents.
    """

    @abc.abstractmethod
    def is_available(self) -> bool:
        """
        Return true if the loader is able to provide answers
        (e.g. source data files exist etc.)
        """

    @abc.abstractmethod
    def get_initial_values(self, lang: str) -> T:
        """
        Return all the possible properties of a respective tagset
        (i.e. all the positions/keys/whatever and their respective
        labels/descriptions/etc.).
        """

    @abc.abstractmethod
    def get_variant(self, user_selection: U, lang: str) -> T:
        """
        Based on user selection encoded as a list of tuples [(key1, value1), ...,(keyN, valueN)]
        return a filtered values matching the selected ones.

        E.g. let's say we have the following variants in a corpus: AAB, ACD, BAB, CAA
        and user selects A.. Then we want to return [A, C] for the second position and
        [B, D] for the third position as possible values.
        For key-value tagsets it works in the same way - just imagine K1=A, K2=A,
        K3=B instead of AAB, K1=A, K2=C, K3=D instead of ACD etc.
        """


class AbstractTaghelper(abc.ABC, Generic[T, U]):
    """
    !!! Please note that taghelper is not an instance of CorpusDependentPlugin
    even if it would sound reasonable. The reason is that e.g. in case of
    parallel corpora, tags may not be enabled for primary corpus but they
    can be enabled for one or more aligned corpora. So it is easier to
    enable the plug-in no matter what corpus in on and make some additional
    tests when instantiating query/filter form properties (there we
    use tags_available_for method).
    """

    @abc.abstractmethod
    def tags_available_for(self, plugin_ctx: PluginCtx, corpus_id: str, tagset_id: str) -> bool:
        """
        Test whether tag variant data exist for a specified
        corpus.

        arguments:
        corpus_id -- a corpus identifier
        """

    @abc.abstractmethod
    def loader(self, plugin_ctx: PluginCtx, corpus_name: str, tagset_name: str) -> AbstractTagsetInfoLoader[T, U]:
        """
        Return a loader for the corpus_name
        """

    @abc.abstractmethod
    def fetcher(self, plugin_ctx: PluginCtx, corpus_name: str, tagset_name: str) -> AbstractValueSelectionFetcher[U]:
        """
        Return a fetcher for the corpus_name
        """
