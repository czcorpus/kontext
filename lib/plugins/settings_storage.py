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
import json


class QueryStorage(object):

    def __init__(self, conf, db):
        """
        Parameters
        ----------

        conf : the 'settings' module (or some compatible object)
        """
        self.conn = db.get()

    def save(self, user_id, data):
        cursor = self.conn.cursor()
        cursor.execute("REPLACE INTO noske_user_settings SET data = %s WHERE user_id = %s", (json.dumps(data), user_id))
        self.conn.commit()

    def load(self, user_id):
        # TODO
        pass


def create_instance(conf, db):
    return QueryStorage(conf, db)