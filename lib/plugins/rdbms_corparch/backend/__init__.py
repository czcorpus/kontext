# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import List, Any, Tuple, Dict, Optional
from .input import InstallJson

import os
import logging
from collections import OrderedDict
from plugins.abstract.corparch import DefaultManateeCorpusInfo
from corplib.fallback import EmptyCorpus
import manatee


class InstallCorpusInfo(object):
    """
    Provides specific information required
    when installing a new corpus to a corparch
    database.
    """

    def __init__(self, reg_path: str) -> None:
        self._reg_path: str = reg_path

    def get_corpus_size(self, corp_id: str) -> int:
        c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
        return c.size()

    def get_corpus_name(self, corp_id: str) -> Optional[str]:
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('NAME').decode(self.get_corpus_encoding(corp_id))
        except:
            return None

    def get_corpus_description(self, corp_id: str) -> Optional[str]:
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('INFO').decode(self.get_corpus_encoding(corp_id))
        except:
            return None

    def get_corpus_encoding(self, corp_id: str) -> Optional[str]:
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('ENCODING')
        except:
            return None

    def get_data_path(self, corp_id: str) -> Optional[str]:
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('PATH').rstrip('/')
        except Exception as ex:
            logging.getLogger(__name__).warning(ex)
            return None
