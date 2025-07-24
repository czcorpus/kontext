# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

from typing import Union


class UserReadableException(Exception):
    """
    This exception covers general errors occurring in Controller's action methods
    as a result of user action (e.g. user sends incorrect arguments, user does
    not have access rights etc.).

    args - additional positional arguments that will be also stored in self.args

    IMPORTANT
    self.args need to reflect error initializer positional arguments!!!
    so error can be rebuilt from Rq result
    """

    def __init__(self, message: Union[str, Exception], *args, code=400, error_code=None, error_args=None, internal_message=None):
        super().__init__(message if type(message) is str else str(message), *args)
        self.code = code
        self.error_code = error_code
        self.error_args = error_args
        self._message = str(message)
        self._internal_message = internal_message

    def __repr__(self):
        return f'UserReadableException, code: {self.code}, message: {self._message if len(self._message) > 0 else "--"}'

    def __str__(self):
        return self._message

    @property
    def internal_message(self):
        return self._internal_message if self._internal_message else str(self)


class BackgroundCalculationException(UserReadableException):

    def __init__(self, message, internal_message=None):
        super().__init__(message, code=500, internal_message=internal_message)


class NotFoundException(UserReadableException):
    """
    Raised in case user requests non-exposed/non-existing action
    """

    def __init__(self, message, internal_message=None):
        super().__init__(message, code=404, internal_message=internal_message)


class UnavailableForLegalReasons(UserReadableException):
    """
    Raised in case response could be used to violate legal arangements, eg. copyright
    """

    def __init__(self, message, internal_message=None):
        super().__init__(message, code=451, internal_message=internal_message)


class ForbiddenException(UserReadableException):
    """
    Raised in case user access is forbidden
    """

    def __init__(self, message, internal_message=None):
        super().__init__(message, code=403, internal_message=internal_message)


class CorpusNotFoundException(UserReadableException):

    def __init__(self, message, internal_message=None):
        super().__init__(message, code=404, internal_message=internal_message)


class CorpusForbiddenException(ForbiddenException):
    def __init__(self, corpname, variant):
        super().__init__('No access to corpus {0}'.format(corpname), corpname)
        self.corpname = corpname
        self.variant = variant
        # args need to reflect positional arguments of constructor
        # so error can be rebuilt from Rq result
        self.args = (corpname, variant)


class AlignedCorpusForbiddenException(ForbiddenException):

    def __init__(self, corpname, variant):
        super().__init__('No access to corpus {0}'.format(corpname), corpname)
        self.corpname = corpname
        self.variant = variant
        # args need to reflect positional arguments of constructor
        # so error can be rebuilt from Rq result
        self.args = (corpname, variant)


class ServiceUnavailableException(UserReadableException):

    def __init__(self, message, internal_message=None):
        super().__init__(message, code=503, internal_message=internal_message)


class ImmediateRedirectException(Exception):
    """
    ImmediateRedirectException is used to trigger
    an immediate request response with http headers
    set to redirect.

    It can be used in pre_dispatch or in a concrete
    action.
    """

    def __init__(self, url, code=303):
        super().__init__('Redirect')
        self._url = url
        self._code = code

    @property
    def url(self):
        return self._url

    @property
    def code(self):
        return self._code


class FunctionNotSupported(Exception):
    """
    In case a function is invoked on a corpus which does not support it
    this exception should be used.
    """
    pass
