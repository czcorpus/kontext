# Copyright (c) 2014 Czech National Corpus
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
This is kind of a meta-plug-in which loads modules intended for
exporting concordance data to a file. The plug-in itself cannot be
changed/configured. On the other side, concrete export modules are
free to be replaced/changed.
"""

from translation import ugettext as _


class ExportPluginException(Exception):
    pass


class AbstractExport(object):

    def set_corpnames(self, corpnames):
        pass

    def content_type(self):
        raise NotImplementedError()

    def raw_content(self):
        raise NotImplementedError()

    def writerow(self, line_num, *lang_rows):
        raise NotImplementedError()

    def set_col_types(self, *types):
        pass

    def writeheading(self, data):
        pass  # optional implementation


def lang_row_to_list(row):
    ans = []
    for key in ('ref', 'left_context', 'kwic', 'right_context'):
        if key in row:
            ans.append(row[key])
    return ans


class Loader(object):

    def __init__(self, module_map):
        self._module_map = module_map

    def load_plugin(self, name, subtype=None):
        """
        Loads an export module specified by passed name.
        In case you request non existing plug-in (= a plug-in
        not set in config.xml) ValueError is raised.

        arguments:
        name -- name of the module
        subtype -- additional type specification (e.g. main type is "XML export", subtype is "frequency distribution")

        returns:
        required module or nothing if module is not found
        """
        if name not in self._module_map:
            raise ValueError(_('Export module [%s] not configured') % name)
        module_name = self._module_map[name]
        module = __import__('plugins.export.%s' % module_name, fromlist=[module_name])
        plugin = module.create_instance(subtype=subtype)
        return plugin


def create_instance(settings):
    module_map = settings.get('plugins', 'export')
    return Loader(module_map)