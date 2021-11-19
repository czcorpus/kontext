# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

"""
A plugin providing a history for user's queries for services such as 'query history'.

Required config.xml/plugins entries: please see config.rng
"""

from datetime import datetime, timedelta
import random
import logging
from plugins.abstract.auth import AbstractAuth
from plugins.abstract.integration_db import IntegrationDatabase

from plugins.abstract.query_history import AbstractQueryHistory
from plugins import inject
import plugins
from manatee import Corpus
from corplib.fallback import EmptyCorpus
from plugins.abstract.query_persistence import AbstractQueryPersistence


class CorpusCache:

    def __init__(self, corpus_manager):
        self._cm = corpus_manager
        self._corpora = {}

    def corpus(self, cname: str) -> Corpus:
        if not cname:
            return EmptyCorpus()
        if cname not in self._corpora:
            self._corpora[cname] = self._cm.get_corpus(cname)
        return self._corpora[cname]


class QueryHistory(AbstractQueryHistory):

    # we define a 10% chance that on write there will be a check for old records
    PROB_DELETE_OLD_RECORDS = 0.1

    DEFAULT_TTL_DAYS = 10

    TABLE_NAME = 'kontext_query_history'

    def __init__(self, conf, db: IntegrationDatabase, query_persistence: AbstractQueryPersistence, auth: AbstractAuth):
        """
        arguments:
        conf -- the 'settings' module (or some compatible object)
        db -- default_db history backend
        """
        tmp = conf.get('plugins', 'query_history').get('ttl_days', None)
        if tmp:
            self.ttl_days = int(tmp)
        else:
            self.ttl_days = self.DEFAULT_TTL_DAYS
            logging.getLogger(__name__).warning(
                'QueryHistory - ttl_days not set, using default value {0} day(s) for query history records'.format(
                    self.ttl_days))
        self._db = db
        self._query_persistence = query_persistence
        self._auth = auth
        self._page_num_records = int(conf.get('plugins', 'query_history')['page_num_records'])

    def _store(self, user_id, query_id, q_supertype, name):
        created = datetime.now()
        corpora = self._query_persistence.open(query_id)['corpora']
        cursor = self._db.cursor()
        cursor.executemany(
            f'INSERT IGNORE INTO {self.TABLE_NAME} (corpus_name, query_id, user_id, q_supertype, created, name) VALUES (%s, %s, %s, %s, %s, %s)',
            [(corpus, query_id, user_id, q_supertype, created, name) for corpus in corpora]
        )
        return created.timestamp()

    def store(self, user_id, query_id, q_supertype):
        """
        stores information about a query; from time
        to time also check remove too old records
        arguments:
        see the super class
        """
        created = self._store(user_id, query_id, q_supertype, None)
        if random.random() < QueryHistory.PROB_DELETE_OLD_RECORDS:  # TODO make rq schduler task
            self.delete_old_records(user_id)
        return created

    def _update_name(self, user_id, query_id, created, name, new_name) -> bool:
        cursor = self._db.cursor()
        cursor.execute(
            f'UPDATE {self.TABLE_NAME} SET name = %s WHERE user_id = %s AND query_id = %s AND created = %s AND name = %s',
            (new_name, user_id, query_id, created, name)
        )
        self._db.commit()
        return cursor.rowcount > 0

    def make_persistent(self, user_id, query_id, q_supertype, created, name) -> bool:
        if self._update_name(user_id, query_id, datetime.fromtimestamp(created), None, name):
            self._query_persistence.archive(user_id, query_id)
        else:
            self.store(user_id, query_id, q_supertype, name)
        return True

    def make_transient(self, user_id, query_id, created, name) -> bool:
        return self._update_name(user_id, query_id, datetime.fromtimestamp(created), name, None)

    def delete(self, user_id, query_id, created):
        cursor = self._db.cursor()
        cursor.execute(
            f'DELETE FROM {self.TABLE_NAME} WHERE user_id = %s AND query_id = %s AND created = %s',
            (user_id, query_id, datetime.fromtimestamp(created))
        )
        self._db.commit()
        return cursor.rowcount

    def _is_paired_with_conc(self, data) -> bool:
        q_id = data['query_id']
        return self._query_persistence.open(q_id) is not None

    def _merge_conc_data(self, data):
        q_id = data['query_id']
        edata = self._query_persistence.open(q_id)

        def get_ac_val(data, name, corp): return data[name][corp] if name in data else None

        if edata and 'lastop_form' in edata:
            ans = {}
            ans.update(data)
            form_data = edata['lastop_form']
            main_corp = edata['corpora'][0]
            if form_data['form_type'] == 'query':
                ans['query_type'] = form_data['curr_query_types'][main_corp]
                ans['query'] = form_data['curr_queries'][main_corp]
                ans['corpname'] = main_corp
                ans['subcorpname'] = edata['usesubcorp']
                ans['default_attr'] = form_data['curr_default_attr_values'][main_corp]
                ans['lpos'] = form_data['curr_lpos_values'][main_corp]
                ans['qmcase'] = form_data['curr_qmcase_values'][main_corp]
                ans['pcq_pos_neg'] = form_data['curr_pcq_pos_neg_values'][main_corp]
                ans['selected_text_types'] = form_data.get('selected_text_types', {})
                ans['aligned'] = []
                for aitem in edata['corpora'][1:]:
                    ans['aligned'].append(dict(corpname=aitem,
                                               query=form_data['curr_queries'].get(aitem),
                                               query_type=form_data['curr_query_types'].get(aitem),
                                               default_attr=form_data['curr_default_attr_values'].get(
                                                   aitem),
                                               lpos=form_data['curr_lpos_values'].get(aitem),
                                               qmcase=form_data['curr_qmcase_values'].get(aitem),
                                               pcq_pos_neg=form_data['curr_pcq_pos_neg_values'].get(
                                                   aitem),
                                               include_empty=get_ac_val(form_data, 'curr_include_empty_values', aitem)))
            elif form_data['form_type'] == 'filter':
                ans.update(form_data)
                ans['corpname'] = main_corp
                ans['subcorpname'] = edata['usesubcorp']
                ans['aligned'] = []
                ans['selected_text_types'] = {}
            return ans
        else:
            return None   # persistent result not available

    def get_user_queries(self, user_id, corpus_manager, from_date=None, to_date=None, q_supertype=None, corpname=None,
                         archived_only=False, offset=0, limit=None):
        """
        Returns list of queries of a specific user.

        arguments:
        see the super-class
        """

        where_dict = {
            'user_id = %s': user_id,
            'created >= %s': from_date if from_date else None,
            'created <= %s': to_date if to_date else None,
            'q_supertype = %s': q_supertype,
            'corpus_name = %s': corpname,
        }
        where_sql = [k for k, v in where_dict.items() if v is not None]
        values = [v for v in where_dict.values() if v is not None]
        if archived_only:
            where_sql.append('name IS NOT NULL')
        if limit is not None:
            values.append(limit)
        if offset:
            values.append(offset)

        cursor = self._db.cursor()
        cursor.execute(f'''
            SELECT DISTINCT query_id, created, name, q_supertype FROM {self.TABLE_NAME} WHERE
            {' AND '.join(where_sql)}
            ORDER BY created DESC
            {'LIMIT %s' if limit is not None else ''}
            {'OFFSET %s' if offset else ''}
        ''', values)

        full_data = []
        corpora = CorpusCache(corpus_manager)
        for item in cursor:
            q_supertype = item['q_supertype']
            if q_supertype == 'conc':
                tmp = self._merge_conc_data(item)
                if not tmp:
                    continue
                tmp['human_corpname'] = corpora.corpus(tmp['corpname']).get_conf('NAME')
                for ac in tmp['aligned']:
                    ac['human_corpname'] = corpora.corpus(ac['corpname']).get_conf('NAME')
                full_data.append(tmp)
            elif q_supertype == 'pquery':
                stored = self._query_persistence.open(item['query_id'])
                if not stored:
                    continue
                tmp = {'corpname': stored['corpora'][0], 'aligned': []}
                tmp['human_corpname'] = corpora.corpus(tmp['corpname']).get_conf('NAME')
                q_join = []

                for q in stored.get('form', {}).get('conc_ids', []):
                    stored_q = self._query_persistence.open(q)
                    if stored_q is None:
                        logging.getLogger(__name__).warning(
                            'Missing conc for pquery: {}'.format(q))
                    else:
                        for qs in stored_q.get('lastop_form', {}).get('curr_queries', {}).values():
                            q_join.append(f'{{ {qs} }}')
                q_subset = stored.get('form', {}).get('conc_subset_complements', None)
                if q_subset is not None:
                    for q in q_subset.get('conc_ids', []):
                        max_ratio = q_subset.get('max_non_matching_ratio', 0)
                        stored_q = self._query_persistence.open(q)
                        if stored_q is None or 'query' not in stored_q.get('lastop_form', {}).get('form_type'):
                            logging.getLogger(__name__).warning(
                                'Missing conc for pquery subset: {}'.format(q))
                        else:
                            query = stored_q['lastop_form']['curr_queries'][tmp['corpname']]
                            q_join.append(f'!{max_ratio if max_ratio else ""}{{ {query} }}')

                q_superset = stored.get('form', {}).get('conc_superset', None)
                if q_superset is not None:
                    max_ratio = q_superset.get('max_non_matching_ratio', 0)
                    stored_q = self._query_persistence.open(q_superset['conc_id'])
                    if stored_q is None or 'query' not in stored_q.get('lastop_form', {}).get('form_type'):
                        logging.getLogger(__name__).warning(
                            'Missing conc for pquery superset: {}'.format(q_superset['conc_id']))
                    else:
                        query = stored_q['lastop_form']['curr_queries'][tmp['corpname']]
                        q_join.append(f'?{max_ratio if max_ratio else ""}{{ {query} }}')

                tmp['query'] = ' && '.join(q_join)
                tmp.update(item)
                tmp.update(stored)
                full_data.append(tmp)
            elif q_supertype == 'wlist':
                stored = self._query_persistence.open(item['query_id'])
                if not stored:
                    continue
                tmp = dict(
                    corpname=stored['corpora'][0],
                    aligned=[],
                    human_corpname=corpora.corpus(stored['corpora'][0]).get_conf('NAME'),
                    query=stored.get('form', {}).get('wlpat'),
                    pfilter_words=stored['form']['pfilter_words'],
                    nfilter_words=stored['form']['nfilter_words'])
                tmp.update(item)
                tmp.update(stored)
                full_data.append(tmp)
            else:
                raise ValueError('Unknown query supertype: ', q_supertype)

        for i, item in enumerate(full_data):
            item['created'] = item['created'].timestamp()
            item['idx'] = offset + i

        return full_data

    def delete_old_records(self, user_id):
        """
        Deletes records older than ttl_days. Named records are
        kept intact.
        """
        # TODO remove also named but unpaired history entries
        cursor = self._db.cursor()
        cursor.execute(
            f'DELETE FROM {self.TABLE_NAME} WHERE user_id = %s AND created < %s AND name IS NOT NULL',
            (user_id, datetime.now() - timedelta(days=self.ttl_days))
        )
        self._db.commit()

    def export(self, plugin_ctx):
        return {'page_num_records': self._page_num_records}


@inject(plugins.runtime.INTEGRATION_DB, plugins.runtime.QUERY_PERSISTENCE, plugins.runtime.AUTH)
def create_instance(settings, db, query_persistence, auth):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    return QueryHistory(settings, db, query_persistence, auth)
