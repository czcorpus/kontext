# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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

import logging

from plugin_types.token_connect import AbstractBackend, BackendException
from plugins.common.http import HTTPClient
from plugins.default_token_connect.backends.cache import cached


class DisplayLinkBackend(AbstractBackend):
    """
    DisplayLink just shows a clickable link to an external service. I.e. the plug-in does not
    load any content from the target service in this case.
    """
    def __init__(self, conf, ident, db, ttl):
        super().__init__(ident, db, ttl)
        self._conf = conf

    def get_required_attrs(self):
        return self._conf.get('posAttrs', [])

    async def fetch(self, corpora, maincorp, token_id, num_tokens, query_args, lang, context=None, cookies=None):
        attr = self._conf['posAttrs'][0]
        value = query_args[attr]
        if value:
            proto_pref = 'https://' if bool(self._conf['ssl']) is True else 'http://'
            server = self._conf['server']
            path = self._conf['path']
            link = f'{proto_pref}{server}{path}'.format(**query_args)
            return dict(link=link), True
        return dict(), False


class HTTPBackend(AbstractBackend):
    """
    The default_token_connect's JSON config file defines a template of an abstract path identifying a resource.
    It can be a URL path, SQL or a filesystem path. Such a template can use values defined in conf.attrs. Structural
    attribute names are accessed like this: struct[attr]. E.g. attrs = ["word", "lemma", "doc.id"] can be used in
    a URL template like this: my_server/my/path?word={word}&lemma={lemma}&docid={doc[id]}.

    There are also some predefined attributes (with lower priority, i.e. you can overwrite then with your attrs spec.):
        - ui_lang
        - corpus
        - corpus2 (= first aligned corpus)
        - token_id (numeric token index specifies an absolute order of the token in corpus)
        - num_tokens (mainly for multi-word kwics)
    """

    def __init__(self, conf, ident, db, ttl):
        super().__init__(ident, db, ttl)
        self._conf = conf
        port_str = '' if self._conf.get('port', 80) else ':{}'.format(self._conf.get('port'))
        if self._conf['ssl']:
            self._client = HTTPClient('https://{}{}'.format(self._conf['server'], port_str))
        else:
            self._client = HTTPClient('http://{}{}'.format(self._conf['server'], port_str))


    @cached
    async def fetch(self, corpora, maincorp, token_id, num_tokens, query_args, lang, context=None, cookies=None):
        args = dict(
            ui_lang=self._client.enc_val(lang), corpus=self._client.enc_val(corpora[0]),
            corpus2=self._client.enc_val(corpora[1] if len(corpora) > 1 else ''),
            token_id=token_id, num_tokens=num_tokens,
            **dict(
                (k, dict((k2, self._client.enc_val(v2))
                         for k2, v2 in list(v.items())) if type(v) is dict else self._client.enc_val(v))
                for k, v in list(query_args.items())))
        logging.getLogger(__name__).debug('HTTP Backend args: {0}'.format(args))

        try:
            query_string = self._conf['path'].format(**args)
        except KeyError as ex:
            raise BackendException('Failed to build query - value {0} not found'.format(ex))

        return await self._client.request('GET', query_string, {})
