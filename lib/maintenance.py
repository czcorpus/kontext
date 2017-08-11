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
import settings


class MaintenanceController(object):

    def __init__(self, request, ui_lang):
        self.request = request
        self.environ = self.request.environ
        self.ui_lang = ui_lang
        self.cookies = KonTextCookie(self.environ.get('HTTP_COOKIE', ''))

    def _apply_theme(self):
        theme_name = settings.get('theme', 'name')
        theme_css = settings.get('theme', 'css', None)
        if theme_css is None:
            theme_css = []
        elif not hasattr(theme_css, '__iter__'):
            theme_css = [theme_css]

        logo_img = settings.get('theme', 'logo')
        if settings.contains('theme', 'logo_mouseover'):
            logo_alt_img = settings.get('theme', 'logo_mouseover')
        else:
            logo_alt_img = logo_img

        logo_href = ''

        if theme_name == 'default':
            logo_title = _('Click to enter a new query')
        else:
            logo_title = logo_href

        fonts = settings.get('theme', 'fonts', None)
        if fonts is None:
            fonts = []
        elif not hasattr(fonts, '__iter__'):
            fonts = [fonts]

        return {
            'theme_name': settings.get('theme', 'name'),
            'theme_css': [os.path.normpath('../files/themes/%s/%s' % (theme_name, p))
                          for p in theme_css],
            'theme_logo_path': os.path.normpath('../files/themes/%s/%s' % (theme_name, logo_img)),
            'theme_logo_mouseover_path': os.path.normpath('../files/themes/%s/%s' % (theme_name,
                                                                               logo_alt_img)),
            'theme_logo_href': logo_href,
            'theme_logo_title': logo_title,
            'theme_logo_inline_css': settings.get('theme', 'logo_inline_css', ''),
            'theme_fonts': fonts
        }

    def load_topbar(self):
        if plugins.has_plugin('application_bar'):
            import urlparse
            with plugins.runtime.APPLICATION_BAR as ab:
                html = ab.get_contents(self.cookies, 'en', '/')
            parts = urlparse.urlparse(self.environ['REQUEST_URI'])
            css = '<link rel="stylesheet" type="text/css" href="%s://www.korpus.cz/toolbar/css/cnc-toolbar.css" />' \
                % parts.scheme
        else:
            html = ''
            css = ''
        return html, css

    def run(self, *args):
        status = '503 Service Unavailable'
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
            variables.update(self._apply_theme())
            body = body % variables
            f.close()
        return status, headers, True, body.encode('utf-8')

