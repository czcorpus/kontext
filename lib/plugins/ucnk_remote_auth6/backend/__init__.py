# Copyright (c) 2024 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
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

from plugins.mysql_corparch.backend import Backend


class UCNKBackend(Backend):
    def custom_parallel_access_subquery(self, user_id):
        return (
            "SELECT c.name AS corpus_id, gpc.limited AS limited "
            "FROM group_parallel_corpus AS gpc "
            "JOIN `group` AS g ON gpc.group_id = g.id "
            "JOIN parallel_corpus AS pc ON pc.id = gpc.parallel_corpus_id "
            "JOIN corpora AS c ON pc.id = c.parallel_corpus_id "
            "JOIN user_group ON g.id = user_group.group_id "
            "WHERE user_group.user_id = %s",
            [user_id]
        )

    def custom_access_subquery(self, user_id):
        return (
            "SELECT c.name AS corpus_id, group_corpus.limited AS limited "
            "FROM group_corpus "
            "JOIN `group` ON group_corpus.group_id = `group`.id "
            "JOIN corpora AS c ON c.id = group_corpus.corpus_id "
            "JOIN user_group ON `group`.id = user_group.group_id "
            "WHERE user_group.user_id = %s",
            [user_id]
        )
