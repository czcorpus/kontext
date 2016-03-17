# Copyright (c) 2015 Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

from plugins.abstract.corpora import AbstractCorporaArchive, BrokenCorpusInfo, CorpusInfo


class TreeCorparch(AbstractCorporaArchive):

    def setup(self, controller_obj):
        pass

    def get_corpus_info(self, corp_id, language=None):
        return BrokenCorpusInfo()

    def get_list(self, user_allowed_corpora):
        return []  # TODO


def create_instance(conf):
    return TreeCorparch()
