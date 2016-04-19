# Copyright 2015 Institute of the Czech National Corpus
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from datetime import datetime


class Db(object):
    def __init__(self, mysql_conn):
        """
        arguments:
        mysql_conn -- a MySQLdb connection object
        """
        self._mysql = mysql_conn

    def _current_dbtime(self):
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    def query(self, sql, params=None):
        """
        Runs a query.

        arguments:
        sql -- a SQL query
        params -- parameters to be bound to the query (optional)

        returns:
        DB cursor
        """
        cursor = self._mysql.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor
