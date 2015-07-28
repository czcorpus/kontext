# Copyright (c) 2015 Institute of the Czech National Corpus
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

__author__ = 'Tomas Machalek <tomas.machalek@gmail.com>'

from plugins.abstract.subcmixer import AbstractSubMixer
from plugins import inject
from plugins import PluginException
from category_tree import CategoryTree
from metadata_model import MetadataModel
from plugins.abstract.subcmixer import SubcMixResult


class SubcMixerException(PluginException):
    pass


class SubcMixer(AbstractSubMixer):

    def __init__(self, corparch):
        self._corparch = corparch

    def process(self, corpname, conditions):
        corp_info = self._corparch.get_corpus_info(corpname)
        corpus_max_size = 500000000  # TODO
        cat_tree = CategoryTree(conditions, corp_info.metadata.database, 'item',
                                corpus_max_size)
        mm = MetadataModel(cat_tree)
        corpus_items = mm.solve()
        if corpus_items.size_assembled > 0:
            return SubcMixResult(variables=[x for x in enumerate(corpus_items.variables, 1)],
                                 total_size=corpus_items.size_assembled,
                                 category_sizes=corpus_items.category_sizes,
                                 num_texts=corpus_items.num_texts)
        else:
            raise SubcMixerException('Corpus composition failed. '
                                     'One of the provided conditions generates no data.')


@inject('corparch')
def create_instance(settings, corparch):
    return SubcMixer(corparch)

