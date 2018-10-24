# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

import sys


def get_traceback():
    """
    Returns python-generated traceback information
    """
    import traceback

    err_type, err_value, err_trace = sys.exc_info()
    return traceback.format_exception(err_type, err_value, err_trace)


def fetch_exception_msg(ex):
    msg = getattr(ex, 'message', None)
    if not msg:
        try:
            msg = unicode(ex)
        except:
            msg = '%r' % ex
    if not msg:
        msg = ex.__class__.__name__
    return msg


class FunctionNotSupported(Exception):
    """
    This marks a functionality which is present in bonito-open but not in KonText
    (either temporarily or for good).
    """
    pass


class UserActionException(Exception):
    """
    This exception should cover general errors occurring in Controller's action methods'
    """

    def __init__(self, message, code=400, error_code=None, error_args=None, internal_message=None):
        super(UserActionException, self).__init__(message)
        self.code = code
        self.error_code = error_code
        self.error_args = error_args
        self._internal_message = internal_message

    def __repr__(self):
        return self.message

    def __str__(self):
        return self.message

    @property
    def internal_message(self):
        return self._internal_message if self._internal_message else self.message


class NotFoundException(UserActionException):
    """
    Raised in case user requests non-exposed/non-existing action
    """

    def __init__(self, message, internal_message=None):
        super(NotFoundException, self).__init__(message, 404, internal_message=internal_message)


class ForbiddenException(UserActionException):
    """
    Raised in case user access is forbidden
    """

    def __init__(self, message, internal_message=None):
        super(ForbiddenException, self).__init__(message, 403, internal_message=internal_message)


class CorpusForbiddenException(ForbiddenException):
    def __init__(self, corpname, variant):
        super(CorpusForbiddenException, self).__init__('Access to {0} forbidden'.format(corpname))
        self.corpname = corpname
        self.variant = variant


class AlignedCorpusForbiddenException(ForbiddenException):

    def __init__(self, corpname, variant):
        super(AlignedCorpusForbiddenException, self).__init__(
            'Access to aligned corpus {0} forbidden'.format(corpname))
        self.corpname = corpname
        self.variant = variant


class ImmediateRedirectException(UserActionException):

    def __init__(self, url, code=303):
        super(ImmediateRedirectException, self).__init__('Redirect', code)
        self.url = url
