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
import sqlite3


class QueryStorage(object):

    cols = ('id', 'user', 'corpname', 'url', 'description', 'created', 'updated', 'public', 'tmp')

    def __init__(self, conf):
        """
        Parameters
        ----------

        conf : the 'settings' module (or some compatible object)
        """
        self.conn = sqlite3.connect(conf.get('plugins', 'query_storage')['ucnk:db_path'])
        self.num_kept_records = conf.get('plugins', 'query_storage').get('ucnk:num_kept_records', None)
        self.num_kept_records = int(self.num_kept_records) if self.num_kept_records else 10

    def write(self, user, corpname, url, public, tmp, description=None,  query_id=None):
        """
        Writes data as a new saved query

        Returns
        -------
        str : id of the query (either new or existing)
        """

        cursor = self.conn.cursor()

        def id_exists(id):
            cursor.execute("SELECT COUNT (*) FROM saved_queries WHERE id = ? LIMIT 1", (id,))
            return cursor.fetchone()[0]

        if not query_id:
            created = int(time.mktime(datetime.now().timetuple()))
            query_id = self.make_query_hash(user, url)
            i = 5
            while id_exists(query_id[:i]) and i < 32:
                i += 1
            query_id = query_id[:i]
            cursor.execute("INSERT INTO saved_queries (id, user, corpname, url, description, created, public, tmp) "
                           "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                          (query_id, user, corpname, url, description, created, public, tmp))
        else:
            updated = int(time.mktime(datetime.now().timetuple()))
            cursor.execute("UPDATE saved_queries SET description = ?, updated = ?, public = ?, "
                           "tmp = ? WHERE user = ? AND id = ?", (description, updated, public, tmp, user, query_id))

        self.delete_old_records(cursor, user)
        self.conn.commit()
        return query_id

    def get_user_queries(self, user, from_date=None, to_date=None, offset=0, limit=None, types=None):
        """
        Returns list of queries of a specific user.
        """
        sql_params = []
        opt_sql = []

        if from_date:
            from_date = [int(d) for d in from_date.split('-')]
            from_date = time.mktime(datetime(from_date[0], from_date[1], from_date[2], 0, 0, 0).timetuple())
            opt_sql.append('created >= ?')
            sql_params.append(from_date)

        if to_date:
            to_date = [int(d) for d in to_date.split('-')]
            to_date = time.mktime(datetime(to_date[0], to_date[1], to_date[2], 23, 59, 59).timetuple())
            opt_sql.append('created <= ?')
            sql_params.append(to_date)

        if types is None:
            types = []

        tmp = ' OR '.join(['tmp = %s' % {'auto-saved': 1, 'manually-saved': 0}[x] for x in types])
        if tmp:
            opt_sql.append('(%s)' % tmp)

        if limit:
            limit_sql = "LIMIT ? OFFSET ?"
            sql_params.append(limit)
            sql_params.append(offset)
        else:
            limit_sql = ''

        if len(opt_sql) > 0:
            opt_sql.insert(0, '')

        sql = ("SELECT %s FROM saved_queries"
               " WHERE user = ? AND deleted IS NULL"
               " %s "
               " ORDER BY created DESC, updated DESC "
               "%s") % (', '.join(QueryStorage.cols), ' AND '.join(opt_sql), limit_sql)

        sql_params.insert(0, user)
        cursor = self.conn.cursor()
        cursor.execute(sql, tuple(sql_params))
        rows = [dict(zip(QueryStorage.cols, x)) for x in cursor.fetchall()]
        for row in rows:
            row['description'] = self.decode_description(row['description'])
            row['created'] = datetime.fromtimestamp(row['created'])
            row['url'] = '%s&query_id=%s' % (row['url'], row['id'])
        return rows

    def delete_old_records(self, cursor, user):
        """

        """
        cursor.execute("SELECT COUNT(*) FROM saved_queries WHERE user = ? AND deleted IS NULL AND tmp = 1", (user,))
        row = cursor.fetchone()
        if row:
            num_delete = row[0] - self.num_kept_records
            if num_delete > 0:
                cursor.execute("DELETE FROM saved_queries WHERE id IN (SELECT id FROM saved_queries "
                               " WHERE user=? AND deleted IS NULL AND tmp = 1"
                               " ORDER BY created LIMIT ?)", (user, num_delete))

    def get_user_query(self, user, id):
        """
        Returns concrete query specified by its ID.
        In case the query is not public also user identifier has to match (else None is returned.
        """
        cursor = self.conn.cursor()
        cursor.execute("SELECT %s FROM saved_queries WHERE id = ?" % ','.join(QueryStorage.cols), (id, ))
        row = cursor.fetchone()
        if row:
            row = dict(zip(QueryStorage.cols, row))
            if not row['public'] and row['user'] != user:
                row = None
        return row

    def delete_user_query(self, user, id):
        cursor = self.conn.cursor()
        deleted = int(time.mktime(datetime.now().timetuple()))
        cursor.execute("UPDATE saved_queries SET deleted = ? WHERE user = ? AND id = ?", (deleted, user, id))
        self.conn.commit()

    def undelete_user_query(self, user, id):
        cursor = self.conn.cursor()
        cursor.execute("UPDATE saved_queries SET deleted = NULL WHERE user = ? AND id = ?", (user, id))
        self.conn.commit()

    def make_query_hash(self, user, url):
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
        x = long('0x' + md5('%s-%s-%s' % (created, user, url)).hexdigest(), 16)
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
        if is_unicode and type(html) is str:
            html = html.decode('utf-8')
        return html