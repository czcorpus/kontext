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
A plugin providing a storage for user's queries for services such as 'query history'.

Required config.xml/plugins entries:

element query_storage {
  element module { "default_query_storage" }
  element num_kept_records {
    attribute extension-by { "default" }
    text # how many records to keep stored per user
  }
  element page_num_records {
    attribute extension-by { "default" }
    text # how many records to show in 'recent queries' page
  }
  element page_append_records {
    attribute extension-by { "default" }
    text # how many records to load in case user clicks 'more'
  }
  element clear_async {
    attribute extension-by { "default" }
    "1" | "0" | "true" | "false"  # if true then old records are removed in a separate task
}
"""

from datetime import datetime
import time
import random

from plugins.abstract.query_storage import AbstractQueryStorage
from plugins import inject
import plugins


class QueryStorage(AbstractQueryStorage):

    PROB_DELETE_OLD_RECORDS = 0.2

    CLEANUP_QUEUE_KEY = 'query_history_cleanup_queue'

    def __init__(self, conf, db, conc_persistence, auth):
        """
        arguments:
        conf -- the 'settings' module (or some compatible object)
        db -- default_db storage backend
        """
        tmp = conf.get('plugins', 'query_storage').get('default:num_kept_records', None)
        self._async_cleanup = conf.import_bool(conf.get('plugins', 'query_storage').get('default:async_cleanup', '0'))
        self.num_kept_records = int(tmp) if tmp else 10
        self.db = db
        self._conc_persistence = conc_persistence
        self._auth = auth

    def _current_timestamp(self):
        return int(time.time())

    def _mk_key(self, user_id):
        return 'query_history:user:%d' % user_id

    def _mk_tmp_key(self, user_id):
        return 'query_history:user:%d:new' % user_id

    def write(self, user_id, query_id):
        """
        stores information about a query

        arguments:
        see the super class
        """
        item = dict(created=self._current_timestamp(), query_id=query_id, name=None)
        self.db.list_append(self._mk_key(user_id), item)
        if self._async_cleanup:
            self.db.hash_set(self.CLEANUP_QUEUE_KEY, user_id, int(user_id))
        elif random.random() < QueryStorage.PROB_DELETE_OLD_RECORDS:
            self.delete_old_records(user_id)

    def make_persistent(self, user_id, query_id, name):
        k = self._mk_key(user_id)
        data = self.db.list_get(k)
        for i, item in enumerate(data):
            if item.get('query_id', None) == query_id:
                item['name'] = name
                self.db.list_set(k, i, item)
                return True
        return False

    def delete(self, user_id, query_id):
        k = self._mk_key(user_id)
        data = self.db.list_get(k)
        for i, item in enumerate(data):
            if item.get('query_id', None) == query_id:
                item['name'] = None
                self.db.list_set(k, i, item)
                return True
        return False

    def _merge_conc_data(self, data):
        q_id = data['query_id']
        edata = self._conc_persistence.open(q_id)
        ans = {}
        ans.update(data)

        if edata and 'lastop_form' in edata:
            form_data = edata['lastop_form']
            main_corp = edata['corpora'][0]
            ans['query_type'] = form_data['curr_query_types'][main_corp]
            ans['query'] = form_data['curr_queries'][main_corp]
            ans['corpname'] = main_corp
            ans['canonical_corpus_id'] = self._auth.canonical_corpname(main_corp)
            ans['subcorpname'] = edata['usesubcorp']
            ans['default_attr'] = form_data['curr_default_attr_values'][main_corp]
            ans['lpos'] = form_data['curr_lpos_values'][main_corp]
            ans['qmcase'] = form_data['curr_qmcase_values'][main_corp]
            ans['pcq_pos_neg'] = form_data['curr_pcq_pos_neg_values'][main_corp]
            ans['selected_text_types'] = form_data.get('selected_text_types', {})
            ans['aligned'] = []
            for aitem in edata['corpora'][1:]:
                ans['aligned'].append(dict(corpname=aitem,
                                           canonical_corpus_id=self._auth.canonical_corpname(aitem),
                                           query=form_data['curr_queries'][aitem],
                                           query_type=form_data['curr_query_types'][aitem],
                                           default_attr=form_data['curr_default_attr_values'][aitem],
                                           lpos=form_data['curr_lpos_values'][aitem],
                                           qmcase=form_data['curr_qmcase_values'][aitem],
                                           pcq_pos_neg=form_data['curr_pcq_pos_neg_values'][aitem]))
        return ans

    def get_user_queries(self, user_id, corpus_manager, from_date=None, to_date=None, query_type=None, corpname=None,
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
        full_data = []

        for item in data:
            if 'query_id' in item:
                full_data.append(self._merge_conc_data(item))
            else:
                # deprecated type of record (this will vanish soon as there
                # are no persistent history records based on the old format)
                tmp = {}
                tmp.update(item)
                tmp['canonical_corpus_id'] = self._auth.canonical_corpname(tmp['corpname'])
                tmp['default_attr'] = None
                tmp['lpos'] = None
                tmp['qmcase'] = None
                tmp['pcq_pos_neg'] = None
                tmp['selected_text_types'] = {}
                tmp['aligned'] = []
                tmp['name'] = None
                full_data.append(tmp)

        if from_date:
            from_date = [int(d) for d in from_date.split('-')]
            from_date = time.mktime(datetime(from_date[0], from_date[1], from_date[2], 0, 0, 0).timetuple())
            full_data = filter(lambda x: x['created'] >= from_date, full_data)

        if to_date:
            to_date = [int(d) for d in to_date.split('-')]
            to_date = time.mktime(datetime(to_date[0], to_date[1], to_date[2], 23, 59, 59).timetuple())
            full_data = filter(lambda x: x['created'] <= to_date, full_data)

        if query_type:
            full_data = filter(lambda x: matches_corp_prop(x, 'query_type', query_type), full_data)

        if corpname:
            full_data = filter(lambda x: matches_corp_prop(x, 'canonical_corpus_id', corpname), full_data)

        if archived_only:
            full_data = filter(lambda x: x.get('name', None) is not None, full_data)

        if limit is None:
            limit = len(full_data)
        tmp = [v for v in reversed(full_data)][offset:(offset + limit)]
        corp_cache = {}
        for i, item in enumerate(tmp):
            item['idx'] = offset + i
            if item['corpname'] not in corp_cache:
                corp_cache[item['corpname']] = corpus_manager.get_Corpus(item['corpname'])
            item['human_corpname'] = corp_cache[item['corpname']].get_conf('NAME')
            for ac in item['aligned']:
                if ac['corpname'] not in corp_cache:
                    corp_cache[ac['corpname']] = corpus_manager.get_Corpus(ac['corpname'])
                ac['human_corpname'] = corp_cache[ac['corpname']].get_conf('NAME')
        return tmp

    def delete_old_records(self, user_id):
        """
        Deletes oldest records until the final length of the list equals
        <num_kept_records> configuration value. Named records are
        kept intact.
        """
        data_key = self._mk_key(user_id)
        curr_data = self.db.list_get(data_key)
        tmp_key = self._mk_tmp_key(user_id)
        self.db.remove(tmp_key)
        limit = 0
        new_list = []
        for item in reversed(curr_data):
            if item.get('name', None) is not None:
                new_list.append(item)
            elif limit < self.num_kept_records:
                new_list.append(item)
                limit += 1
        for item in reversed(new_list):
            self.db.list_append(tmp_key, item)
        self.db.rename(tmp_key, data_key)

    def export_tasks(self):
        def clean_history():
            for str_id, user_id in self.db.hash_get_all(self.CLEANUP_QUEUE_KEY).items():
                self.delete_old_records(user_id)
                self.db.hash_del(self.CLEANUP_QUEUE_KEY, str_id)
        return clean_history,


@inject(plugins.runtime.DB, plugins.runtime.CONC_PERSISTENCE, plugins.runtime.AUTH)
def create_instance(settings, db, conc_persistence, auth):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    return QueryStorage(settings, db, conc_persistence, auth)
