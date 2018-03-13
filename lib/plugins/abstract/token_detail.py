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
   frontend.

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


class Response(object):
    def __init__(self, contents, renderer, status, heading, note):
        self.contents = contents
        self.renderer = renderer
        self.status = status
        self.heading = heading
        self.note = note

    def to_dict(self):
        return self.__dict__


class AbstractBackend(object):

    def __init__(self, provider_id):
        self._cache_path = None
        self._provider_id = provider_id

    def fetch_data(self, word, lemma, pos, aligned_corpora, lang):
        raise NotImplementedError()

    def set_cache_path(self, path):
        self._cache_path = path

    def get_cache_path(self):
        return self._cache_path

    def get_provider_id(self):
        return self._provider_id


class AbstractFrontend(object):

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
    path -- a full identifier of a class, e.g. plugins.default_token_detail.backends.Foo

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


class AbstractTokenDetail(CorpusDependentPlugin):

    def fetch_data(self, provider_ids, word, lemma, tag, aligned_corpora, lang):
        """
        Obtain (in a synchronous way) data from all the backends
        identified by a list of provider ids.
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
