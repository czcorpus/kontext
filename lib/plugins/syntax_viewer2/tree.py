# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

from plugins.default_syntax_viewer.manatee_backend import TreexTemplate


class UcnkTreeTemplate(TreexTemplate):

    def __init__(self, tree_id, tree_data, kwic_pos, conf):
        super(UcnkTreeTemplate, self).__init__([tree_id], [tree_data], conf)
        self._kwic_pos = list(range(kwic_pos[0], kwic_pos[0] + kwic_pos[1]))

    def export(self):
        ans = super(UcnkTreeTemplate, self).export()
        ans[0]['kwicPosition'] = self._kwic_pos
        return ans
