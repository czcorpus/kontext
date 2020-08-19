# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Any, List
import importlib
import logging
import json

from plugins.abstract.query_suggest import AbstractQuerySuggest
import plugins
import plugins.abstract.corpora
from controller import exposed
from actions import concordance


@exposed(return_type='json')
def fetch_query_suggestions(_, request):
    """
    """
    with plugins.runtime.QUERY_SUGGEST as plg:
        ans = plg.find_suggestions(ui_lang=request.args.get('ui_lang'), corpora=request.args.getlist('corpora'),
                                   subcorpus=request.args.get('subcorpus'), value=request.args.get('value'),
                                   value_type=request.args.get('value_type'), query_type=request.args.get('query_type'),
                                   p_attr=request.args.get('p_attr'), struct=request.args.get('struct'),
                                   s_attr=request.args.get('s_attr'))
    return dict(items=ans)


class DefaultQuerySuggest(AbstractQuerySuggest):

    def __init__(self, providers, corparch: plugins.abstract.corpora.AbstractCorporaArchive):
        self._providers = providers
        self._corparch = corparch

    def find_suggestions(self, ui_lang: str, corpora: List[str], subcorpus: str, value: str, value_type: str,
                         query_type: str, p_attr: str, struct: str, s_attr: str):
        ans = []
        for ident, provider in self._providers.items():
            backend, frontend = provider
            resp = backend.find_suggestion(ui_lang=ui_lang, corpora=corpora, subcorpus=subcorpus, value=value,
                                           value_type=value_type, query_type=query_type, p_attr=p_attr,
                                           struct=struct, s_attr=s_attr)
            ans.append(frontend.export_data(ui_lang, resp).to_dict())
        return ans

    def export(self, plugin_api):
        corpus_info = self._corparch.get_corpus_info(
            plugin_api.user_lang, plugin_api.current_corpus.corpname)
        query_types = {}
        for ident, fb in self._providers.items():
            _, frontend = fb
            if ident in corpus_info.query_suggest.providers:
                query_types[ident] = frontend.query_types
        return dict(query_types=query_types)

    def export_actions(self):
        return {concordance.Actions: [fetch_query_suggestions]}


def find_implementation(path: str) -> Any:
    """
    Find a class identified by a string.
    This is used to decode frontends and backends
    defined in a respective JSON configuration file.

    arguments:
    path -- a full identifier of a class, e.g. plugins.default_query_suggest.backends.Foo

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


def init_provider(conf, ident):
    """
    Create and return both backend and frontend.

    arguments:
    conf -- a dict representing plug-in detailed configuration

    returns:
    a 2-tuple (backend instance, frontend instance)
    """
    backend_class = find_implementation(conf['backend'])
    frontend_class = find_implementation(conf['frontend'])
    return backend_class(conf['conf'], ident), frontend_class(conf)


def setup_providers(plg_conf):

    with open(plg_conf['default:providers_conf'], 'rb') as fr:
        providers_conf = json.load(fr)
    providers = dict((b['ident'], init_provider(b, b['ident'])) for b in providers_conf)
    return providers


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    providers = setup_providers(settings.get('plugins', 'query_suggest'))
    return DefaultQuerySuggest(providers, corparch)
