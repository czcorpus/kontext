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


class SubcMixResult(object):

    def __init__(self, variables, total_size, category_sizes, num_texts):
        self.variables = variables
        self.total_size = total_size
        self.category_sizes = category_sizes
        self.num_texts = num_texts

    def __repr__(self):
        return 'SubcMixResult(num_vars: %d, total_size: %d, num_texts: %d, category_sizes: %s)' % (
            len(self.variables), self.total_size, self.num_texts, self.category_sizes)


class AbstractSubMixer(object):

    def process(self, corpname, conditions):
        raise NotImplementedError()