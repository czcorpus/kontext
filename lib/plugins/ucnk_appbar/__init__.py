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
This plug-in is highly dependent on another UCNK-specific plug-in - "ucnk_remote_auth2"
as it expects to find toolbar's code in user session which is exactly what
ucnk_remote_auth2 does (among others).

Required config.xml/plugin entries:

element application_bar {
  element module { "ucnk_appbar" }
  element css_url { text } # URL of an external CSS file specifying imported HTML visuals
}
"""
from plugins import inject
from plugins.abstract.appbar import AbstractApplicationBar


class ApplicationBar(AbstractApplicationBar):

    def __init__(self, auth, css_url):
        self._auth = auth
        self.css_url = css_url

    def get_contents(self, plugin_api, return_url):
        return plugin_api.session.get(self._auth.get_toolbar_session_key(), self.get_fallback_content())

    def get_fallback_content(self):
        return '<div class="appbar-loading-msg" data-reload-toolbar="1"><span>loading toolbar...</span></div>'


@inject('auth')
def create_instance(settings, auth):
    return ApplicationBar(auth=auth,
                          css_url=settings.get('plugins', 'application_bar')['ucnk:css_url'])
