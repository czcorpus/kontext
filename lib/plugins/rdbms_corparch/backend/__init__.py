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

import os
import logging
from collections import OrderedDict
from plugins.abstract.corpora import DefaultManateeCorpusInfo
from fallback_corpus import EmptyCorpus
import manatee


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
            return DefaultManateeCorpusInfo(EmptyCorpus(corpname=corpus_id), corpus_id)


class InstallCorpusInfo(object):
    """
    Provides specific information required
    when installing a new corpus to a corparch
    database.
    """

    def __init__(self, reg_path):
        self._reg_path = reg_path

    def get_corpus_size(self, corp_id):
        c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
        return c.size()

    def get_corpus_name(self, corp_id):
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('NAME').decode(self.get_corpus_encoding(corp_id))
        except:
            return None

    def get_corpus_description(self, corp_id):
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('INFO').decode(self.get_corpus_encoding(corp_id))
        except:
            return None

    def get_corpus_encoding(self, corp_id):
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('ENCODING')
        except:
            return None

    def get_data_path(self, corp_id):
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('PATH').rstrip('/')
        except Exception as ex:
            logging.getLogger(__name__).warning(ex)
            return None


class DatabaseBackend(object):
    """
    An abstract database backend for loading/storing corpus configuration
    data.
    """

    REG_COLS_MAP = OrderedDict(
        NAME='name',
        PATH='path',
        VERTICAL='vertical',
        LANGUAGE='language',
        LOCALE='locale',
        ENCODING='rencoding',
        INFO='info',
        DOCSTRUCTURE='docstructure',
        SHORTREF='shortref',
        FREQTTATTRS='freqttattrs',
        TAGSETDOC='tagsetdoc',
        WPOSLIST='wposlist',
        WSDEF='wsdef',
        WSBASE='wsbase',
        WSTHES='wsthes',
        ALIGNSTRUCT='alignstruct',
        ALIGNDEF='aligndef')

    REG_VAR_COLS_MAP = OrderedDict(
        MAXCONTEXT='maxcontext',
        MAXDETAIL='maxdetail',
        MAXKWIC='maxkwic')

    POS_COLS_MAP = OrderedDict(
        TYPE='type',
        LABEL='label',
        DYNAMIC='dynamic',
        DYNLIB='dynlib',
        ARG1='arg1',
        ARG2='arg2',
        FUNTYPE='funtype',
        DYNTYPE='dyntype',
        TRANSQUERY='transquery',
        MULTIVALUE='multivalue',
        MULTISEP='multisep')

    SATTR_COLS_MAP = OrderedDict(
        TYPE='type',
        LOCALE='locale',
        MULTIVALUE='multivalue',
        DEFAULTVALUE='defaultvalue',
        MAXLISTSIZE='maxlistsize',
        MULTISEP='multisep',
        ATTRDOC='attrdoc',
        ATTRDOCLABEL='attrdoclabel',
        NUMERIC='rnumeric')

    STRUCT_COLS_MAP = OrderedDict(
        TYPE='type',
        DISPLAYTAG='displaytag',
        DISPLAYBEGIN='displaybegin')

    def contains_corpus(self, corpus_id):
        raise NotImplementedError()

    def load_corpus_articles(self, corpus_id):
        raise NotImplementedError()

    def load_all_keywords(self):
        """
        expected db cols: id, label_cs, label_en, color
        """
        raise NotImplementedError()

    def load_ttdesc(self, desc_id):
        """
        """
        raise NotImplementedError()

    def load_corpus(self, corp_id):
        raise NotImplementedError()

    def load_all_corpora(self, substrs=None, keywords=None, min_size=0, max_size=None, requestable=False,
                         offset=0, limit=-1):
        """
        """
        raise NotImplementedError()

    def load_featured_corpora(self, user_lang):
        raise NotImplementedError()

    def load_registry_table(self, corpus_id, variant):
        raise NotImplementedError()

    def load_corpus_posattrs(self, corpus_id):
        raise NotImplementedError()

    def load_corpus_posattr_references(self, corpus_id, posattr_id):
        raise NotImplementedError()

    def load_corpus_alignments(self, corpus_id):
        raise NotImplementedError()

    def load_corpus_structures(self, corpus_id):
        raise NotImplementedError()

    def load_subcorpattrs(self, corpus_id):
        raise NotImplementedError()

    def load_freqttattrs(self, corpus_id):
        raise NotImplementedError()

    def load_tckc_providers(self, corpus_id):
        raise NotImplementedError()

    def load_interval_attrs(self, corpus_id):
        """
        Load structural attributes selectable via
        numeric range (typically - publication date).
        Such attributes are provided with a special
        value selection widget in the text types panel.
        """
        return []


class DatabaseWritableBackend(DatabaseBackend):

    def commit(self):
        raise NotImplementedError()

    def remove_corpus(self, corpus_id):
        raise NotImplementedError()

    def save_corpus_config(self, install_json, registry_dir, corp_size):
        raise NotImplementedError()

    def save_corpus_article(self, text):
        raise NotImplementedError()

    def attach_corpus_article(self, corpus_id, article_id, role):
        raise NotImplementedError()

    def save_registry_table(self, corpus_id, variant, values):
        """
        returns:
        True if a record has been actually created
        or False if the record already exists (and the method did nothing).
        """
        raise NotImplementedError()

    def save_corpus_posattr(self, corpus_id, name, position, values):
        raise NotImplementedError()

    def update_corpus_posattr_references(self, corpus_id, posattr_id, fromattr_id, mapto_id):
        raise NotImplementedError()

    def save_corpus_alignments(self, corpus_id, aligned_ids):
        raise NotImplementedError()

    def save_corpus_structure(self, corpus_id, name, values):
        raise NotImplementedError()

    def save_corpus_structattr(self, corpus_id, struct_id, name, values):
        raise NotImplementedError()

    def save_subcorpattr(self, corpus_id, struct_name, attr_name, idx):
        raise NotImplementedError()

    def save_freqttattr(self, corpus_id, struct_name, attr_name, idx):
        raise NotImplementedError()
