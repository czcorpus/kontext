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

"""
Required plug-in configuration:

element footer_bar {
  element module { "lindat_footer_bar" }
  element js_module { "lindatFooterBar" }
}
"""

import os

from plugins.abstract.footer_bar import AbstractFootbar


class FootBar(AbstractFootbar):

    def __init__(self):
        self._resource_dir = os.path.realpath(os.path.join(os.path.dirname(__file__), 'resources'))

    def _get_resource_path(self, filename):
        return os.path.join(self._resource_dir, filename)

    def get_contents(self, plugin_api, return_url=None):
        if 'cs_CZ' == plugin_api.user_lang:
            input_file = self._get_resource_path('cs/footer.html')
        else:
            input_file = self._get_resource_path('footer.html')
        with open(input_file, mode='rb') as fin:
            return fin.read().decode('utf-8')

    def get_css_url(self):
        return None


def create_instance(conf):
    return FootBar()


