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

from typing import Dict, Any, List
from collections import defaultdict
import logging


def nop_upgrade_stored_record(attrs: Dict[str, Any], avail_posattrs: List[str]) -> Dict[str, Any]:
    """
    This is a no-operation version of conc persistence record upgrade which
    is used by default.
    """
    return attrs


def upgrade_stored_record(attrs: Dict[str, Any], avail_posattrs: List[str]) -> Dict[str, Any]:
    """
    Upgrade a legacy concordance operations record stored by KonText < 0.15.x
    """
    attrs = defaultdict(lambda: {}, attrs)
    upgraded = False
    for source_id, legacy_qt in attrs['curr_query_types'].items():
        if legacy_qt == 'cql':
            attrs['curr_query_types'][source_id] = 'advanced'
            upgraded = True
        elif legacy_qt == 'lemma':
            attrs['curr_query_types'][source_id] = 'advanced'
            attrs['curr_queries'][source_id] = '[lemma="{}"]'.format(attrs['curr_queries'][source_id])
            upgraded = True
        elif legacy_qt in ('phrase', 'word'):
            attrs['curr_query_types'][source_id] = 'advanced'
            attrs['curr_use_regexp_values'][source_id] = True
            upgraded = True
        elif legacy_qt == 'iquery':
            attrs['curr_query_types'][source_id] = 'advanced'
            if 'lc' in avail_posattrs:
                if 'lemma_lc' in avail_posattrs:
                    attrs['curr_queries'][source_id] = '[lc="{q}"|lemma_lc="{q}"]'.format(
                        q=attrs['curr_queries'][source_id])
                elif 'lemma' in avail_posattrs:
                    attrs['curr_queries'][source_id] = '[lc="{q}"|lemma="(?i){q}"]'.format(
                        q=attrs['curr_queries'][source_id])
                else:
                    attrs['curr_queries'][source_id] = '[lc="{}"]'.format(attrs['curr_queries'][source_id])
            else:
                if 'lemma' in avail_posattrs:
                    attrs['curr_queries'][source_id] = '[word="(?i){q}" | lemma="(?i){q}"]'.format(
                        q=attrs['curr_queries'][source_id])
                else:
                    attrs['curr_queries'][source_id] = '[word="(?i){}"]'.format(attrs['curr_queries'][source_id])
            upgraded = True
        if upgraded:
            logging.getLogger(__name__).info('Upgraded legacy concordance record')
    return dict(attrs)
