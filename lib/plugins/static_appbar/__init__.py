# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
This is a minimalist implementation of application_bar plug-in.
The plug-in provides a way how to insert a top bar to KonText's
web page with some specific HTML - e.g. if you want to group
multiple applications and provide an access menu to switch
between them. Or if your applications all share some
organization-specific heading.

What you need:

1) a static html file accessible via file-system (e.g. a file
located in KonText's "conf" directory).

This is configured as <html_path extension-by="default">/path/to/the/file</html_path>

2) (optional) one or more URLs where CSS files are located.

This is configured as
    <css_urls extension-by="default"><item>http://somedomain/somedir/some.css</item><item>...</item></css_url>

Please note that KonText does not serve CSS for you via this plug-in. To provide a CSS,
you can e.g. use an existing URL from your other website (e.g. your organization).
Or you can create a special location within your proxy server for
the CSSs. E.g. in Nginx:

location /kontext/custom/ {
    alias /var/www/kontext-custom/;
}

It is also possible to use Python format strings within your static
HTML page source with the following keys KonText automatically fills-in:

username, firstname, lastname, email, id

e.g.: <p>you're logged in as <strong>{username}</strong></p>
"""

from plugins.abstract.appbar import AbstractApplicationBar
import plugins


class StaticApplicationBar(AbstractApplicationBar):

    def __init__(self, html_path, css_urls, auth):
        super(StaticApplicationBar, self).__init__()
        self._css_urls = css_urls
        self._auth = auth
        with open(html_path) as fr:
            self._html = fr.read()

    def get_styles(self, plugin_api):
        return tuple(dict(url=u) for u in self._css_urls)

    def get_scripts(self, plugin_api):
        return []

    def get_contents(self, plugin_api, return_url):
        user_info = self._auth.get_user_info(plugin_api)
        return self._html.format(**user_info)

    def get_fallback_content(self):
        return '<p>Application bar HTML not loaded.</p>'


@plugins.inject(plugins.runtime.AUTH)
def create_instance(settings, auth):
    plg_conf = settings.get('plugins', 'application_bar')
    return StaticApplicationBar(plg_conf['default:html_path'], plg_conf.get('default:css_urls', []), auth)
