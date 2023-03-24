# Copyright(c) 2021 Charles University in Prague, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import re
from typing import Optional


class ConcordanceException(Exception):
    pass


class ConcordanceSpecificationError(ConcordanceException):
    pass


class ConcordanceQuerySyntaxError(ConcordanceSpecificationError):
    pass


class ConcordanceQueryParamsError(ConcordanceSpecificationError):
    pass


class EmptyParallelCorporaIntersection(ConcordanceSpecificationError):
    pass


class UnknownConcordanceAction(ConcordanceSpecificationError):
    pass


class ConcCalculationStatusException(ConcordanceException):

    def __init__(self, msg, orig_error=None):
        super(ConcCalculationStatusException, self).__init__('{0}: {1}'.format(msg, orig_error))
        self._orig_error = orig_error

    @property
    def orig_error(self):
        return self._orig_error


class ConcNotFoundException(ConcordanceException):
    pass


class UnreadableConcordanceException(ConcordanceException):
    pass


def extract_manatee_error(err: Exception) -> Optional[ConcordanceException]:
    """
    Test and extract some Manatee errors. If nothing known is found, None
    is returned (In such case the caller should probably provide the original error).
    """
    if isinstance(err, ConcordanceException):
        return err
    msg = str(err)
    if isinstance(err, RuntimeError):
        srch = re.match(r'^.*syntax error,\s*(.+)$', msg)
        if srch:
            return ConcordanceQuerySyntaxError(f'Query syntax error: {srch.group(1)}')
        elif 'AttrNotFound' in msg:
            srch = re.match(r'AttrNotFound \(([^)]+)\)', msg)
            attr = srch.group(1) if srch else '??'
            return ConcordanceQueryParamsError(f'Attribute not found: {attr}')
        else:
            return ConcordanceException(msg)
    return None
