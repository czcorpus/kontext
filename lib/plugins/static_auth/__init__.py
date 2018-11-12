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


class StaticAuth(AbstractRemoteAuth):

    def __init__(self, anonymous_id, api_user_id, corpora, api_key, api_key_cookie_name):
        super(StaticAuth, self).__init__(anonymous_id)
        self._api_user_id = api_user_id
        self._corpora = corpora
        self._api_key = api_key
        self._api_key_cookie_name = api_key_cookie_name

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
            return dict((x, None) for x in self._corpora)

    def get_user_info(self, plugin_api):
        return dict(id=self._api_user_id, user='apiuser', fullname='API user')

    def _validate_key(self, k):
        return self._api_key == hashlib.sha256(k).hexdigest()

    def revalidate(self, plugin_api):
        curr_user_id = plugin_api.session.get('user', {'id': None})['id']
        api_key_cookie = plugin_api.cookies.get('api_key')
        api_key = api_key_cookie.value if api_key_cookie else None

        if api_key and self._validate_key(api_key):
            if self.is_anonymous(curr_user_id):
                plugin_api.session.clear()
            plugin_api.session['user'] = dict(
                id=self._api_user_id, user='api_user', fullname='API user')
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
    return StaticAuth(anonymous_id=int(plugin_conf['anonymous_user_id']),
                      api_user_id=int(plugin_conf['default:api_user_id']),
                      corpora=plugin_conf.get('default:corpora', []),
                      api_key=plugin_conf['default:api_key'],
                      api_key_cookie_name=plugin_conf['default:api_key_cookie_name'])
