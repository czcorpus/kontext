# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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
import importlib
import logging
from typing import Any, Dict, Iterable, Optional, Tuple, TypeVar

import ujson as json
from plugin_types.general_storage import KeyValueStorage


class AbstractProviderBackend(abc.ABC):
    """
    A general description of a service providing
    external data for (word, lemma, pos, corpora, lang)
    combination.
    """

    def __init__(self, provider_id: str, db: KeyValueStorage, ttl: int):
        self._db: KeyValueStorage = db
        self._ttl: int = ttl
        self._provider_id: str = provider_id

    def get_cache_db(self) -> KeyValueStorage:
        return self._db

    @property
    def provider_id(self) -> str:
        return self._provider_id

    @property
    def cache_ttl(self) -> int:
        return self._ttl

    def enabled_for_corpora(self, corpora: Iterable[str]) -> bool:
        """
        Return False if the backend cannot
        be used for a specific combination(s)
        of corpora (primary corp + optional aligned ones).
        By default, the method returns True for all.
        """
        return True


class AbstractProviderFrontend(abc.ABC):
    """
    A general server-side frontend. All the implementations
    should call its 'export_data' method which performs
    some core initialization of Response. Concrete implementation
    then can continue with specific data filling.
    """

    def __init__(self, conf: Dict[str, Any]) -> None:
        self._headings: Dict[str, str] = conf.get('heading', {})
        self._notes: Dict[str, str] = conf.get('note', {})

    def _fetch_localized_prop(self, prop: str, lang: str) -> str:
        value = ''
        if lang in getattr(self, prop):
            value = getattr(self, prop)[lang]
        else:
            srch_lang = lang.split('_')[0]
            for k, v in list(getattr(self, prop).items()):
                v_lang = k.split('_')[0]
                if v_lang == srch_lang:
                    value = v
                    break
            if not value:
                value = getattr(self, prop).get('en_US', '')
        return value

    @property
    def headings(self) -> Dict[str, str]:
        return self._headings

    def get_heading(self, lang: str) -> str:
        return self._fetch_localized_prop('_headings', lang)


def find_implementation(path: str) -> Any:
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


def init_provider(conf: Dict[str, Any], ident: str, db: KeyValueStorage, ttl: int) -> Tuple[Any, Optional[Any]]:
    """
    Create and return both backend and frontend.

    arguments:
    conf -- a dict representing plug-in detailed configuration

    returns:
    a 2-tuple (backend instance, frontend instance)
    """
    backend_class = find_implementation(conf['backend'])
    frontend_path = conf.get('frontend', None)
    if frontend_path is None:
        return backend_class(conf['conf'], ident, db, ttl), None
    frontend_class = find_implementation(frontend_path)
    return backend_class(conf['conf'], ident, db, ttl), frontend_class(conf)


T, U = TypeVar('T'), TypeVar('U')


def setup_providers(
    plg_conf: Dict[str, Any],
    db: KeyValueStorage,
    be_type: T = AbstractProviderBackend,
    fe_type: U = AbstractProviderFrontend,
) -> Dict[str, Tuple[T, Optional[U]]]:
    with open(plg_conf['providers_conf'], 'rb') as fr:
        providers_conf = json.load(fr)
    providers: Dict[str, Tuple[T, Optional[U]]] = {}
    for b in providers_conf:
        provider = init_provider(b, b['ident'], db, plg_conf['ttl'])
        if not isinstance(provider[0], be_type):
            logging.info("Backend provider %s not of expected type %s. Skipping.",
                         provider[0], be_type)
            continue
        if provider[1] is not None and not isinstance(provider[1], fe_type):
            logging.info("Frontend provider %s not of expected type %s. Skipping.",
                         provider[1], fe_type)
            continue
        providers[b['ident']] = provider
    return providers
