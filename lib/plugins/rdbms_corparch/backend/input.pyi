# Copyright(c) 2018 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import List, Dict, Any, IO


class InstallJsonMetadata(object):

    database:str
    label_attr:str
    id_attr:str
    desc:int
    keywords:List[str]
    featured:bool


class InstallJsonReference(object):

    default:str
    articles:List[str]
    other_bibliography:str


class InstallJson(object):

    ident:str
    sentence_struct:str
    tagset:str
    web:str
    collator_locale:str
    speech_segment:str
    speaker_id_attr:str
    speech_overlap_attr:str
    speech_overlap_val:str
    use_safe_font:bool
    metadata:InstallJsonMetadata
    reference:InstallJsonReference
    token_connect:List[str]
    kwic_connect:List[str]

    @staticmethod
    def create_sorting_values(ident:str): ...

    def to_dict(self) -> Dict[str, Any]: ...

    def write(self, fw:IO[Any]): ...

    def get_group_name(self) -> str: ...

    def get_version(self) -> int: ...
