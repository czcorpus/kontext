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

from plugins.abstract.appbar import AbstractApplicationBar
from translation import ugettext as _


class LindatTopBar(AbstractApplicationBar):

    def __init__(self, css_url, templates=None):
        self._templates = templates if type(templates) is dict else {}
        self.css_url = css_url

    def get_template(self, lang):
        if lang in self._templates:
            return self._templates[lang]
        else:
            return self._templates['en_US']

    def get_styles(self, plugin_api):
        return [dict(url=self.css_url)]

    def get_contents(self, plugin_api, return_url):
        tpl_path = self.get_template(plugin_api.user_lang)
        with open(tpl_path, mode='rb') as fin:
            html = fin.read().decode('utf-8')

            if not plugin_api.user_is_anonymous:
                msgs = dict(fullname=plugin_api.session.get('user', 'fullname'),
                            logout_url='',
                            logout_msg=_('logout'))
                login_html = '%(fullname)s (<a href="%(logout_url)s">%(logout_msg)s</a>)' % msgs
            else:
                msgs = dict(fullname=_('anonymous'),
                            login_url='',
                            login_msg=_('login'))
                login_html = ('%(fullname)s (<a href="%(login_url)s" class ="signon" onclick="return false;">'
                              '%(login_msg)s</a>)') % msgs
        contents = html + (
            '<ul id="localization-bar" class="navbar-left pull-left list-unstyled" ' +
            'style="position: absolute; top: 0px;">' +
            '</ul>' +
            '<!-- AUTH BAR -->' +
            '<div class="lindat-auth-bar">' +
            '<span class="user">%(user_label)s: %(login_html)s</span>' +
            '</div>' +
            '<!-- AUTH BAR END -->') % dict(user_label=_('User'), login_html=login_html)
        return contents

    def get_fallback_content(self):
        return ''


def create_instance(settings):
    plugin_conf = settings.get('plugins', 'application_bar')
    templates = {
        'cs_CZ': plugin_conf['lindat:template_cs'],
        'en_US': plugin_conf['lindat:template_en']
    }
    return LindatTopBar(templates=templates, css_url=plugin_conf.get('lindat:css_url'))
