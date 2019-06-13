# Copyright (c) 2017 Charles University, Faculty of Arts,
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

from typing import Dict, Any, List, Tuple, ClassVar, Iterable

from plugins.abstract import CorpusDependentPlugin
import kontext
import manatee


class BackendException(Exception):
    pass


class Response(object):

    contents:basestring
    renderer:str
    status:bool
    heading:unicode
    note:unicode

    def __init__(self, contents:basestring, renderer:str, status:bool, heading:unicode, note:unicode): ...

    def to_dict(self) -> Dict[str, Any]: ...


class AbstractBackend(object):

    _cache_path:str

    provider_id:str

    def fetch(self, corpora:List[str], token_id:int, num_tokens:int, query_args:Dict[str, basestring],
              lang:str) -> Tuple[Any, bool]: ...

    def set_cache_path(self, path:str): ...

    def get_cache_path(self) -> str: ...

    def enabled_for_corpora(self, corpora:Iterable[str]) -> bool: ...

    def get_required_posattrs(self) -> List[str]: ...


class AbstractFrontend(object):

    _headings:Dict[str, basestring]
    _notes:Dict[str, basestring]

    def _fetch_localized_prop(self, prop:str, lang:str) -> unicode: ...

    def export_data(self, data:Any, status:bool, lang:str) -> Response: ...

    def get_heading(self, lang:str) -> unicode: ...


class AbstractTokenConnect(CorpusDependentPlugin):

    def fetch_data(self, provider_ids:List[str], maincorp_obj:manatee.Corpus, corpora:List[str],
                   token_id:int, num_tokens:int, lang:str) -> List[Tuple[Any, bool]]: ...

    def get_required_structattrs(self) -> List[str]: ...

    def is_enabled_for(self, plugin_api:kontext.PluginApi, corpname:basestring) -> bool: ...


def find_implementation(path:str) -> ClassVar: ...
