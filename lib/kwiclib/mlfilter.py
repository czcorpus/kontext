# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2022 Martin Zimandl <martin.zimandlk@gmail.com>
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

import re

from plugin_types.corparch.corpus import MLPositionFilter


def ml_filter_test(word: str, fltr: MLPositionFilter) -> bool:
    """
    ml_filter_test tests whether provided 'word' passes as a "matching position"
    when creating two (or more) sentences (or other structures) with
    words 1
    """
    if fltr == MLPositionFilter.none:
        return True
    elif fltr == MLPositionFilter.alphanum:
        return re.match(r'\w+', word) is not None
