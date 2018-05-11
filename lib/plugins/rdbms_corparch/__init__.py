# Copyright (c) 2018 Czech National Corpus
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

import sqlite3
import logging
import re

import manatee
from plugins.abstract.corpora import (AbstractSearchableCorporaArchive, BrokenCorpusInfo, DefaultManateeCorpusInfo,
                                      CorplistProvider)
from fallback_corpus import EmptyCorpus
import l10n


class ManateeCorpora(object):
    """
    A caching source of ManateeCorpusInfo instances.
    """

    def __init__(self):
        self._cache = {}

    def get_info(self, corpus_id):
        try:
            if corpus_id not in self._cache:
                self._cache[corpus_id] = DefaultManateeCorpusInfo(
                    manatee.Corpus(corpus_id), corpus_id)
            return self._cache[corpus_id]
        except:
            # probably a misconfigured/missing corpus
            return DefaultManateeCorpusInfo(EmptyCorpus(corpname=corpus_id),
                                            corpus_id)


class DeafultCorplistProvider(CorplistProvider):
    """
    Corpus listing and filtering service
    """

    def __init__(self, plugin_api, auth, corparch, tag_prefix):
        """
        arguments:
        plugin_api -- a controller.PluginApi instance
        auth -- an auth plug-in instance
        corparch -- a plugins.abstract.corpora.AbstractSearchableCorporaArchive instance
        tag_prefix -- a string determining how a tag (= keyword or label) is recognized
        """
        self._plugin_api = plugin_api
        self._auth = auth
        self._corparch = corparch
        self._tag_prefix = tag_prefix

    @staticmethod
    def cut_result(res, offset, limit):
        right_lim = offset + int(limit)
        new_res = res[offset:right_lim]
        if right_lim >= len(res):
            right_lim = None
        return new_res, right_lim

    @staticmethod
    def matches_all(d):
        return reduce(lambda prev, curr: prev and curr, d, True)

    @staticmethod
    def matches_size(d, min_size, max_size):
        item_size = d.get('size', None)
        return (item_size is not None and
                (not min_size or int(item_size) >= int(min_size)) and
                (not max_size or int(item_size) <= int(max_size)))

    def sort(self, plugin_api, data, *fields):
        def corp_cmp_key(c):
            return c.get('name') if c.get('name') is not None else ''
        return l10n.sort(data, loc=plugin_api.user_lang, key=corp_cmp_key)

    def should_fetch_next(self, ans, offset, limit):
        """
        This quite artificial function can be used to optimize loading of a long list.
        It is expected to depend on how the sort() function is implemented.
        In case there is no sorting involved it is probably OK to skip loading
        whole list once all the 'to be displayed' data is ready.
        """
        return True

    def search(self, plugin_api, query, offset=0, limit=None, filter_dict=None):
        logging.getLogger(__name__).debug('query: {0}'.format(query))
        return []


class RDBMSCorparch(AbstractSearchableCorporaArchive):

    def __init__(self, db_path):
        self._db = sqlite3.connect(db_path)
        self._db.row_factory = sqlite3.Row
        self._mc = ManateeCorpora()

    def _parse_color(self, code):
        code = code.lower()
        transparency = self.LABEL_OVERLAY_TRANSPARENCY
        if code[0] == '#':
            code = code[1:]
            r, g, b = [int('0x%s' % code[i:i + 2], 0) for i in range(0, len(code), 2)]
            return 'rgba(%d, %s, %d, %01.2f)' % (r, g, b, transparency)
        elif code.find('rgb') == 0:
            m = re.match(r'rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)', code, re.IGNORECASE)
            if m:
                return 'rgba(%s, %s, %s, %01.2f)' % (m.group(1), m.group(2), m.group(3), transparency)
        raise ValueError('Invalid color code: %s' % code)

    def _get_corpus_keywords(self, corp_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT id, label_cs, label_en, color FROM keyword_corpus AS kc JOIN keyword AS k '
                       'ON kc.keyword_id = k.id WHERE kc.corpus_id = ?', (corp_id,))
        ans = {}
        for row in cursor.fetchall():
            ans[row['id']] = dict(cs=row['label_cs'], en=row['label_en'])
        return ans

    def corp_info_from_row(self, row):
        if row:
            mci = self._mc.get_info(corpus_id=row['id'])
            ans = self.create_corpus_info()
            logging.getLogger(__name__).debug('row: {0}'.format(dict(row)))
            ans.id = row['id']
            ans.name = mci.name
            ans.web = row['web']
            ans.sentence_struct = row['sentence_struct']
            ans.tagset = row['tagset']
            ans.collator_locale = row['collator_locale']
            ans.speech_segment = row['speech_segment']
            ans.speaker_id_attr = row['speaker_id_attr']
            ans.speech_overlap_attr = row['speech_overlap_attr']
            ans.speech_overlap_val = row['speech_overlap_val']
            ans.use_safe_font = row['use_safe_font']
            ans.metadata.id_attr = row['id_attr']
            ans.metadata.label_attr = row['label_attr']
            ans.metadata.featured = row['featured']
            ans.metadata.database = row['database']
            ans.metadata.keywords = self._get_corpus_keywords(row['id'])
            logging.getLogger(__name__).debug('xxx: {0}'.format(ans.metadata.keywords))
            return ans
        return None

    def _load_corpus_data(self, corp_id, user_lang):
        c = self._db.cursor()
        c.execute('SELECT c.id, c.web, c.sentence_struct, c.tagset, c.collator_locale, c.speech_segment, '
                  'c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font, '
                  'm.database, m.label_attr, m.id_attr, m.featured, m.reference_default, m.reference_other '
                  'FROM corpus AS c JOIN metadata AS m ON c.id = m.corpus_id WHERE c.id = ?', (corp_id,))
        row = c.fetchone()
        return self.corp_info_from_row(row) if row else BrokenCorpusInfo(corp_id=corp_id)

    def get_corpus_info(self, user_lang, corp_id):
        if corp_id:
            ans = self._load_corpus_data(corp_id, user_lang)
        else:
            ans = BrokenCorpusInfo()
        return ans

    def get_list(self, plugin_api, user_allowed_corpora):
        return []


def create_instance(conf):
    return RDBMSCorparch(db_path=conf.get('plugins', 'corparch')['file'])
