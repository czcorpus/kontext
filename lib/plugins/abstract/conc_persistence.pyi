# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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
from typing import Dict, Optional, Tuple, Any

class AbstractConcPersistence(abc.ABC):

    def is_valid_id(self, data_id:str) -> bool: ...

    def get_conc_ttl_days(self, user_id:int) -> int: ...

    def open(self, data_id:str) -> Dict: ...

    def store(self, user_id:int, curr_data:Dict, prev_data:Optional[Dict]) -> str: ...

    def archive(self, user_id:int, conc_id:str, revoke:Optional[bool]) -> Tuple[int, Dict[str, Any]]: ...

    def is_archived(self, conc_id:str) -> bool: ...

