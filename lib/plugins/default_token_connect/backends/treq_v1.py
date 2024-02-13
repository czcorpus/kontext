# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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
import urllib.parse

from aiohttp import ClientSession
import ujson as json
from plugins.common.http import HTTPApiLogin, HTTPUnauthorized
from plugins.default_token_connect.backends import HTTPBackend
from plugins.default_token_connect.backends.cache import cached


class TreqBackend(HTTPBackend):
    """
    Treq args:
        from:cs
        to:en
        pkgs[]:ACQUIS
        pkgs[]:CORE
        pkgs[]:EUROPARL
        pkgs[]:PRESSEUROP
        pkgs[]:SUBTITLES
        pkgs[]:SYNDICATE
        query:obnova
        multiword:
        lemma:
    """

    DEFAULT_MAX_RESULT_LINES = 10

    DEFAULT_SID_COOKIE_NAME = 'cnc_toolbar_sid'

    AVAIL_GROUPS = None

    AVAIL_LANG_MAPPINGS = None

    ANONYMOUS_SESSION_ID = None

    def __init__(self, conf, ident, db, ttl):
        super().__init__(conf, ident, db, ttl)
        self._conf = conf
        self.BACKLINK_SERVER = conf.get('backlinkServer', conf['server'])
        self.AVAIL_GROUPS = conf.get('availGroups', {})
        self.AVAIL_LANG_MAPPINGS = conf.get('availTranslations', {})

        self._token_api_client = HTTPApiLogin(
            conf.get('apiLoginUrl'),
            conf.get('apiToken'),
            self.sid_cookie,
        )

    @property
    def sid_cookie(self):
        return self._conf.get('sidCookie', self.DEFAULT_SID_COOKIE_NAME)

    def get_required_cookies(self):
        return [self.sid_cookie]

    @staticmethod
    def _lang_from_corpname(corpname):
        return corpname.split('_')[-1]

    def _find_second_lang(self, corpora):
        """
        Find a first language+corpus with available translations
        for the primary language (= corpora[0]).
        """
        primary_lang = self._lang_from_corpname(corpora[0])
        translations = self.AVAIL_LANG_MAPPINGS.get(primary_lang, [])
        for cn in corpora[1:]:
            lang = self._lang_from_corpname(cn)
            if lang in translations:
                return cn, lang
        return None, None

    def enabled_for_corpora(self, corpora):
        corp1 = corpora[0]
        corp2 = corpora[1] if len(corpora) > 1 else None
        if corp2 is None:
            return False
        lang1 = self._lang_from_corpname(corp1)
        lang2 = self._lang_from_corpname(corp2)
        return lang1 in self.AVAIL_LANG_MAPPINGS and lang2 in self.AVAIL_LANG_MAPPINGS[lang1]

    @staticmethod
    def mk_api_args(lang1, lang2, groups, lemma):
        multiw_flag = 'true' if ' ' in lemma else 'false'
        lemma_flag = 'false' if ' ' in lemma else 'true'
        return [('from', lang1), ('to', lang2), ('multiword', multiw_flag), ('regex', 'false'),
                ('lemma', lemma_flag), ('ci', 'true'), ('query', lemma),
                ('order', 'perc'), ('asc', 'false')] + [(f'pkgs[{i}]', group) for i, group in enumerate(groups)]

    @staticmethod
    def mk_backlink_args(lang1, lang2, groups, lemma):
        multiw_flag = '1' if ' ' in lemma else '0'
        lemma_flag = '0' if ' ' in lemma else '1'
        return [('jazyk1', lang1), ('jazyk2', lang2), ('viceslovne', multiw_flag), ('regularni', '0'),
                ('lemma', lemma_flag), ('caseInsen', '1'), ('hledejCo', lemma)] + [('hledejKde[]', g) for g in groups]

    def mk_api_path(self, args):
        args = ['{0}={1}'.format(k, urllib.parse.quote(v.encode('utf-8'))) for k, v in args]
        return self._conf['path'] + '?' + '&'.join(args)

    def find_lang_common_groups(self, lang1, lang2):
        g1 = set(self.AVAIL_GROUPS.get(lang1, []))
        g2 = set(self.AVAIL_GROUPS.get(lang2, []))
        return g1.intersection(g2)

    def mk_backlink_addr(self):
        if self._conf.get('ssl', False):
            return f'https://{self.BACKLINK_SERVER}'
        return f'http://{self.BACKLINK_SERVER}'

    async def _make_request(self, client_session: ClientSession, path: str, session_id: str):
        headers = {'Cookie': f'{self.sid_cookie}={session_id}'}
        data, valid = await self._requester.request('GET', path, {}, headers=headers)
        return json.loads(data)

    @cached
    async def fetch(
            self, plugin_ctx, corpora, maincorp, token_id, num_tokens, query_args, lang, is_anonymous, context=None, cookies=None):
        """
        """
        primary_lang = self._lang_from_corpname(corpora[0])
        translat_corp, translat_lang = self._find_second_lang(corpora)
        treq_link = None
        if translat_corp and translat_lang:
            common_groups = self.find_lang_common_groups(primary_lang, translat_lang)
            args = dict(
                lang1=self._requester.enc_val(primary_lang), lang2=self._requester.enc_val(translat_lang),
                groups=[self._requester.enc_val(s) for s in common_groups],
                **query_args)
            t_args = self.mk_backlink_args(**args)
            treq_link = (self.mk_backlink_addr() + '/index.php', t_args)
            ta_args = self.mk_api_args(
                lang1=args['lang1'], lang2=args['lang2'], groups=args['groups'], lemma=args['lemma'])
            data = None

            try:
                logging.getLogger(__name__).debug('Treq request args: {0}'.format(ta_args))
                path = self.mk_api_path(ta_args)
                if is_anonymous:
                    try:
                        data = await self._make_request(plugin_ctx.http_client, path, self.ANONYMOUS_SESSION_ID)
                    except HTTPUnauthorized:
                        self.ANONYMOUS_SESSION_ID = await self._token_api_client.login(plugin_ctx.http_client)
                        data = await self._make_request(plugin_ctx.http_client, path, self.ANONYMOUS_SESSION_ID)
                else:
                    data = await self._make_request(plugin_ctx.http_client, path, cookies[self.sid_cookie])

                max_items = self._conf.get('maxResultItems', self.DEFAULT_MAX_RESULT_LINES)
                orig = data['lines'][:max_items]
                data['lines'] = []
                for item in orig:
                    data['lines'].append(dict(
                        freq=item['freq'], perc=item['perc'], left=item['from'], righ=item['to']))
            except ValueError:
                logging.getLogger(__name__).error('Failed to parse response: {0}'.format(data))
                data = dict(sum=0, lines=[])

        else:
            data = dict(sum=0, lines=[])
        return json.dumps(dict(
            treq_link=treq_link,
            sum=data.get('sum', 0),
            translations=data.get('lines', []),
            primary_corp=corpora[0],
            translat_corp=translat_corp)), True
