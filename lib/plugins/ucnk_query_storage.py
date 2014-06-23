# Copyright (c) 2013 Institute of the Czech National Corpus
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

from datetime import datetime
import time
import re

"""
A plugin providing a storage for user's queries for services such as 'query history'.

Required config.xml/plugins entries:

<query_storage>
    <module>ucnk_query_storage</module>
    <db_path extension-by="ucnk">[path to a sqlite3-compatible database file]</db_path>
    <num_kept_records extension-by="ucnk">[how many records to keep stored per user]</num_kept_records>
</query_storage>
"""


class QueryStorageException(Exception):
    pass


class QueryStorage(object):

    cols = ('id', 'user_id', 'corpname', 'url', 'params', 'description', 'created', 'updated', 'public', 'tmp')

    def __init__(self, conf, db_provider):
        """
        arguments:
        db_provider -- a callable providing a database proxy
        conf -- the 'settings' module (or some compatible object)
        """
        self.db_provider = db_provider
        self.num_kept_records = conf.get('plugins', 'query_storage').get('ucnk:num_kept_records', None)
        self.num_kept_records = int(self.num_kept_records) if self.num_kept_records else 10

    def _users_last_record_url(self, user_id):
        db = self.db_provider()
        ans = db.execute('SELECT url FROM noske_saved_queries WHERE user_id = %s ORDER BY created DESC LIMIT 1',
                         (user_id,)).fetchone()
        db.close()
        if ans:
            return ans[0]
        return None

    def write(self, user_id, corpname, url, public, tmp, params=None, description=None,  query_id=None):
        """
        Writes data as a new saved query

        Returns
        -------
        str : id of the query (either new or existing)
        """
        last_url = self._users_last_record_url(user_id)
        if url != last_url:
            db = self.db_provider()
            with db.begin() as transaction:
                if not query_id:
                    created = int(time.mktime(datetime.now().timetuple()))
                    db.execute(u"INSERT INTO noske_saved_queries "
                               u"(user_id, corpname, url, params, description, created, public, tmp) "
                               u"VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                               (user_id, corpname, url, params, description, created, public, tmp))
                    ans = db.execute('SELECT LAST_INSERT_ID()').fetchone()
                    if ans:
                        query_id = ans[0]
                    else:
                        raise QueryStorageException('Failed to create record')
                else:
                    updated = int(time.mktime(datetime.now().timetuple()))
                    # 'params' attribute is omitted deliberately
                    db.execute(u"UPDATE noske_saved_queries SET description = %s, updated = %s, public = %s, "
                               u"tmp = %s WHERE user_id = %s AND id = %s", (description, updated, public, tmp, user_id, query_id))

                self.delete_old_records(db, user_id)
            db.close()
            return query_id
        else:
            # if latest action equals to user's previous action then nothing is done
            return None

    def get_user_queries(self, user_id, from_date=None, to_date=None, offset=0, limit=None, types=None):
        """
        Returns list of queries of a specific user.
        """
        import json
        import conclib

        sql_params = []
        opt_sql = []

        if from_date:
            from_date = [int(d) for d in from_date.split('-')]
            from_date = time.mktime(datetime(from_date[0], from_date[1], from_date[2], 0, 0, 0).timetuple())
            opt_sql.append('created >= %s')
            sql_params.append(from_date)

        if to_date:
            to_date = [int(d) for d in to_date.split('-')]
            to_date = time.mktime(datetime(to_date[0], to_date[1], to_date[2], 23, 59, 59).timetuple())
            opt_sql.append('created <= %s')
            sql_params.append(to_date)

        if types is None:
            types = []

        tmp = ' OR '.join(['tmp = %s' % {'auto-saved': 1, 'manually-saved': 0}[x] for x in types])
        if tmp:
            opt_sql.append('(%s)' % tmp)

        if limit:
            limit_sql = "LIMIT %s OFFSET %s"
            sql_params.append(limit)
            sql_params.append(offset)
        else:
            limit_sql = ''

        if len(opt_sql) > 0:
            opt_sql.insert(0, '')

        sql = ("SELECT %s FROM noske_saved_queries"
               " WHERE user_id = %%s AND deleted IS NULL"
               " %s "
               " ORDER BY created DESC, updated DESC "
               "%s") % (', '.join(QueryStorage.cols), ' AND '.join(opt_sql), limit_sql)

        sql_params.insert(0, user_id)
        db = self.db_provider()
        ans = db.execute(sql, tuple(sql_params))
        rows = [dict(zip(QueryStorage.cols, x)) for x in ans.fetchall()]
        db.close()

        def parse_desc(query_desc):
            q = list(query_desc[0])
            r = re.match(r'^(([^,]+),)?(\[.+)', q[1])
            if r:
                q[1] = {'default': r.group(2), 'query': r.group(3)}
            else:
                q[1] = {'default': None, 'query': q[1]}
            query_desc[0] = tuple(q)
            return query_desc

        for row in rows:
            row['corpname'] = row['corpname'].decode('utf-8')
            row['url'] = row['url'].decode('utf-8')
            row['params'] = json.loads(row['params'])
            row['params_description'] = parse_desc(conclib.get_conc_desc(q=row['params']))
            row['description'] = self.decode_description(row['description'])
            row['created'] = datetime.fromtimestamp(row['created'])
            row['url'] = '%s&query_id=%s' % (row['url'], row['id'])
        return rows

    def delete_old_records(self, db, user_id):
        """

        """
        # Current solution is not very effective but makes MySQL to complain less
        # in case of active replication and multiple engines used.
        # Typically this will delete just one old record which should be ok.
        rows = db.execute("SELECT id FROM noske_saved_queries WHERE user_id = %s "
                          "AND deleted IS NULL AND tmp = 1 ORDER BY created DESC LIMIT %s, 100",
                          (user_id, self.num_kept_records)).fetchall()
        for row in rows:
            db.execute("DELETE FROM noske_saved_queries WHERE user_id = %s AND deleted IS NULL AND tmp = 1 "
                       " AND id = %s", (user_id, row[0]))

    def get_user_query(self, user_id, id):
        """
        Returns concrete query specified by its ID.
        In case the query is not public also user identifier has to match (else None is returned.
        """
        db = self.db_provider()
        row = db.execute("SELECT %s FROM noske_saved_queries WHERE id = %%s" % ','.join(QueryStorage.cols), (id, )).fetchone()
        if row:
            row = dict(zip(QueryStorage.cols, row))
            if not row['public'] and row['user_id'] != user_id:
                row = None
        db.close()
        return row

    def delete_user_query(self, user_id, id):
        db = self.db_provider()
        deleted = int(time.mktime(datetime.now().timetuple()))
        db.execute("UPDATE noske_saved_queries SET deleted = %s WHERE user_id = %s AND id = %s", (deleted, user_id, id))
        db.close()

    def undelete_user_query(self, user_id, id):
        db = self.db_provider()
        db.execute("UPDATE noske_saved_queries SET deleted = NULL WHERE user_id = %s AND id = %s", (user_id, id))
        db.close()

    def make_query_hash(self, user_id, url):
        """
        Generates random-like identifier based on user, url and current time
        """
        from hashlib import md5

        chars = (
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
            'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
        )
        created = time.mktime(datetime.now().timetuple())
        x = long('0x' + md5('%s-%s-%s' % (created, user_id, url)).hexdigest(), 16)
        ans = []
        while x > 0:
            p = x % len(chars)
            ans.append(chars[p])
            x /= len(chars)
        return ''.join([str(x) for x in ans])

    def decode_description(self, s):
        """
        Converts a restructuredText-formatted string into HTML
        """
        from docutils.core import publish_string

        if s in ('', None):
            return ''
        is_unicode = type(s) is unicode
        html = publish_string(source=s, settings_overrides={'file_insertion_enabled': 0, 'raw_enabled': 0},
                                 writer_name='html')
        html = html[html.find('<body>')+6:html.find('</body>')].strip()
        if not is_unicode and type(html) is str:
            html = html.decode('utf-8')

        return html


def create_instance(settings, db):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    return QueryStorage(settings, db)