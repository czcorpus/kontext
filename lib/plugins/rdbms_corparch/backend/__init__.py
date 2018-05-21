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

import manatee
from plugins.abstract.corpora import DefaultManateeCorpusInfo
from fallback_corpus import EmptyCorpus


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

    REG_COLS_MAP = dict(NAME='name',
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
                        ALIGNDEF='aligndef'
                        )

    POS_COLS_MAP = dict(TYPE='type',
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

    SATTR_COLS_MAP = dict(TYPE='type',
                          LOCALE='locale',
                          MULTIVALUE='multivalue',
                          DEFAULTVALUE='defaultvalue',
                          MAXLISTSIZE='maxlistsize',
                          MULTISEP='multisep',
                          ATTRDOC='attrdoc',
                          ATTRDOCLABEL='attrdoclabel',
                          NUMERIC='rnumeric',
                          DISPLAYTAG='displaytag',
                          DISPLAYBEGIN='displaybegin')

    def commit(self):
        pass

    def get_corpus_keywords(self, corp_id):
        raise NotImplementedError()

    def load_all_keywords(self):
        """
        expected db cols: id, label_cs, label_en, color
        """
        raise NotImplementedError()

    def load_descriptions(self):
        """
        expected db cols: id, text_[lang],...
        """
        raise NotImplementedError()

    def load_all_corpora(self):
        """
        expected db cols: c.id, c.web, c.sentence_struct, c.tagset, c.collator_locale, c.speech_segment,
                          c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font,
                          m.database, m.label_attr, m.id_attr, m.featured, m.reference_default, m.reference_other,
                          tc.ttdesc_id AS ttdesc_id
        """
        raise NotImplementedError()

    def save_registry_table(self, corpus_id, variant, values):
        raise NotImplementedError()

    def load_registry_table(self, corpus_id, variant):
        raise NotImplementedError()

    def save_registry_posattr(self, registry_id, name, values):
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

    def save_registry_structure(self, registry_id, name, type):
        raise NotImplementedError()

    def save_registry_structattr(self, struct_id, name, values):
        raise NotImplementedError()

    def save_subcorpattr(self, struct_id, idx):
        raise NotImplementedError()

    def get_subcorpattrs(self, registry_id):
        raise NotImplementedError()

    def save_freqttattr(self, registry_id, idx):
        raise NotImplementedError()

    def get_freqttattrs(self, registry_id):
        raise NotImplementedError()
