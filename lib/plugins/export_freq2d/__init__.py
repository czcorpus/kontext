# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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

from action.errors import UserReadableException


class ExportPluginException(Exception):
    pass


class AbstractExportFreq2d(object):
    def content_type(self):
        raise NotImplementedError()

    def set_content(self, attr1, attr2, labels1, labels2, alpha_level, min_freq, min_freq_type, data):
        raise UserReadableException(
            message='Table mode method for ExportFreq2d not implemented', code=500)

    def set_content_flat(self, headings, alpha_level, min_freq, min_freq_type, data):
        raise UserReadableException(
            message='Flat mode method for ExportFreq2d not implemented', code=500)

    def raw_content(self):
        raise NotImplementedError()


class Loader(object):
    def __init__(self, module_map):
        self._module_map = module_map

    def load_plugin(self, name):
        """
        Loads an export module specified by passed name.
        In case you request non existing plug-in (= a plug-in
        not set in config.xml) ValueError is raised.

        arguments:
        name -- name of the module

        returns:
        required module or nothing if module is not found
        """
        module_name = self._module_map[name]
        module = __import__(f'plugins.export_freq2d.{module_name}', fromlist=[module_name])
        return module.create_instance()


def create_instance(settings):
    module_map = settings.get('plugins', 'export_freq2d')
    return Loader(module_map)
