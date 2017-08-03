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
}
"""

from datetime import datetime
import time
import random

from plugins.abstract.query_storage import AbstractQueryStorage
from plugins import inject


class QueryStorage(AbstractQueryStorage):

    PROB_DELETE_OLD_RECORDS = 0.1

    def __init__(self, conf, db, conc_persistence, auth):
        """
        arguments:
        conf -- the 'settings' module (or some compatible object)
        db -- default_db storage backend
        """
        tmp = conf.get('plugins', 'query_storage').get('default:num_kept_records', None)
        self.num_kept_records = int(tmp) if tmp else 10
        self.db = db
        self._conc_persistence = conc_persistence
        self._auth = auth

    def _current_timestamp(self):
        return int(time.time())

    def _mk_key(self, user_id):
        return 'query_history:user:%d' % user_id

    def write(self, user_id, query_id):
        """
        stores information about a query

        arguments:
        user_id -- a numeric ID of a user
        query_id -- a query identifier as produced by query_storage plug-in
        """
        data_key = self._mk_key(user_id)
        item = dict(created=self._current_timestamp(), query_id=query_id)
        self.db.list_append(data_key, item)
        if random.random() < QueryStorage.PROB_DELETE_OLD_RECORDS:
            self.delete_old_records(data_key)

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
                         offset=0, limit=None):
        """
        Returns list of queries of a specific user.

        arguments:
        user_id -- database user ID
        corpus_manager -- a corplib.CorpusManager instance
        from_date -- YYYY-MM-DD date string
        to_date -- YYY-MM-DD date string
        query_type -- one of {iquery, lemma, phrase, word, char, cql}
        corpus_name -- internal corpus name (i.e. including possible path-like prefix)
        offset -- where to start the list (starts from zero)
        limit -- how many rows will be selected
        """

        def matches_corp_prop(data, prop_name, value):
            if data[prop_name] == value:
                return True
            for aligned in data['aligned']:
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

        if limit is None:
            limit = len(full_data)
        tmp = sorted(full_data, key=lambda x: x['created'], reverse=True)[offset:(offset + limit)]
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

    def delete_old_records(self, data_key):
        """
        Deletes oldest records until the final length of the list equals <num_kept_records> configuration value
        """
        num_over = max(0, self.db.list_len(data_key) - self.num_kept_records)
        if num_over > 0:
            self.db.list_trim(data_key, num_over, -1)


@inject('db', 'conc_persistence', 'auth')
def create_instance(settings, db, conc_persistence, auth):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    return QueryStorage(settings, db, conc_persistence, auth)
