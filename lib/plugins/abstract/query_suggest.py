# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
"""

import abc
from typing import List, Dict, Any


class AbstractQuerySuggest(abc.ABC):

    @abc.abstractmethod
    def find_suggestions(self, ui_lang: str, corpora: List[str], subcorpus: str, query: str, p_attr: str, struct: str,
                         s_attr: str):
        pass


class AbstractBackend(abc.ABC):

    def __init__(self, ident):
        self._ident = ident

    @abc.abstractmethod
    def find_suggestion(self, ui_lang: str, corpora: List[str], subcorpus: str, query: str, p_attr: str, struct: str, s_attr: str):
        pass


class Response(object):
    """
    A response as returned by server-side frontend (where server-side
    frontend receives data from backend).
    """

    def __init__(self, contents: str, renderer: str, heading: str) -> None:
        """
        """
        self.contents: str = contents
        self.renderer: str = renderer
        self.heading: str = heading

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__


class AbstractFrontend(abc.ABC):

    def __init__(self, conf):
        pass

    @abc.abstractmethod
    def export_data(self, ui_lang, data: Response):
        return Response(contents='', renderer='', heading='')


class BackendException(Exception):
    pass
