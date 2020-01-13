# Copyright(c) 2017 Charles University in Prague, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2017 Tomas Machalek <tomas.machalek @ gmail.com>
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

from typing import Dict, Any, Optional, Callable, List
from controller.kontext import Kontext
from argmapping.query import ConcFormArgs
import werkzeug.wrappers

class Querying(Kontext):

    def add_conc_form_args(self, item:ConcFormArgs) -> None: ...

    @staticmethod
    def import_qs(qs:str) -> str: ...

    def ajax_fetch_conc_form_args(self, request:werkzeug.wrappers.Request) -> Dict[str, Any]: ...

    def export_aligned_form_params(self, aligned_corp:str, state_only:bool,
                                   name_filter:Optional[Callable[[str], bool]]) -> Dict[str, Any]: ...

    @staticmethod
    def load_pipeline_ops(last_id:str) -> List[ConcFormArgs]: ...