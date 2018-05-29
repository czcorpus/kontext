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

from plugins.abstract.corpora import DefaultManateeCorpusInfo
from fallback_corpus import EmptyCorpus
from collections import OrderedDict
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
        MAXCONTEXT='maxcontext',
        MAXDETAIL='maxdetail',
        MAXKWIC='maxkwic',
        WPOSLIST='wposlist',
        WSDEF='wsdef',
        WSBASE='wsbase',
        WSTHES='wsthes',
        ALIGNSTRUCT='alignstruct',
        ALIGNDEF='aligndef')

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

    def commit(self):
        pass

    def contains_corpus(self, corpus_id):
        raise NotImplementedError()

    def remove_corpus(self, corpus_id):
        raise NotImplementedError()

    def save_corpus_config(self, install_json):
        raise NotImplementedError()

    def save_corpus_article(self, text):
        raise NotImplementedError()

    def attach_corpus_article(self, corpus_id, article_id, role):
        raise NotImplementedError()

    def load_corpus_articles(self, corpus_id):
        raise NotImplementedError()

    def load_all_keywords(self):
        """
        expected db cols: id, label_cs, label_en, color
        """
        raise NotImplementedError()

    def load_description(self, desc_id):
        """
        """
        raise NotImplementedError()

    def load_corpus(self, corp_id):
        raise NotImplementedError()

    def load_all_corpora(self, substrs=None, keywords=None, min_size=0, max_size=None, offset=0, limit=-1):
        """
        """
        raise NotImplementedError()

    def save_registry_table(self, corpus_id, variant, values):
        raise NotImplementedError()

    def load_registry_table(self, corpus_id, variant):
        raise NotImplementedError()

    def save_registry_posattr(self, registry_id, name, position, values):
        raise NotImplementedError()

    def load_registry_posattrs(self, registry_id):
        raise NotImplementedError()

    def update_registry_posattr_references(self, posattr_id, fromattr_id, mapto_id):
        raise NotImplementedError()

    def load_registry_posattr_references(self, posattr_id):
        raise NotImplementedError()

    def save_registry_alignments(self, registry_id, aligned_ids):
        raise NotImplementedError()

    def load_registry_alignments(self, registry_id):
        raise NotImplementedError()

    def save_registry_structure(self, registry_id, name, values, update_existing=False):
        raise NotImplementedError()

    def load_registry_structures(self, registry_id):
        raise NotImplementedError()

    def save_registry_structattr(self, struct_id, name, values):
        raise NotImplementedError()

    def save_subcorpattr(self, struct_id, idx):
        raise NotImplementedError()

    def load_subcorpattrs(self, registry_id):
        raise NotImplementedError()

    def save_freqttattr(self, registry_id, idx):
        raise NotImplementedError()

    def load_freqttattrs(self, registry_id):
        raise NotImplementedError()

    def load_tckc_providers(self, corpus_id):
        raise NotImplementedError()
