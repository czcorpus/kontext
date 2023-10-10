# Copyright(c) 2014 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2014 Tomas Machalek <tomas.machalek @ gmail.com>
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

from action.errors import UserReadableException


class MissingSubCorpFreqFile(UserReadableException):
    def __init__(self, message: str | Exception, corpname: str, usesubcorp: str):
        super().__init__(message, corpname, usesubcorp)
        self.corpname = corpname
        self.usesubcorp = usesubcorp


class VirtualSubcFreqFileError(UserReadableException):
    pass


class InvalidSubCorpFreqFileType(UserReadableException):
    pass


class CorpusInstantiationError(UserReadableException):
    pass


class SubcorpusAlreadyExistsError(UserReadableException):
    pass
