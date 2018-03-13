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

from plugins.default_token_detail.backends import HTTPBackend


AVAIL_LANG_MAPPINGS = {
    'en': ['cs'],
    'cs': ['en']
}

TMP = {
    'obnova': ['recovery', 'restoration', 'reconstruction', 'renewal', 'rehabilitation'],
    'obrana': ['defense', 'defence', 'defending', 'defenses', 'defences', 'defend', 'protection'],
    'obava': ['concern', 'fear', 'apprehension', 'worry', 'anxiety']
}


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

    def __init__(self, conf, ident):
        super(TreqBackend, self).__init__(conf, ident)
        self._conf = conf

    @staticmethod
    def _lang_from_corpname(corpname):
        return corpname.split('_')[-1]

    def _find_second_lang(self, corpora):
        """
        Find a first language+corpus with available translations
        for the primary language (= corpora[0]).
        """
        primary_lang = self._lang_from_corpname(corpora[0])
        translations = AVAIL_LANG_MAPPINGS.get(primary_lang, [])
        for cn in corpora[1:]:
            lang = self._lang_from_corpname(cn)
            if lang in translations:
                return cn, lang
        return None, None

    def fetch_data(self, word, lemma, pos, corpora, lang):
        translat_corp, translat_lang = self._find_second_lang(corpora)
        if translat_corp and translat_lang:
            # TODO return super(TreqBackend, self).fetch_data(word, lemma, pos, corpora, lang)
            if lemma in TMP:
                return json.dumps(dict(treq_link='https://treq.korpus.cz',
                                       translations=TMP[lemma],
                                       primary_corp=corpora[0],
                                       translat_corp=translat_corp)), True
        return json.dumps(dict(treq_link='https://treq.korpus.cz',
                               translations=[],
                               primary_corp=None,
                               translat_corp=None)), False
