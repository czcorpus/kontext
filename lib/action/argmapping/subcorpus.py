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

from typing import List
from dataclasses import dataclass
from corplib.subcorpus import WithinType, TextTypesType


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
    """
    text_types: TextTypesType


@dataclass
class CreateSubcorpusWithinArgs(_SubcGenerateArgsBase):
    """
    CreateSubcorpusWithinArgs specifies a subc. creation request
    with individual "within" conditions written as CQL expressions.
    This way of subc. specifying sits between
    user-friendly CreateSubcorpusArgs and low-level CreateSubcorpusRawCQLArgs.
    """

    within: WithinType

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