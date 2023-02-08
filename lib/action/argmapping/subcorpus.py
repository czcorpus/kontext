# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
This module contains dataclasses for requests specifying
a subcorpus in different ways
"""

from dataclasses import dataclass
from typing import List, Optional

from corplib.subcorpus import TextTypesType, WithinType


@dataclass
class _SubcGenerateArgsBase:
    corpname: str
    subcname: str
    description: str
    aligned_corpora: List[str]
    form_type: str

    def has_aligned_corpora(self):
        return len(self.aligned_corpora) > 0 if type(self.aligned_corpora) is list else False


@dataclass
class CreateSubcorpusArgs(_SubcGenerateArgsBase):
    """
    CreateSubcorpusArgs specifies a subc. creation request with
    individually selected values for different structural attributes.

    Attributes:
        text_types: a serialized text types form (= individually selected
            values for various text type attributes)
        text_types_cql: a CQL representation of the selection in 'text_types'

    """

    text_types: TextTypesType

    text_types_cql: Optional[str] = None

    usesubcorp: Optional[str] = None

    size: Optional[int] = 0
    """
    the 'size' argument is used to provide an informative value when storing a draft subcorpus; 
    i.e. it has no effect on actual subcorpus size
    """


@dataclass
class CreateSubcorpusWithinArgs(_SubcGenerateArgsBase):
    """
    CreateSubcorpusWithinArgs specifies a subc. creation request
    with individual "within" conditions written as CQL expressions.
    This way of subc. specifying sits between
    user-friendly CreateSubcorpusArgs and low-level CreateSubcorpusRawCQLArgs.
    """

    within: WithinType
    usesubcorp: Optional[str] = None

    def deserialize(self) -> str:
        """
         return this.lines.filter((v)=>v != null).map(
            (v:WithinLine) => (
                (v.negated ? '!within' : 'within') + ' <' + v.structureName
                    + ' ' + v.attributeCql + ' />')
        ).join(' ');
        }
        """
        return ' '.join([('!within' if item['negated'] else 'within') + ' <%s %s />' % (
            item['structure_name'], item['attribute_cql']) for item in [item for item in self.within if bool(item)]])


@dataclass
class CreateSubcorpusRawCQLArgs(_SubcGenerateArgsBase):
    """
    CreateSubcorpusRawCQLArgs speicifes a subc. creation request
    as a single CQL expression. Currently, this is only for
    backward compatibility.
    """
    cql: str
