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

import os

from controller import KonTextCookie
import plugins
from translation import ugettext as _


class MaintenanceController(object):

    def __init__(self, environ, ui_lang):
        self.environ = environ
        self.ui_lang = ui_lang
        self.cookies = KonTextCookie(self.environ.get('HTTP_COOKIE', ''))

    def load_topbar(self):
        if plugins.has_plugin('application_bar'):
            import urlparse

            html = plugins.application_bar.get_contents(self.cookies, 'en', '/')
            parts = urlparse.urlparse(self.environ['REQUEST_URI'])
            css = '<link rel="stylesheet" type="text/css" href="%s://www.korpus.cz/toolbar/css/cnc-toolbar.css" />' \
                % parts.scheme
        else:
            html = ''
            css = ''
        return html, css

    def run(self):
        status = '500 Internal Server Error'
        headers = [('Content-Type', 'text/html')]

        with open('%s/../public/files/maintenance.html' % os.path.dirname(__file__)) as f:
            body = f.read().decode('utf-8')
            topbar, css = self.load_topbar()
            variables = {
                'topbar': topbar,
                'topbar_css': css,
                'title': _('Application outage'),
                'message': _('The application is under maintenance. Sorry for inconvenience.')
            }
            body = body % variables
            f.close()
        return status, headers, body.encode('utf-8')

