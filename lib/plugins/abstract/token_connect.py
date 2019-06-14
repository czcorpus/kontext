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
import importlib

from plugins.abstract import CorpusDependentPlugin


class BackendException(Exception):
    pass


class Response(object):
    """
    A response as returned by server-side frontend (where server-side
    frontend receives data from backend).
    """

    def __init__(self, contents, renderer, status, heading, note):
        """

        Arguments:
            contents -- any JSON serializable data understood by renderer
            renderer -- a string ID of a client-side compnent able to render 'contents'
            status -- a bool representing FOUND/NOT_FOUND
            heading -- a (possibly localized) heading to be displayed along with the data
            note -- a (possibly localized) additional info describing what service does.
        """
        self.contents = contents
        self.renderer = renderer
        self.status = status
        self.heading = heading
        self.note = note

    def to_dict(self):
        return self.__dict__


class AbstractBackend(object):
    """
    A general description of a service providing
    external data for (word, lemma, pos, corpora, lang)
    combination.
    """

    def __init__(self, provider_id):
        self._cache_path = None
        self._provider_id = provider_id

    @property
    def provider_id(self):
        return self._provider_id

    def fetch(self, corpora, token_id, num_tokens, query_args, lang):
        raise NotImplementedError()

    def set_cache_path(self, path):
        self._cache_path = path

    def get_cache_path(self):
        return self._cache_path

    def enabled_for_corpora(self, corpora):
        """
        Return False if the backend cannot
        be used for a specific combination(s)
        of corpora (primary corp + optional aligned ones).
        By default the method returns True for all.
        """
        return True

    def get_required_attrs(self):
        """
        Which positional and structural attributes are needed to
        perform a query against the provider.

        This is typically configured in provider's
        JSON configuration.
        """
        return []


class AbstractFrontend(object):
    """
    A general server-side frontend. All the implementations
    should call its 'export_data' method which performs
    some core initialization of Response. Concrete implementation
    then can continue with specific data filling.
    """

    def __init__(self, conf):
        self._headings = conf.get('heading', {})
        self._notes = conf.get('note', {})

    def _fetch_localized_prop(self, prop, lang):
        value = ''
        if lang in getattr(self, prop):
            value = getattr(self, prop)[lang]
        else:
            srch_lang = lang.split('_')[0]
            for k, v in getattr(self, prop).items():
                v_lang = k.split('_')[0]
                if v_lang == srch_lang:
                    value = v
                    break
            if not value:
                value = getattr(self, prop).get('en_US', '')
        return value

    @property
    def headings(self):
        return self._headings

    def get_heading(self, lang):
        return self._fetch_localized_prop('_headings', lang)

    def export_data(self, data, status, lang):
        return Response(contents='', renderer='', status=status,
                        heading=self._fetch_localized_prop('_headings', lang),
                        note=self._fetch_localized_prop('_notes', lang))


def find_implementation(path):
    """
    Find a class identified by a string.
    This is used to decode frontends and backends
    defined in a respective JSON configuration file.

    arguments:
    path -- a full identifier of a class, e.g. plugins.default_token_connect.backends.Foo

    returns:
    a class matching the path
    """
    try:
        md, cl = path.rsplit('.', 1)
    except ValueError:
        raise ValueError(
            'Frontend path must contain both package and class name. Found: {0}'.format(path))
    the_module = importlib.import_module(md)
    return getattr(the_module, cl)


class AbstractTokenConnect(CorpusDependentPlugin):

    def map_providers(self, provider_ids):
        raise NotImplementedError()

    def fetch_data(self, provider_ids, maincorp_obj, corpora, token_id, num_tokens, lang):
        """
        Obtain (in a synchronous way) data from all the backends
        identified by a list of provider ids.

        arguments:
        provider_ids -- list of defined providers we want to search in
        maincorp_obj -- corpus object used to fetch actual positional attributes used
                        to query the providers
        corpora -- list of involved corpora IDs
        token_id -- internal token ID user ask information about
        num_tokens -- how many tokens from the token_id to include in query (multi-word queries); min is 1
        lang -- user interface language (so we know how to localize the returned stuff)
        """
        raise NotImplementedError()

    def get_required_structattrs(self):
        """
        Return a list of structural attributes (encoded as [structure].[attribute]
        e.g. "doc.id") required by the plug-in to be able to trigger request
        for information about structure (instead of a common token which is simply
        identified by its numeric token ID).
        """
        return []

    def is_enabled_for(self, plugin_api, corpname):
        raise NotImplementedError()
