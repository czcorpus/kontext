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
A plugin which loads an HTML code from an external server. Such HTML typically contains an
information about current user, links to other applications etc.

Required config.xml/plugin entries:

<application_bar>
    <module>ucnk_appbar</module>
    <server>[service address (without path part)]</server>
    <path>[path part of the service; placeholders are supported]</path>
    <port>[TCP port used by the external service]</port>
    <css_url>[URL of an external CSS file specifying imported HTML visuals]</css_url>
    <css_url_ie>[IE specific CSS]</css_url_ie>
</application_bar>
"""

import httplib
import urllib
import logging

from abstract.appbar import AbstractApplicationBar
from plugins import inject


class ApplicationBar(AbstractApplicationBar):

    def __init__(self, ticket_id_provider, server, path, port, css_url, css_url_ie):
        self.ticket_id_provider = ticket_id_provider
        self.server = server
        self.path = path
        self.port = port if port else 80
        self.css_url = css_url
        self.css_url_ie = css_url_ie
        self.connection = None

    def get_fallback_content(self):
        return '<div class="appbar-loading-msg" data-reload-toolbar="1"><span>loading toolbar...</span></div>'

    def get_contents(self, cookies, curr_lang, return_url, use_fallback=True, timeout=2):
        """
        see plugins.abstract.appbar.AbstractApplicationBar documentation
        """
        html = None
        if not curr_lang:
            curr_lang = 'en'
        curr_lang = curr_lang.split('_')[0]
        if hasattr(self.ticket_id_provider, 'get_ticket'):
            ticket_id = self.ticket_id_provider.get_ticket(cookies)
            try:
                self.connection = httplib.HTTPConnection(self.server, port=self.port, timeout=timeout)
                self.connection.request('GET', self.path % {
                    'id': ticket_id,
                    'lang': curr_lang,
                    'continue': urllib.quote(return_url)
                })
                response = self.connection.getresponse()
                
                if response and response.status == 200:
                    html = response.read().decode('utf-8')
                else:
                    html = self.get_fallback_content() if use_fallback else None
                    logging.getLogger(__name__).warning('Failed to load toolbar data from authentication server (%s %s). ticket: %s'
                                                        % (response.status, response.reason, ticket_id))
            except Exception as e:
                logging.getLogger(__name__).warning('Failed to load toolbar data from authentication server: %s' % (e, ))
                html = self.get_fallback_content() if use_fallback else None
        return html


@inject('auth')
def create_instance(settings, ticket_id_provider):
    server = settings.get('plugins', 'application_bar').get('server')
    path = settings.get('plugins', 'application_bar').get('path', '')
    port = int(settings.get('plugins', 'application_bar').get('port', 80))
    css_url = settings.get('plugins', 'application_bar').get('css_url', None)
    css_url_ie = settings.get('plugins', 'application_bar').get('css_url_ie', None)
    return ApplicationBar(ticket_id_provider=ticket_id_provider, server=server, path=path, port=port,
                          css_url=css_url, css_url_ie=css_url_ie)