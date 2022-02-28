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

from typing import List, Dict, Any, IO, Optional, Tuple, Mapping
import manatee
import json
import re
import os
from dataclasses import dataclass, field


class _InstallJsonMetadata(object):

    def __init__(self) -> None:
        self.database: Optional[str] = None
        self.label_attr: Optional[str] = None
        self.id_attr: Optional[str] = None
        self.desc: Optional[int] = None
        self.keywords: List[str] = []
        self.featured: bool = False
        self.default_virt_keyboard: Optional[str] = None

    def update(self, data: Mapping[str, Any]) -> None:
        for attr in list(self.__dict__.keys()):
            if attr == 'featured':
                self.featured = bool(data.get('featured', []))
            else:
                setattr(self, attr, data.get(attr, None))


class _InstallJsonReference(object):

    def __init__(self) -> None:
        self.default: Optional[str] = None
        self.articles: List[str] = []
        self.other_bibliography: Optional[str] = None

    def update(self, data: Mapping[str, Any]) -> None:
        self.default = data.get('default', None)
        self.articles = data.get('articles', [])
        self.other_bibliography = data.get('other_bibliography', None)


@dataclass
class InstallJson:
    """
    InstallJson represents a model for
    a corpus installation JSON file used
    to add new (or replace existing) corpus
    to KonText. It is basically derived
    from default_corparch XML schema.
    """
    ident: Optional[str] = None
    sentence_struct: Optional[str] = None
    tagset: Optional[str] = None
    web: Optional[str] = None
    collator_locale: Optional[str] = None
    speech_segment: Optional[str] = None
    speaker_id_attr: Optional[str] = None
    speech_overlap_attr: Optional[str] = None
    speech_overlap_val: Optional[str] = None
    use_safe_font: bool = False
    metadata: _InstallJsonMetadata = _InstallJsonMetadata()
    reference: _InstallJsonReference = _InstallJsonReference()
    token_connect: List[str] = field(default_factory=list)
    kwic_connect: List[str] = field(default_factory=list)

    @staticmethod
    def create_sorting_values(ident: str) -> Tuple[str, int]:
        srch = re.match(r'(?i)^intercorp(_v(\d+))?_\w+$', ident)
        if srch:
            if srch.groups()[0]:
                return 'intercorp', int(srch.groups()[1])
            else:
                return 'intercorp', 6

        srch = re.match(r'(?i)^oral_v(\d+)$', ident)
        if srch:
            return 'oral', int(srch.groups()[0])

        srch = re.match(r'(?i)^oral(\d{4})$', ident)
        if srch:
            return 'oral', int(srch.groups()[0]) - 3000
        return ident, 1

    def update(self, fr: IO):
        data = json.load(fr)
        for attr in list(self.__dict__.keys()):
            if attr == 'metadata':
                self.metadata.update(data.get(attr, {}))
            elif attr == 'reference':
                self.reference.update(data.get(attr, {}))
                pass
            else:
                setattr(self, attr, data.get(attr, None))

    def to_dict(self) -> Dict[str, Any]:
        if self.ident is None:
            raise RuntimeError('Identificator is None')

        ans = {}
        ans.update(self.__dict__)
        ans['group_name'], ans['version'] = self.create_sorting_values(self.ident)
        ans['metadata'] = {}
        ans['metadata'].update(self.metadata.__dict__)
        ans['reference'] = {}
        ans['reference'].update(self.reference.__dict__)
        return ans

    def get_group_name(self) -> str:
        if self.ident is None:
            raise RuntimeError('Identificator is None')

        ans, _ = self.create_sorting_values(self.ident)
        return ans

    def get_version(self) -> int:
        if self.ident is None:
            raise RuntimeError('Identificator is None')

        _, ans = self.create_sorting_values(self.ident)
        return ans

    def write(self, fw: IO):
        return json.dump(self.to_dict(), fw, indent=4)


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
