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

"""
A minor modification of default_syntax_viewer as used in
the Czech National Corpus. The client-side part is linked
from the default plug-in implementation (see conf bellow).

Required config.xml/plugins entries (RelaxNG compact format):

element syntax_viewer {
    element module { "ucnk_syntax_viewer" }
    element js_module { "defaultSyntaxViewer" }  # here we use default plug-in implementation
    element config_path {
        attribute extension-by { "default" }
        text # a path to JSON config file (see below)
    }
}
"""

import plugins
import plugins.default_syntax_viewer as dsv


class UcnkManateeBackend(dsv.ManateeBackend):
    def __init__(self, conf):
        super(UcnkManateeBackend, self).__init__(conf)

    def import_parent_val(self, v):
        return int(v.split('|')[0])


@plugins.inject('auth')
def create_instance(conf, auth):
    corpora_conf = dsv.load_plugin_conf(conf)
    return dsv.SyntaxDataProvider(corpora_conf, UcnkManateeBackend(corpora_conf), auth)
