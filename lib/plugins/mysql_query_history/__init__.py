# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

Also, don't forget to regularly clean-up older records by adding
something like the following config JSON snippet to your rq-scheduler
configuration.

{
"task": "query_history__delete_old_records",
"schedule": "1 4 * * *",
"kwargs": {}
}
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Tuple

import plugins
from corplib.abstract import AbstractKCorpus
from corplib.fallback import EmptyCorpus
from plugin_types.auth import AbstractAuth
from plugin_types.query_history import AbstractQueryHistory
from plugin_types.query_persistence import AbstractQueryPersistence
from plugin_types.subc_storage import AbstractSubcArchive
from plugins import inject
from plugins.mysql_integration_db import MySqlIntegrationDb
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.common.mysql import MySQLConf


class CorpusCache:

    def __init__(self, corpus_factory):
        self._cf = corpus_factory
        self._corpora = {}

    async def corpus(self, cname: str) -> AbstractKCorpus:
        if not cname:
            return EmptyCorpus()
        if cname not in self._corpora:
            self._corpora[cname] = await self._cf.get_corpus(cname)
        return self._corpora[cname]


class MySqlQueryHistory(AbstractQueryHistory):

    DEFAULT_PRESERVE_AMOUNT = 100

    TABLE_NAME = 'kontext_query_history'

    def __init__(
            self,
            conf,
            db: MySqlIntegrationDb,
            query_persistence: AbstractQueryPersistence,
            subc_archive: AbstractSubcArchive,
            auth: AbstractAuth):
        """
        arguments:
        conf -- the 'settings' module (or some compatible object)
        db -- default_db history backend
        """
        tmp = conf.get('plugins', 'query_history').get('preserve_amount', None)
        if tmp:
            self.preserve_amount = int(tmp)
        else:
            self.preserve_amount = self.DEFAULT_PRESERVE_AMOUNT
            logging.getLogger(__name__).warning(
                'QueryHistory - preserve_amount not set, using default value {0} for query history records'.format(
                    self.preserve_amount))
        self._db = db
        self._query_persistence = query_persistence
        self._subc_archive = subc_archive
        self._auth = auth
        self._page_num_records = int(conf.get('plugins', 'query_history')['page_num_records'])

    async def store(self, user_id, query_id, q_supertype):
        created = int(datetime.now(timezone.utc).timestamp())
        corpora = (await self._query_persistence.open(query_id))['corpora']
        async with self._db.cursor() as cursor:
            await cursor.executemany(
                f'INSERT IGNORE INTO {self.TABLE_NAME} '
                '(corpus_name, query_id, user_id, q_supertype, created) VALUES (%s, %s, %s, %s, %s)',
                [(corpus, query_id, user_id, q_supertype, created) for corpus in corpora]
            )
        return created

    async def _update_name(self, user_id, query_id, created, new_name) -> bool:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'UPDATE {self.TABLE_NAME} '
                'SET name = %s '
                'WHERE user_id = %s AND query_id = %s AND created = %s',
                (new_name, user_id, query_id, created)
            )
            return cursor.rowcount > 0

    async def make_persistent(self, plugin_ctx, user_id, query_id, q_supertype, created, name) -> bool:
        if await self._update_name(user_id, query_id, created, name):
            await self._query_persistence.archive(query_id, True)
        else:
            c = await self.store(user_id, query_id, q_supertype)
            await self._update_name(user_id, query_id, c, name)
        return True

    async def make_transient(self, plugin_ctx, user_id, query_id, created, name) -> bool:
        return await self._update_name(user_id, query_id, created, None)

    async def delete(self, plugin_ctx, user_id, query_id, created):
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'DELETE FROM {self.TABLE_NAME} WHERE user_id = %s AND query_id = %s AND created = %s',
                (user_id, query_id, created)
            )
            return cursor.rowcount

    async def _is_paired_with_conc(self, data) -> bool:
        q_id = data['query_id']
        return await self._query_persistence.open(q_id) is not None

    async def _merge_conc_data(self, data, qdata):
        def get_ac_val(data, name, corp):
            return data.get(name, {}).get(corp, None)

        if qdata and 'lastop_form' in qdata:
            ans = {}
            ans.update(data)
            form_data = qdata['lastop_form']
            main_corp = qdata['corpora'][0]
            if form_data['form_type'] == 'query':
                ans['lastop_query_id'] = qdata['lastop_query_id']
                ans['query_type'] = form_data['curr_query_types'][main_corp]
                ans['query'] = form_data['curr_queries'][main_corp]
                ans['corpname'] = main_corp
                ans['subcorpus_id'] = qdata['usesubcorp']
                ans['default_attr'] = form_data['curr_default_attr_values'][main_corp]
                ans['lpos'] = form_data['curr_lpos_values'][main_corp]
                ans['qmcase'] = form_data['curr_qmcase_values'][main_corp]
                ans['pcq_pos_neg'] = form_data['curr_pcq_pos_neg_values'][main_corp]
                ans['selected_text_types'] = form_data.get('selected_text_types', {})
                ans['aligned'] = []
                for aitem in qdata['corpora'][1:]:
                    ans['aligned'].append(
                        dict(
                            corpname=aitem,
                            query=form_data['curr_queries'].get(aitem),
                            query_type=form_data['curr_query_types'].get(aitem),
                            default_attr=form_data['curr_default_attr_values'].get(aitem),
                            lpos=form_data['curr_lpos_values'].get(aitem),
                            qmcase=form_data['curr_qmcase_values'].get(aitem),
                            pcq_pos_neg=form_data['curr_pcq_pos_neg_values'].get(aitem),
                            include_empty=get_ac_val(form_data, 'curr_include_empty_values', aitem)))
            elif form_data['form_type'] == 'filter':
                ans.update(form_data)
                ans['corpname'] = main_corp
                ans['subcorpname'] = qdata['usesubcorp']
                ans['aligned'] = []
                ans['selected_text_types'] = {}
            return ans
        else:
            return None   # persistent result not available

    async def get_user_queries(
            self, plugin_ctx, user_id, corpus_factory, from_date=None, to_date=None, q_supertype=None, corpname=None,
            archived_only=False, offset=0, limit=None, full_search_args=None):
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

        async with self._db.cursor() as cursor:
            await cursor.execute(f'''
                SELECT DISTINCT query_id, created, name, q_supertype FROM {self.TABLE_NAME} WHERE
                {' AND '.join(where_sql)}
                ORDER BY created DESC
                {'LIMIT %s' if limit is not None else ''}
                {'OFFSET %s' if offset else ''}
            ''', values)
            rows = [item for item in await cursor.fetchall()]
            full_data = await self._process_rows(plugin_ctx, corpus_factory, rows)

        for i, item in enumerate(full_data):
            item['idx'] = offset + i

        return full_data

    async def _process_rows(self, plugin_ctx, corpus_factory, rows):
        async def extract_id(item_id: str, item_data: Dict) -> Tuple[str, Dict]:
            return item_id, item_data

        full_data = []
        corpora = CorpusCache(corpus_factory)
        qdata_map = {}
        for item in rows:
            stored = await self._query_persistence.open(item['query_id'])
            if stored:
                qdata_map[item['query_id']] = stored
        subc_names = await self._subc_archive.get_names(
            [item.get('usesubcorp') for item in qdata_map.values() if item.get('usesubcorp')])
        for item in rows:
            q_id = item['query_id']
            q_supertype = item['q_supertype']
            if q_id not in qdata_map:
                logging.getLogger(__name__).warning(f'Missing conc data for query {q_id}')
                continue
            qdata = qdata_map[q_id]
            if q_supertype == 'conc':
                # test we have actually the 'query' or 'filter' type and if not then move
                # to the first query in chain (this fixes possibly broken query history records)
                form_type = qdata.get('lastop_form', {}).get('form_type', None)
                if form_type not in ('query', 'filter'):
                    ops = await self._query_persistence.map_pipeline_ops(plugin_ctx, q_id, extract_id)
                    logging.getLogger(__name__).warning(
                        'Runtime patching broken query history record '
                        f'{q_id} of invalid type "{form_type}" (proper id: {ops[0][0]})')
                    lastop_qid = q_id
                    q_id, qdata = ops[0]
                    qdata['query_id'], item['query_id'] = q_id, q_id
                    qdata['lastop_query_id'] = lastop_qid
                else:
                    qdata['lastop_query_id'] = q_id
                tmp = await self._merge_conc_data(item, qdata)
                if not tmp:
                    continue
                tmp['human_corpname'] = (await corpora.corpus(tmp['corpname'])).human_readable_corpname
                for ac in tmp['aligned']:
                    ac['human_corpname'] = (await corpora.corpus(ac['corpname'])).human_readable_corpname
                tmp['subcorpus_name'] = subc_names.get(qdata.get('usesubcorp'))
                full_data.append(tmp)
            elif q_supertype == 'pquery':
                if not qdata:
                    continue
                tmp = {
                    'corpname': qdata['corpora'][0],
                    'aligned': [],
                    'human_corpname': (await corpora.corpus(qdata['corpora'][0])).human_readable_corpname,
                    'subcorpus_name': subc_names.get(qdata.get('usesubcorp'))
                }
                q_join = []
                for q in qdata.get('form', {}).get('conc_ids', []):
                    stored_q = await self._query_persistence.open(q)
                    if stored_q is None:
                        logging.getLogger(__name__).warning(
                            'Missing conc for pquery: {}'.format(q))
                    else:
                        for qs in stored_q.get('lastop_form', {}).get('curr_queries', {}).values():
                            q_join.append(f'{{ {qs} }}')
                q_subset = qdata.get('form', {}).get('conc_subset_complements', None)
                if q_subset is not None:
                    for q in q_subset.get('conc_ids', []):
                        max_ratio = q_subset.get('max_non_matching_ratio', 0)
                        stored_q = await self._query_persistence.open(q)
                        if stored_q is None or 'query' not in stored_q.get('lastop_form', {}).get('form_type'):
                            logging.getLogger(__name__).warning(
                                'Missing conc for pquery subset: {}'.format(q))
                        else:
                            query = stored_q['lastop_form']['curr_queries'][tmp['corpname']]
                            q_join.append(f'!{max_ratio if max_ratio else ""}{{ {query} }}')

                q_superset = qdata.get('form', {}).get('conc_superset', None)
                if q_superset is not None:
                    max_ratio = q_superset.get('max_non_matching_ratio', 0)
                    stored_q = await self._query_persistence.open(q_superset['conc_id'])
                    if stored_q is None or 'query' not in stored_q.get('lastop_form', {}).get('form_type'):
                        logging.getLogger(__name__).warning(
                            'Missing conc for pquery superset: {}'.format(q_superset['conc_id']))
                    else:
                        query = stored_q['lastop_form']['curr_queries'][tmp['corpname']]
                        q_join.append(f'?{max_ratio if max_ratio else ""}{{ {query} }}')

                tmp['query'] = ' && '.join(q_join)
                tmp.update(item)
                tmp.update(qdata)
                full_data.append(tmp)
            elif q_supertype == 'wlist':
                if not qdata:
                    continue
                tmp = dict(
                    corpname=qdata['corpora'][0],
                    aligned=[],
                    human_corpname=(await corpora.corpus(qdata['corpora'][0])).human_readable_corpname,
                    query=qdata.get('form', {}).get('wlpat'),
                    subcorpus_name=subc_names.get(qdata.get('usesubcorp')),
                    pfilter_words=qdata['form']['pfilter_words'],
                    nfilter_words=qdata['form']['nfilter_words'])
                tmp.update(item)
                tmp.update(qdata)
                full_data.append(tmp)
            elif q_supertype == 'kwords':
                if not qdata:
                    continue
                tmp = dict(
                    corpname=qdata['corpora'][0],
                    aligned=[],
                    human_corpname=(await corpora.corpus(qdata['corpora'][0])).human_readable_corpname,
                    query=qdata.get('form', {}).get('wlpat'),
                    subcorpus_name=subc_names.get(qdata.get('usesubcorp')))
                tmp.update(item)
                tmp.update(qdata)
                full_data.append(tmp)
            else:
                logging.getLogger(__name__).error('Unknown query supertype: ', q_supertype)

        return full_data

    async def delete_old_records(self):
        """
        Preserve only preserve_amount of newest records.
        Named records are kept intact.
        """
        # TODO remove also named but unpaired history entries
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'''
                DELETE FROM {self.TABLE_NAME}
                WHERE CONCAT(user_id, '/', created, '/', query_id) IN (
                    SELECT CONCAT(user_id, '/', created, '/', query_id) AS id
                    FROM (
                        SELECT user_id, created, query_id,
                        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created DESC) AS row_num
                        FROM {self.TABLE_NAME}
                        WHERE name is NULL
                    ) AS tmp
                    WHERE row_num > %s
                )
                ''',
                (self.preserve_amount,)
            )

    async def export(self, plugin_ctx):
        """
        Export plug-in data to dependent HTML pages
        """
        return {'page_num_records': self._page_num_records}

    def export_tasks(self):
        """
        Export schedulable tasks
        """
        return self.delete_old_records,

    async def on_response(self):
        if isinstance(self._db, AdhocDB):
            await self._db.close()


@inject(
    plugins.runtime.INTEGRATION_DB,
    plugins.runtime.QUERY_PERSISTENCE,
    plugins.runtime.SUBC_STORAGE,
    plugins.runtime.AUTH
)
def create_instance(
        conf,
        integ_db: MySqlIntegrationDb,
        query_persistence: AbstractQueryPersistence,
        subc_archive: AbstractSubcArchive,
        auth: AbstractAuth
):
    plugin_conf = conf.get('plugins', 'auth')
    if integ_db and integ_db.is_active and 'mysql_host' not in plugin_conf:
        db = integ_db
        logging.getLogger(__name__).info(f'mysql_query_history uses integration_db[{integ_db.info}]')
    else:
        db = AdhocDB(MySQLConf.from_conf(plugin_conf))
    return MySqlQueryHistory(conf, db, query_persistence, subc_archive, auth)
