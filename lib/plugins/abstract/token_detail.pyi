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

from typing import Dict, Any, List, Tuple

from plugins.abstract import CorpusDependentPlugin
import kontext


class Response(object):

    contents:basestring
    renderer:str
    status:int
    heading:unicode

    def __init__(self, contents:basestring, renderer:str, status:int, heading:unicode): ...

    def to_dict(self) -> Dict[str, Any]: ...


class AbstractBackend(object):

    def fetch_data(self, word:basestring, lemma:basestring, tag:basestring, aligned_corpora:List[str],
                   lang:str) -> Tuple[Any, int]: ...


class AbstractFrontend(object):

    _headings:Dict[str, basestring]

    def export_data(self, data:Any, status:int, lang:str) -> Response: ...


class AbstractTokenDetail(CorpusDependentPlugin):

    def fetch_data(self, provider_ids:List[str], word:basestring, lemma:basestring, tag:basestring,
                   aligned_corpora:List[str], lang:str) -> List[[Any, int]]: ...

    def get_required_structattrs(self) -> List[str]: ...

    def is_enabled_for(self, plugin_api:kontext.PluginApi, corpname:basestring) -> bool: ...
