# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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
Token detail plug-in is used for attaching (an external) information
to any token in a concordance. Typically, this can be used to attach
dictionaries, encyclopediae to individual tokens, named entities etc.

The plug-in is composed of three main general components:

1) **backend** represents an adapter communicating with an (external)
   service

2) **client frontend** visually interprets the data provided by the backend,

3) **server frontend** exports backend data to be readable by the client
   frontend and specifies which client-side component is responsible for
   rendering the contents.

In general it is expected to be possible to mix these (especially backend vs. frontend)
in different ways - e.g. RawHtmlFrontend is probably usable along with any
backend producing raw HTML output.

Please note that in case of this plug-in the key to customization lies in
frontends and backends. It means that in case you need a special functionality,
it will be probably enough to extend this plug-in by an empty class and
add your frontend or backend (depending on what needs to be customized).
"""
import abc
import logging
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Sequence, Tuple

from corplib.corpus import KCorpus
from plugin_types.providers import (
    AbstractProviderBackend, AbstractProviderFrontend)

# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from action.plugin.ctx import PluginCtx

from plugin_types import CorpusDependentPlugin


class BackendException(Exception):
    pass


class Response:
    """
    A response as returned by server-side frontend (where server-side
    frontend receives data from backend).
    """

    def __init__(self, contents: str, renderer: str, status: bool, heading: str, note: str, is_kwic_view: bool) -> None:
        """

        Arguments:
            contents -- any JSON serializable data understood by the renderer
            renderer -- a string ID of a client-side compnent able to render 'contents'
            status -- a bool representing FOUND/NOT_FOUND
            heading -- a (possibly localized) heading to be displayed along with the data
            note -- a (possibly localized) additional info describing what service does.
        """
        self.contents: str = contents
        self.renderer: str = renderer
        self.status: bool = status
        self.heading: str = heading
        self.note: str = note
        self.is_kwic_view: bool = is_kwic_view

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__


class AbstractBackend(AbstractProviderBackend):
    """
    A general description of a service providing
    external data for (word, lemma, pos, corpora, lang)
    combination.
    """

    def get_required_cookies(self) -> List[str]:
        """
         get_required_cookies returns a list of cookie names required in user's request and to be reused in
         an internal request to a specified backend service.
        """
        return []

    @abc.abstractmethod
    async def fetch(
            self,
            corpora: List[str],
            maincorp: KCorpus,
            token_id: int,
            num_tokens: int,
            query_args: Dict[str, str],
            lang: str,
            is_anonymous: bool,
            context: Tuple[int, int] = None,
            cookies: Dict[str, str] = None,
    ) -> Tuple[Any, bool]:
        pass

    def get_required_attrs(self) -> List[str]:
        """
        Which positional and structural attributes are needed to
        perform a query against the provider.

        This is typically configured in provider's
        JSON configuration.
        """
        if 'posAttrs' in self._conf:
            logging.getLogger(__name__).warning(
                'You are using a deprecated "conf.posAttr" value; please use "conf.attrs" instead.')
            return self._conf.get('posAttrs', [])
        else:
            return self._conf.get('attrs', [])


class AbstractFrontend(AbstractProviderFrontend):
    """
    A general server-side frontend. All the implementations
    should call its 'export_data' method which performs
    some core initialization of Response. Concrete implementation
    then can continue with specific data filling.
    """

    def export_data(self, data: Any, status: bool, lang: str, is_kwic_view: bool) -> Response:
        return Response(contents='', renderer='', status=status,
                        is_kwic_view=bool(is_kwic_view),
                        heading=self._fetch_localized_prop('_headings', lang),
                        note=self._fetch_localized_prop('_notes', lang))


class AbstractTokenConnect(CorpusDependentPlugin):

    def map_providers(self, providers: Sequence[Tuple[str, bool]]) -> Tuple[AbstractBackend, Optional[AbstractFrontend], bool]:
        """
        Based on provider selection (identifier and bool specifying whether it should be a KWIC view alternative),
        list all respective backends, frontends and "is kwic view" info into 3-tuples.
        """
        raise NotImplementedError()

    @abc.abstractmethod
    async def fetch_data(
            self,
            plugin_ctx: 'PluginCtx',
            providers: Sequence[Tuple[str, bool]],
            corpus: KCorpus,
            corpora: List[str],
            token_id: int,
            num_tokens: int,
            lang: str,
            context: Tuple[int, int] = None) -> List[Tuple[Any, bool]]:
        """
        Obtain (in a synchronous way) data from all the backends
        identified by a list of provider ids.

        arguments:
        plugin_ctx -- PluginCtx object providing access to the current user request and scope
        providers -- list of defined providers we want to search in
        corpus -- corpus object used to fetch actual positional attributes used
                  to query the providers
        corpora -- list of involved corpora IDs
        token_id -- internal token ID user ask information about
        num_tokens -- how many tokens from the token_id to include in query (multi-word queries); min is 1
        lang -- user interface language (so we know how to localize the returned stuff)
        context -- optional additional context to be applied (e.g. when using as a KWIC detail)
        """
        pass

    def get_required_structattrs(self) -> List[str]:
        """
        Return a list of structural attributes (encoded as [structure].[attribute]
        e.g. "doc.id") required by the plug-in to be able to trigger request
        for information about structure (instead of a common token which is simply
        identified by its numeric token ID).
        """
        return []

    @abc.abstractmethod
    async def is_enabled_for(self, plugin_ctx: 'PluginCtx', corpora: List[str]) -> bool:
        pass
