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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

"""
A simple auth for users with private API key.

Please note that this is not intended for installation with many
users as sharing a single token between many people is not
very secure.

required xml conf: please see ./config.rng
"""
import hashlib
from plugins.abstract.auth import AbstractRemoteAuth
import plugins


class StaticAuth(AbstractRemoteAuth):

    def __init__(self, anonymous_id, api_key_cookie_name, api_key_http_header, zones):
        super(StaticAuth, self).__init__(anonymous_id)
        self._api_key_cookie_name = api_key_cookie_name
        self._api_key_http_header = api_key_http_header

        self._user_corpora = {}
        self._api_keys = {}
        for zone in zones:
            self._api_keys[zone['api_key']] = zone['user_id']
            list_corpora = {}
            self._user_corpora[zone['user_id']] = list_corpora
            for corp in zone['corpora']:
                tmp = corp.split('/')
                if len(tmp) == 2:
                    list_corpora[tmp[1].lower()] = tmp[0]
                else:
                    list_corpora[tmp[0].lower()] = None

    def anonymous_user(self):
        return dict(
            id=self._anonymous_id,
            user='anonymous',
            fullname=_('anonymous'))

    def is_anonymous(self, user_id):
        return user_id == self._anonymous_id

    def is_administrator(self, user_id):
        return False

    def permitted_corpora(self, user_dict):
        if self.is_anonymous(user_dict['id']):
            return dict()
        else:
            return self._user_corpora[user_dict['id']]

    def get_user_info(self, plugin_api):
        return dict(id=plugin_api.session['user']['id'], user='apiuser', fullname='API user')

    def _hash_key(self, k):
        return hashlib.sha256(k.encode()).hexdigest()

    def _get_api_key(self, plugin_api):
        if self._api_key_cookie_name:
            api_key_cookie = plugin_api.cookies.get('api_key')
            return api_key_cookie.value if api_key_cookie else None
        elif self._api_key_http_header:
            key = 'HTTP_{0}'.format(self._api_key_http_header.upper().replace('-', '_'))
            return plugin_api.get_from_environ(key)

    def revalidate(self, plugin_api):
        curr_user_id = plugin_api.session.get('user', {'id': None})['id']
        api_key = self._get_api_key(plugin_api)
        hash_key = self._hash_key(api_key)
        if api_key and hash_key in self._api_keys:
            if self.is_anonymous(curr_user_id):
                plugin_api.session.clear()
            plugin_api.session['user'] = dict(
                id=self._api_keys[hash_key], user='api_user', fullname='API user')
        else:
            if not self.is_anonymous(curr_user_id):
                plugin_api.session.clear()
            plugin_api.session['user'] = self.anonymous_user()


def create_instance(conf):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    plugin_conf = conf.get('plugins', plugins.runtime.AUTH.name)
    custom_conf = conf.get_plugin_custom_conf(plugins.runtime.AUTH.name)
    return StaticAuth(anonymous_id=int(plugin_conf['anonymous_user_id']),
                      api_key_cookie_name=custom_conf.get('api_key_cookie_name', None),
                      api_key_http_header=custom_conf['api_key_http_header'],
                      zones=custom_conf['zones'])
