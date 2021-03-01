# Copyright(c) 2021 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

from argmapping.pquery import PqueryFormArgs
import plugins
from plugins.abstract.conc_persistence.common import generate_idempotent_hex_id
from typing import Union, Dict


class Storage:

    def _mk_key(self, data):
        return generate_idempotent_hex_id(data)

    def save(self, data: PqueryFormArgs) -> str:
        with plugins.runtime.DB as db:
            raw_data = data.to_dict()
            key = self._mk_key(raw_data)
            db.set('pquery:{}'.format(key), raw_data)
            #  if not self.user_is_anonymous(): TODO TTL
            return key

    def load(self, query_id: str) -> Union[Dict, None]:
        with plugins.runtime.DB as db:
            return db.get('pquery:{}'.format(query_id))
