import logging
import os
import imp


class ExportPluginException(Exception):
    pass


class AbstractExportFreq2d(object):
    def content_type(self):
        raise NotImplementedError()

    def set_content(self):
        raise NotImplementedError()

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

        srch_dirs = [os.path.dirname(os.path.realpath(__file__))]
        try:
            tpl_file, pathname, description = imp.find_module(self._module_map[name], srch_dirs)
        except ImportError as ex:
            logging.getLogger(__name__).error('Failed to import template {0} in {1}'.format(name, ', '.join(srch_dirs)))
            raise ex
        module = imp.load_module(name, tpl_file, pathname, description)
        return module.create_instance()


def create_instance(settings):
    module_map = settings.get('plugins', 'export_freq2d')
    print "module map: ", module_map
    return Loader(module_map)
