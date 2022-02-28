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

What is required:

1) a directory where localized HTML files are stored. The files
must use UTF-8 encoding. The name format is as follows:

[some name].[two character lang code].html

(e.g.: appbar.cs.html, appbar.en.html, appbar.pl.html)

This is configured as <html_dir>/path/to/the/directory</html_dir>

2) define a default language. Please note that a file from (1) must exist for this
language - otherwise KonText will fail to run.

This is configured as (e.g. for English): <default_lang>en</default_lang>

3) (optional) one or more URLs where CSS files are located.

This is configured as
    <css_urls><item>http://somedomain/somedir/some.css</item><item>...</item></css_urls>

Please note that KonText does not serve CSS for you via this plug-in. To provide a CSS,
you can e.g. use an existing URL from your other website (e.g. your organization).
Or you can create a special location within your proxy server for
the CSSs. E.g. in Nginx:

location /kontext/custom/ {
    alias /var/www/kontext-custom/;
}

4) (optional) one or more URLs where JavaScripts are located.

This is configured as
<js_urls><item>http://somedomain/somedir/some.js</item><item>...</item></js_urls>

There are the same rules applied for serving JS as for serving CSS. I.e. you must provide a working HTTP address
for KonText to load from.

Please see "example" directory to see a working example.


It is also possible to use Python format strings within your static
HTML page source with the following keys KonText automatically fills-in:

username, firstname, lastname, email, id

e.g.: <p>you're logged in as <strong>{username}</strong></p>
"""

import os
import os.path
import logging
from plugin_types.appbar import AbstractApplicationBar
import plugins


class StaticApplicationBar(AbstractApplicationBar):

    def __init__(self, html_dir, css_urls, js_urls, default_lang, avail_langs, auth):
        super(StaticApplicationBar, self).__init__()
        self._css_urls = css_urls
        self._js_urls = js_urls
        self._auth = auth
        self._default_lang = default_lang
        self._avail_langs = avail_langs
        self._html_dir = os.path.normpath(html_dir)
        self._html_files = self._load_html(self._html_dir)

    def _is_in_avail_langs(self, v):
        for a in self._avail_langs:
            if a.startswith(v):
                return True
        return False

    def _load_html(self, dir_path):
        ans = {}
        for fname in os.listdir(dir_path):
            tmp = fname.split('.')
            if len(tmp) == 3 and self._is_in_avail_langs(tmp[1]) and tmp[2] == 'html':
                with open(os.path.join(dir_path, fname)) as fr:
                    ans[tmp[1]] = fr.read()
            else:
                logging.getLogger(__name__).warning(
                    'Possible application bar contents file {0} will be ignored'.format(fname))
        return ans

    def get_styles(self, plugin_ctx):
        return tuple(dict(url=u) for u in self._css_urls)

    def get_scripts(self, plugin_ctx):
        return tuple(self._js_urls)

    def get_contents(self, plugin_ctx, return_url):
        user_info = self._auth.get_user_info(plugin_ctx)
        lang = plugin_ctx.user_lang.split('_')[0]
        html = self._html_files.get(lang)
        if not html:
            try:
                html = self._html_files[self._default_lang]
            except KeyError:
                html = '<p>[Plug-in content error. See the log for more information]</p>'
                logging.getLogger(__name__).error(
                    'missing application bar default language file: {0}/[some name].{1}.html'.format(
                        self._html_dir, self._default_lang))
        return html.format(**user_info)

    def get_fallback_content(self):
        return '<p>Application bar HTML not loaded.</p>'


@plugins.inject(plugins.runtime.AUTH)
def create_instance(settings, auth):
    plg_conf = settings.get('plugins', 'application_bar')
    return StaticApplicationBar(html_dir=plg_conf['html_dir'], css_urls=plg_conf.get('css_urls', []),
                                js_urls=plg_conf.get('js_urls', []),
                                default_lang=plg_conf['default_lang'],
                                avail_langs=settings.get('global', 'translations'), auth=auth)
