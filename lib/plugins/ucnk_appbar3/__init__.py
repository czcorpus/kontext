# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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
This plug-in is highly dependent on:
 - UCNK internal authentication service and its API
 - another UCNK-specific plug-in - "ucnk_remote_auth4" (or the older version ucnk_remote_auth3)
   as it expects to find toolbar's code in user session which is exactly what ucnk_remote_auth3/4
   does (among others).

Required config.xml/plugin entries: please see ./config.rng


dependencies info structure:

{
    'depends': {
        '1': {
            'url': 'https://www.korpus.cz/toolbar/vendor/webmodel/ui/main.js',
            'version': '0',
            'module': 'main',
            'package': 'webmodel/ui'
        },
        '0': {
            'url': 'https://code.jquery.com/jquery-1.12.4.min.js',
            'version': '1.12.4',
            'module': 'jquery',
            'package': 'jquery/jquery'
        }
    },
    'main': 'https://www.korpus.cz/toolbar/js/toolbar.js'
}
"""
from plugins.abstract.appbar import AbstractApplicationBar


class ApplicationBar3(AbstractApplicationBar):

    @staticmethod
    def _process_styles(conf):
        return [x[1] for x in sorted(list(conf.items()), key=lambda x: int(x[0]))]

    @staticmethod
    def _process_scripts(conf):
        scripts = []
        for k, item in sorted(list(conf.get('depends', {}).items()), key=lambda v: int(v[0])):
            scripts.append(item['url'])
        scripts.append(conf['main'])
        return scripts

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
