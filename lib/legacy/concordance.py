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


def _set_qtype_q(data, sid, value):
    data['curr_query_types'][sid] = value


def _set_qtype_f(data, sid, value):
    data['query_type'] = value


def _get_query_q(data, sid):
    return data['curr_queries'][sid]


def _get_query_f(data, sid):
    return data['query']


def _set_query_q(data, sid,  value):
    data['curr_queries'][sid] = value


def _set_query_f(data, sid, value):
    data['query'] = value


def _set_regexp_q(data, sid, value):
    data['curr_use_regexp_values'][sid] = value


def _set_regexp_f(data, sid, value):
    data['use_regexp'] = value


def _set_nop(data, sid, value):
    pass


def _get_nop(data, sid):
    return None


def upgrade_stored_record(attrs: Dict[str, Any], avail_posattrs: List[str]) -> Dict[str, Any]:
    """
    Upgrade a legacy concordance operations record stored by KonText < 0.15.x
    """
    attrs = defaultdict(lambda: {}, attrs)
    upgraded = False
    form_type = attrs.get('form_type', None)

    if form_type == 'query':
        set_qtype = _set_qtype_q
        get_query = _get_query_q
        set_query = _set_query_q
        set_regexp = _set_regexp_q
        q_data = attrs['curr_query_types']
    elif form_type == 'filter':
        set_qtype = _set_qtype_f
        get_query = _get_query_f
        set_query = _set_query_f
        set_regexp = _set_regexp_f
        q_data = {'--': attrs.get('query_type')}
    else:
        set_qtype = _set_nop
        get_query = _get_nop
        set_query = _set_nop
        set_regexp = _set_nop
        q_data = {}

    for source_id, legacy_qt in q_data.items():
        if legacy_qt == 'cql':
            set_qtype(attrs, source_id, f'advanced')
            upgraded = True
        elif legacy_qt == 'lemma':
            set_qtype(attrs, source_id, 'advanced')
            set_query(attrs, source_id, '[lemma="{}"]'.format(get_query(attrs, source_id)))
            upgraded = True
        elif legacy_qt in ('phrase', 'word'):
            set_qtype(attrs, source_id, 'advanced')
            set_regexp(attrs, source_id, True)
            upgraded = True
        elif legacy_qt == 'iquery':
            set_qtype(attrs, source_id, 'advanced')
            if 'lc' in avail_posattrs:
                if 'lemma_lc' in avail_posattrs:
                    set_query(attrs, source_id, '[lc="{q}"|lemma_lc="{q}"]'.format(
                              q=get_query(attrs, source_id)))
                elif 'lemma' in avail_posattrs:
                    set_query(attrs, source_id, '[lc="{q}"|lemma="(?i){q}"]'.format(
                              q=get_query(attrs, source_id)))
                else:
                    set_query(attrs, source_id, '[lc="{}"]'.format(attrs['curr_queries'][source_id]))
            else:
                if 'lemma' in avail_posattrs:
                    set_query(attrs, source_id, '[word="(?i){q}" | lemma="(?i){q}"]'.format(
                              q=get_query(attrs, source_id)))
                else:
                    set_query(attrs, source_id, '[word="(?i){}"]'.format(get_query(attrs, source_id)))
            upgraded = True
        if upgraded:
            logging.getLogger(__name__).info('Upgraded legacy concordance record')
    return dict(attrs)
