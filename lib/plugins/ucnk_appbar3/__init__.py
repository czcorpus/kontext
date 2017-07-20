# Copyright (c) 2014 Institute of the Czech National Corpus
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

"""
A UCNK-specific plug-in which provides an HTML code for page's top 'toolbar'.
This plug-in is highly dependent on another UCNK-specific plug-in - "ucnk_remote_auth3"
as it expects to find toolbar's code in user session which is exactly what
ucnk_remote_auth3 does (among others).

Required config.xml/plugin entries:

element application_bar {
  element module { "ucnk_appbar" }
}
"""
from plugins.abstract.appbar import AbstractApplicationBar


class ApplicationBar3(AbstractApplicationBar):

    @staticmethod
    def _process_styles(conf):
        return map(lambda x: x[1], sorted(conf.items(), key=lambda x: int(x[0])))

    @staticmethod
    def _process_scripts(conf):
        deps = conf['depends'].items()
        for item in deps:
            item[1]['url'] = item[1]['url'].rstrip('.js')
            item[1]['module'] = item[1]['package'] + '/' + item[1]['module']
            del item[1]['package']
        return dict(main=conf['main'].rstrip('.js'),
                    deps=map(lambda x: x[1], deps))

    def get_styles(self, plugin_api):
        toolbar_obj = plugin_api.get_shared('toolbar')
        return self._process_styles(toolbar_obj.get('styles', {}))

    def get_scripts(self, plugin_api):
        toolbar_obj = plugin_api.get_shared('toolbar')
        return self._process_scripts(toolbar_obj.get('scripts', {}))

    def get_contents(self, plugin_api, return_url):
        toolbar_obj = plugin_api.get_shared('toolbar')
        if toolbar_obj:
            return toolbar_obj.get('html')
        else:
            return self.get_fallback_content()

    def get_fallback_content(self):
        return '<div class="cnc-toolbar"><span>toolbar not loaded...</span></div>'


def create_instance(settings):
    return ApplicationBar3()
