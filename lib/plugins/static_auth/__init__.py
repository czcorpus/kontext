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
import settings


class StaticAuth(AbstractRemoteAuth):

    def __init__(self, anonymous_id, api_key_cookie_name, api_key_http_header, zones, zones_meta):
        super(StaticAuth, self).__init__(anonymous_id)
        self._api_key_cookie_name = api_key_cookie_name
        self._api_key_http_header = api_key_http_header

        self._api_keys = {meta['key']: int(meta['user_id']) for meta in zones_meta}
        self._user_corpora = {}
        for corpora, meta in zip(zones, zones_meta):
            list_corpora = {}
            self._user_corpora[int(meta['user_id'])] = list_corpora
            for corp in corpora:
                tmp = corp.split('/')
                if len(tmp) == 2:
                    list_corpora[tmp[1]] = tmp[0]
                else:
                    list_corpora[tmp[0]] = None

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

    def _validate_key(self, k):
        return hashlib.sha256(k.encode()).hexdigest() in self._api_keys

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
        if api_key and self._validate_key(api_key):
            if self.is_anonymous(curr_user_id):
                plugin_api.session.clear()
            hash_key = hashlib.sha256(api_key.encode()).hexdigest()
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
    plugin_conf = conf.get('plugins', 'auth')
    plugin_meta = settings.get_meta('plugins', 'auth')
    return StaticAuth(anonymous_id=int(plugin_conf['anonymous_user_id']),
                      api_key_cookie_name=plugin_conf.get('default:api_key_cookie_name'),
                      api_key_http_header=plugin_conf.get('default:api_key_http_header'),
                      zones=plugin_conf['zones'],
                      zones_meta=plugin_meta['zones'])
