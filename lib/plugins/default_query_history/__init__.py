# Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

from datetime import datetime
import time
import random
import logging

from plugins.abstract.query_history import AbstractQueryHistory
from plugins import inject
import plugins
from manatee import Corpus
from corplib.fallback import EmptyCorpus


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

    def __init__(self, conf, db, query_persistence, auth):
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
        self.db = db
        self._query_persistence = query_persistence
        self._auth = auth
        self._page_num_records = int(conf.get('plugins', 'query_history')['page_num_records'])

    def _current_timestamp(self):
        return int(time.time())

    def _mk_key(self, user_id):
        return f'query_history:user:{user_id}'

    def _mk_tmp_key(self, user_id):
        return f'query_history:user:{user_id}:new'

    def store(self, user_id, query_id, q_supertype):
        """
        stores information about a query; from time
        to time also check remove too old records

        arguments:
        see the super class
        """
        ts = self._current_timestamp()
        item = dict(created=ts, query_id=query_id, name=None, q_supertype=q_supertype)
        self.db.list_append(self._mk_key(user_id), item)
        if random.random() < QueryHistory.PROB_DELETE_OLD_RECORDS:
            self.delete_old_records(user_id)
        return ts

    def make_persistent(self, user_id, query_id, created, name):
        k = self._mk_key(user_id)
        data = self.db.list_get(k)
        last_match_idx = -1
        for i, item in enumerate(data):
            if item.get('query_id') == query_id:
                last_match_idx = i
                if item.get('created') == created:
                    break
        if last_match_idx > -1:
            data[last_match_idx]['name'] = name
            self.db.list_set(k, last_match_idx, data[last_match_idx])
            self._query_persistence.archive(user_id, query_id)
            return True
        return False

    def make_transient(self, user_id, query_id, created, name):
        k = self._mk_key(user_id)
        data = self.db.list_get(k)
        for i, item in enumerate(data):
            if item.get('query_id', None) == query_id and item.get('created') == created and item.get('name') == name:
                item['name'] = None
                self.db.list_set(k, i, item)
                return True
        return False

    def delete(self, user_id, query_id, created):
        k = self._mk_key(user_id)
        data = self.db.list_get(k)
        self.db.remove(k)
        deleted = 0
        for item in data:
            if item.get('query_id') != query_id or item.get('created', 0) != created:
                self.db.list_append(k, item)
            else:
                deleted += 1
        return deleted

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
        def matches_corp_prop(data, prop_name, value):
            if data.get(prop_name, None) == value:
                return True
            for aligned in data.get('aligned', []):
                if aligned[prop_name] == value:
                    return True
            return False

        data = self.db.list_get(self._mk_key(user_id))
        if limit is None:
            limit = len(data)
        data = list(reversed(data))[offset:(offset + limit)]
        full_data = []

        corpora = CorpusCache(corpus_manager)
        for item in data:
            if 'query_id' in item:
                item_qs = item.get('q_supertype', item.get('qtype'))
                item['q_supertype'] = item_qs  # upgrade possible deprecated qtype
                if item_qs is None or item_qs == 'conc':
                    tmp = self._merge_conc_data(item)
                    if not tmp:
                        continue
                    tmp['human_corpname'] = corpora.corpus(tmp['corpname']).get_conf('NAME')
                    for ac in tmp['aligned']:
                        ac['human_corpname'] = corpora.corpus(ac['corpname']).get_conf('NAME')
                    full_data.append(tmp)
                elif item_qs == 'pquery':
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
                elif item_qs == 'wlist':
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
                # deprecated type of record (this will vanish soon as there
                # are no persistent history records based on the old format)
                tmp = {}
                tmp.update(item)
                tmp['default_attr'] = None
                tmp['lpos'] = None
                tmp['qmcase'] = None
                tmp['pcq_pos_neg'] = None
                tmp['include_empty'] = None
                tmp['selected_text_types'] = {}
                tmp['aligned'] = []
                tmp['name'] = None
                full_data.append(tmp)

        if from_date:
            from_date = [int(d) for d in from_date.split('-')]
            from_date = time.mktime(
                datetime(from_date[0], from_date[1], from_date[2], 0, 0, 0).timetuple())
            full_data = [x for x in full_data if x['created'] >= from_date]

        if to_date:
            to_date = [int(d) for d in to_date.split('-')]
            to_date = time.mktime(
                datetime(to_date[0], to_date[1], to_date[2], 23, 59, 59).timetuple())
            full_data = [x for x in full_data if x['created'] <= to_date]

        if q_supertype:
            full_data = [x for x in full_data if x.get('q_supertype') == q_supertype]

        if corpname:
            full_data = [x for x in full_data if matches_corp_prop(
                x, 'corpname', corpname)]

        if archived_only:
            full_data = [x for x in full_data if x.get('name', None) is not None]

        for i, item in enumerate(full_data):
            item['idx'] = offset + i

        return full_data

    def delete_old_records(self, user_id):
        """
        Deletes records older than ttl_days. Named records are
        kept intact.
        """
        data_key = self._mk_key(user_id)
        curr_data = self.db.list_get(data_key)
        tmp_key = self._mk_tmp_key(user_id)
        self.db.remove(tmp_key)
        curr_time = time.time()
        new_list = []
        for item in curr_data:
            if item.get('name', None) is not None:
                if self._is_paired_with_conc(item):
                    new_list.append(item)
                else:
                    logging.getLogger(__name__).warning(
                        'Removed unpaired named query {0} of concordance {1}.'.format(item['name'],
                                                                                      item['query_id']))
            elif int(curr_time - item.get('created', 0)) / 86400 < self.ttl_days:
                new_list.append(item)
        for item in new_list:
            self.db.list_append(tmp_key, item)
        self.db.rename(tmp_key, data_key)

    def export(self, plugin_ctx):
        return {'page_num_records': self._page_num_records}


@inject(plugins.runtime.DB, plugins.runtime.QUERY_PERSISTENCE, plugins.runtime.AUTH)
def create_instance(settings, db, query_persistence, auth):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    return QueryHistory(settings, db, query_persistence, auth)
