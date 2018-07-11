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

import json
import logging

from plugins.default_token_connect.backends.cache import cached
from plugins.default_token_connect.backends import HTTPBackend


class TreqBackend(HTTPBackend):
    """
    Treq args:
        jazyk1:cs
        jazyk2:en
        hledejKde[]:ACQUIS
        hledejKde[]:CORE
        hledejKde[]:EUROPARL
        hledejKde[]:PRESSEUROP
        hledejKde[]:SUBTITLES
        hledejKde[]:SYNDICATE
        hledejCo:obnova
        searchGo:
    """

    DEFAULT_MAX_RESULT_LINES = 10

    AVAIL_GROUPS = None

    AVAIL_LANG_MAPPINGS = None

    def __init__(self, conf, ident):
        super(TreqBackend, self).__init__(conf, ident)
        self._conf = conf
        self.AVAIL_GROUPS = conf.get('availGroups', {})
        self.AVAIL_LANG_MAPPINGS = conf.get('availTranslations', {})

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
    def mk_api_args(lang1, lang2, groups, word, lemma, pos):
        return [('left', lang1), ('right', lang2), ('viceslovne', 'false'), ('regularni', 'true'),
                ('lemma', 'true'), ('aJeA', 'true'), ('hledejKde', groups), ('hledejCo', word),
                ('order', 'percDesc')]

    @staticmethod
    def mk_page_args(lang1, lang2, groups, word, lemma, pos):
        return [('jazyk1', lang1), ('jazyk2', lang2), ('lemma', 'true'), ('aJeA', 'true'),
                ('hledejCo', word)] + [('hledejKde[]', g) for g in groups]

    def mk_api_path(self, lang1, lang2, groups, word, lemma, pos):
        groups = ','.join(groups)
        args = [u'{0}={1}'.format(k, v) for k, v in self.mk_api_args(
            lang1, lang2, groups, word, lemma, pos)]
        return '/api.php?api=true&' + (u'&'.join(args)).encode('utf-8')

    def find_lang_common_groups(self, lang1, lang2):
        g1 = set(self.AVAIL_GROUPS.get(lang1, []))
        g2 = set(self.AVAIL_GROUPS.get(lang2, []))
        return g1.intersection(g2)

    def mk_server_addr(self):
        if self._conf.get('ssl', False):
            return ('https://' + self._conf['server']).encode('utf-8')
        return ('http://' + self._conf['server']).encode('utf-8')

    @cached
    def fetch_data(self, corpora, lang, word, lemma, **custom_args):
        """
        """
        primary_lang = self._lang_from_corpname(corpora[0])
        translat_corp, translat_lang = self._find_second_lang(corpora)
        treq_link = None
        if translat_corp and translat_lang:
            common_groups = self.find_lang_common_groups(primary_lang, translat_lang)
            args = dict(word=self.enc_val(word), lemma=self.enc_val(lemma),
                        lang1=self.enc_val(primary_lang), lang2=self.enc_val(translat_lang),
                        groups=[self.enc_val(s) for s in common_groups])
            treq_link = (self.mk_server_addr() + '/index.php', self.mk_page_args(**args))
            connection = self.create_connection()
            try:
                logging.getLogger(__name__).debug(u'Treq request args: {0}'.format(args))
                connection.request('GET', self.mk_api_path(**args))
                data, status = self.process_response(connection)
                data = json.loads(data)
                max_items = self._conf.get('maxResultItems', self.DEFAULT_MAX_RESULT_LINES)
                data['lines'] = data['lines'][:max_items]
            finally:
                connection.close()
        else:
            data = dict(sum=0, lines=[])
        return json.dumps(dict(treq_link=treq_link,
                               sum=data.get('sum', 0),
                               translations=data.get('lines', []),
                               primary_corp=corpora[0],
                               translat_corp=translat_corp)), True
