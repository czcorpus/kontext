# Copyright (c) 2016 Czech National Corpus
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

from plugins.abstract.footer_bar import AbstractFootbar


class DefaultFootbar(AbstractFootbar):

    def get_contents(self, plugin_api, return_url=None):
        return '<div class="ufal-footer">A custom LINDAT footer - TEST</div>'

    def get_css_url(self):
        return None


def create_instance(conf):
    return DefaultFootbar()
