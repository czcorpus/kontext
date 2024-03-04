# Copyright (c) 2014 Charles University, Faculty of Arts,
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

import hashlib
import logging
import uuid
from typing import Any, Dict, Union

import ujson as json
from util import int2chash

PERSIST_LEVEL_KEY = 'persist_level'
USER_ID_KEY = 'user_id'
ID_KEY = 'id'
QUERY_KEY = 'q'

DEFAULT_CONC_ID_LENGTH = 12


def _encode_to_az(hex_num: int) -> str:
    """
    Generates a hash based on md5 but using [a-zA-Z0-9] characters and with
    limited length.

    arguments:ucnk_op_persistence
    s -- a string to be hashed
    min_length -- minimum length of the output hash
    """
    return int2chash(hex_num, DEFAULT_CONC_ID_LENGTH)


def _to_json(data: Dict[str, Any]) -> Union[str, None]:
    try:
        return json.dumps(data)
    except TypeError as ex:
        logging.getLogger(__name__).warning(
            'Failed to encode concordance data to generate a key: {}'.format(ex))
        return None


def generate_uniq_id(_) -> str:
    return _encode_to_az(uuid.uuid1().int)


def generate_idempotent_hex_id(data: Dict[str, Any]) -> str:
    tmp = _to_json(data)
    if tmp:
        return hashlib.md5(tmp.encode('utf-8')).hexdigest()
    else:
        return generate_uniq_id(data)


def generate_idempotent_id(data: Dict[str, Any]) -> str:
    tmp = _to_json(data)
    if tmp:
        return _encode_to_az(int('0x' + hashlib.md5(tmp.encode('utf-8')).hexdigest(), 16))
    else:
        return generate_uniq_id(data)
