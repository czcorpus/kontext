# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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
A plugin providing a "null" history functionality. It means that
all the expected interface actions work but produce no real actions
and no results. This can be used e.g. in case of API-only instances
where there is no need to store query history.
"""

from datetime import datetime

from plugin_types.query_history import AbstractQueryHistory


class NullQueryHistory(AbstractQueryHistory):

    def __init__(self):
        pass

    async def store(self, user_id, query_id, q_supertype):
        return int(datetime.utcnow().timestamp())

    async def make_persistent(self, user_id, query_id, q_supertype, created, name) -> bool:
        return True

    async def make_transient(self, user_id, query_id, created, name) -> bool:
        return True

    async def delete(self, user_id, query_id, created):
        return 0

    async def get_user_queries(
            self, plugin_ctx, user_id,
            corpus_factory,
            from_date=None,
            to_date=None,
            q_supertype=None,
            corpname=None,
            archived_only=False,
            offset=0,
            limit=None,
            full_search_args=None,
    ):
        return []

    async def delete_old_records(self):
        pass

    async def export(self, plugin_ctx):
        """
        Export plug-in data to dependent HTML pages
        """
        return {'page_num_records': 0}

    def export_tasks(self):
        """
        Export schedulable tasks
        """
        return tuple()


def create_instance(_):
    return NullQueryHistory()
