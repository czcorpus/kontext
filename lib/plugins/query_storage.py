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

import db
from db import fq


class QueryStorage(object):

    cols = ('id', 'user', 'corpname', 'url', 'description', 'created', 'updated', 'public', 'tmp')

    def __init__(self, conf):
        """
        Parameters
        ----------

        conf : the 'settings' module (or some compatible object)
        """
        self.conn = db.open(conf.get('global', 'ucnk:database'))

    def write(self, user, corpname, url, public, tmp, description=None,  query_id=None):
        """
        Writes data as a new saved query

        Returns
        -------
        str : id of the query (either new or existing)
        """
        cursor = self.conn.cursor()

        def id_exists(id):
            cursor.execute(fq("SELECT COUNT (*) FROM saved_queries WHERE id = %(p)s LIMIT 1"), (id,))
            return cursor.fetchone()[0]

        if not query_id:
            created = int(time.mktime(datetime.now().timetuple()))
            query_id = self.make_query_hash(user, url)
            i = 5
            while id_exists(query_id[:i]) and i < 32:
                i += 1
            query_id = query_id[:i]
            cursor.execute(fq("INSERT INTO saved_queries (id, user, corpname, url, description, created, public, tmp) "
                              + "VALUES (%(p)s, %(p)s, %(p)s, %(p)s, %(p)s, %(p)s, %(p)s, %(p)s)"),
                          (query_id, user, corpname, url, description, created, public, tmp))
        else:
            updated = int(time.mktime(datetime.now().timetuple()))
            cursor.execute(fq("UPDATE saved_queries SET description = %(p)s, updated = %(p)s, public = %(p)s, "
                              + "tmp = %(p)s WHERE user = %(p)s AND id = %(p)s"), (description, updated, public, tmp,
                                                                                   user, query_id))
        self.conn.commit()
        return query_id

    def get_user_queries(self, user):
        """
        Returns list of queries of a specific user.
        """
        cursor = self.conn.cursor()
        cursor.execute(fq("SELECT %s FROM saved_queries WHERE user = %%(p)s AND deleted IS NULL ORDER BY created DESC, updated DESC"
                          % ','.join(QueryStorage.cols)), (user,))
        rows = [dict(zip(QueryStorage.cols, x)) for x in cursor.fetchall()]
        for row in rows:
            row['description'] = self.decode_description(row['description'])
            row['created'] = datetime.fromtimestamp(row['created'])
            row['url'] = '%s&query_id=%s' % (row['url'], row['id'])
        return rows

    def get_user_query(self, user, id):
        """
        Returns concrete query specified by its ID.
        In case the query is not public also user identifier has to match (else None is returned.
        """
        cursor = self.conn.cursor()
        cursor.execute(fq("SELECT %s FROM saved_queries WHERE id = %%(p)s" % ','.join(QueryStorage.cols)),
                       (id, ))
        row = cursor.fetchone()
        if row:
            row = dict(zip(QueryStorage.cols, row))
            if not row['public'] and row['user'] != user:
                row = None
        return row

    def delete_user_query(self, user, id):
        cursor = self.conn.cursor()
        deleted = int(time.mktime(datetime.now().timetuple()))
        cursor.execute(fq("UPDATE saved_queries SET deleted = %(p)s WHERE user = %(p)s AND id = %(p)s"),
                       (deleted, user, id))
        self.conn.commit()

    def undelete_user_query(self, user, id):
        cursor = self.conn.cursor()
        cursor.execute(fq("UPDATE saved_queries SET deleted = NULL WHERE user = %(p)s AND id = %(p)s"),
                       (user, id))
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