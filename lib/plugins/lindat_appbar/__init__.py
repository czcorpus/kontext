# Copyright (c) 2014 Institute of Formal and Applied Linguistics
# Copyright (c) 2016  Institute of the Czech National Corpus
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
from plugins.abstract.appbar import AbstractApplicationBar
from translation import ugettext as _
from plugins import inject
import plugins


class LindatTopBar(AbstractApplicationBar):

    def __init__(self, css_urls, js_urls, templates=None, logout_url=None):
        self._templates = templates if type(templates) is dict else {}
        self._css_urls = css_urls
        self._js_urls = js_urls
        self._logout_url = logout_url

    def get_template(self, lang):
        if lang in self._templates:
            return self._templates[lang]
        else:
            return self._templates['en_US']

    def get_styles(self, plugin_ctx):
        return [{'url': x} for x in self._css_urls]

    def get_scripts(self, plugin_ctx):
        return self._js_urls

    def get_contents(self, plugin_ctx, return_url):
        tpl_path = self.get_template(plugin_ctx.user_lang)
        if not os.path.exists(tpl_path):
            return "template [%s] does not exist!" % tpl_path
        with open(tpl_path, mode='rb') as fin:
            html = fin.read().decode('utf-8')
            user_classes = "user"

            if not plugin_ctx.user_is_anonymous:
                user_d = plugin_ctx.session["user"]
                msgs = dict(fullname=user_d.get("fullname", "?"),
                            logout_url=self._logout_url or "",
                            logout_msg=_('logout'))
                login_html = ('<i class="fa fa-user fa-lg">&nbsp;</i>%(fullname)s' +
                              '<span style="margin-left: 5px; margin-right: 5px;"> | </span>' +
                              '<form style="display: inline-block;" action="%(logout_url)s" method="POST"><i class="fa fa-sign-out fa-lg">&nbsp;</i><input type="submit" style="border:none;cursor:pointer;background-color:#428bca;color:#fff;font-weight:700;font-size:16px" value="%(logout_msg)s"/></form>'
                              ) % msgs
            else:
                msgs = dict(login_url='',
                            login_msg=_('Login'))
                login_html = ('<a href="%(login_url)s" class ="signon" onclick="return false;">' +
                              '<i class="fa fa-sign-in fa-lg">&nbsp;</i>'
                              '%(login_msg)s</a>') % msgs
                user_classes += " loggedout"
        contents = html + (
            '<ul id="localization-bar" class="navbar-left pull-left list-unstyled" ' +
            'style="position: absolute; top: 0px;">' +
            '</ul>' +
            '<!-- AUTH BAR -->' +
            '<div class="lindat-auth-bar">' +
            '<div class="%(user_classes)s">%(login_html)s</div>' +
            '</div>' +
            '<!-- AUTH BAR END -->') % dict(login_html=login_html, user_classes=user_classes)
        # add proper underline
        contents = "<div id='lindat-tools'>%s</div>" % contents
        return contents

    def get_fallback_content(self):
        return ''


@inject(plugins.runtime.AUTH)
def create_instance(settings, auth):
    """
        Auth must provide `get_logout_url`
    """
    plugin_conf = settings.get('plugins', 'application_bar')
    main_css = plugin_conf.get('css_url')
    external_css = settings.get_list('theme', 'external_css')
    external_js = settings.get_list('theme', 'external_js')
    templates = {
        'cs_CZ': plugin_conf['template_cs'],
        'en_US': plugin_conf['template_en']
    }
    css = [x for x in [main_css] + list(external_css) if x is not None]
    return LindatTopBar(
        templates=templates,
        css_urls=css,
        js_urls=external_js,
        logout_url=auth.get_logout_url(),
    )
