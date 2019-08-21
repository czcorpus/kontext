# Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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
This module contains classes representing individual corpus metadata/description.
We try to pack together data from KonText corparch data, Manatee data and possible
other sources. So anytime KonText wants to access individual
corpus information it excepts instances of these classes to be
involved.

Please note that corpus as an item from corparch list is not
represented here as it is solely a problem of individual corparch
implementations where typically we need only a few items when
listing corpora (name, size,...).

The classes are storage-independent which means that
a concrete format of stored corpora information is up to
a concrete 'corparch' plug-in (default_corparch uses XML)

Please note that many of the attributes defined here are
tightly related to respective corpora registry (configuration)
files.
"""

import json
from functools import partial

import l10n


class DictLike(object):
    def __getitem__(self, item):
        return getattr(self, item)

    def __contains__(self, item):
        return hasattr(self, item)

    def get(self, key, default=None):
        return getattr(self, key, default)

    def to_json(self):
        return json.dumps(self, cls=CorpInfoEncoder)

    def to_dict(self):
        return CorpInfoEncoder().default(self)


class CorpusMetadata(DictLike):
    def __init__(self):
        self.database = None
        self.label_attr = None
        self.avg_label_attr_len = None
        self.id_attr = None
        self.sort_attrs = False
        self.desc = {}
        self.keywords = {}
        self.interval_attrs = []
        self.group_duplicates = False


class CitationInfo(DictLike):
    def __init__(self):
        self.default_ref = None
        self.article_ref = []
        self.other_bibliography = None

    def to_dict(self):
        return dict((k, v) for k, v in self.__dict__.items())


class ManateeCorpusInfo(DictLike):
    """
    Represents a subset of corpus information
    as provided by manatee.Corpus instance
    """

    def __init__(self):
        self.encoding = None
        self.name = None
        self.description = None
        self.attrs = []
        self.size = 0
        self.has_lemma = False
        self.tagset_doc = None
        self.lang = None


class DefaultManateeCorpusInfo(ManateeCorpusInfo):
    """
    Represents a subset of corpus information
    as provided by manatee.Corpus instance
    """

    def __init__(self, corpus, corpus_id):
        super(DefaultManateeCorpusInfo, self).__init__()
        self.encoding = corpus.get_conf('ENCODING')
        import_string = partial(l10n.import_string, from_encoding=self.encoding)
        self.name = import_string(corpus.get_conf('NAME') if corpus.get_conf('NAME')
                                  else corpus_id)
        self.description = import_string(corpus.get_info())
        self.attrs = filter(lambda x: len(x) > 0, corpus.get_conf('ATTRLIST').split(','))
        self.size = corpus.size()
        attrlist = corpus.get_conf('ATTRLIST').split(',')
        self.has_lemma = 'lempos' in attrlist or 'lemma' in attrlist
        self.tagset_doc = import_string(corpus.get_conf('TAGSETDOC'))
        self.lang = import_string(corpus.get_conf('LANGUAGE'))


class TokenConnect(DictLike):

    def __init__(self):
        self.providers = []


class KwicConnect(DictLike):

    def __init__(self):
        self.providers = []


class CorpusInfo(DictLike):
    """
    Genereal corpus information and metadata.
    All the possible implementations are expected to
    be user-independent. I.e. all the information must
    apply for all the users.
    """

    def __init__(self):
        self.id = None
        self.name = None
        self.path = None
        self.web = None
        self.sentence_struct = None
        self.tagset = None
        self.tagset_type = None  # positional/keyval/other
        self.tagset_pos_attr = None  # a positional attr reserved for PoS
        self.tagset_feat_attr = None  # a positional attr reserved for all (other) features
        self.speech_segment = None
        self.speaker_id_attr = None
        self.speech_overlap_attr = None
        self.speech_overlap_val = None
        self.bib_struct = None
        self.sample_size = -1
        self.featured = False
        self.collator_locale = 'en_US'  # this does not apply for Manatee functions
        self.use_safe_font = False
        self.citation_info = CitationInfo()
        self.metadata = CorpusMetadata()
        self.token_connect = TokenConnect()
        self.kwic_connect = KwicConnect()
        self.manatee = ManateeCorpusInfo()


class BrokenCorpusInfo(CorpusInfo):
    """
    An incomplete corpus information. It should be used in corpora lists/search
    results instead of None and similar solutions to prevent unwanted exceptions
    to be risen. Broken corpus information still does not mean that the corpus
    cannot be used - but KonText prevents this (in controller's pre_dispatch)
    because missing configuration can break/disable many functions.
    """

    def __init__(self, name=None):
        super(BrokenCorpusInfo, self).__init__()
        self.name = (name if name else 'undefined')
        self.metadata = CorpusMetadata()
        self.manatee = ManateeCorpusInfo()


class CorpInfoEncoder(json.JSONEncoder):
    def default(self, o):
        ans = {}
        for key, val in o.__dict__.items():
            if isinstance(val, DictLike):
                ans[key] = val.__dict__
            else:
                ans[key] = val
        return ans


class AbstractCorporaArchive(object):
    """
    A template for the 'corparch' (the quite misleading name stays
    for historical reasons) plug-in.

    Please note that the interface may change in the future as it is
    not defined in a KonText core independent way.
    """

    def get_corpus_info(self, user_lang, corp_id):
        """
        Return a full available corpus information.

        Important note: the method should never raise
        an exception. In case of an error please return
        BrokenCorpusInfo from this package.

        arguments:
        user_lang -- user language (e.g. en_US)
        corp_id -- corpus identifier

        returns:
        A dictionary containing corpus information. Expected keys are:
        {id, path, web, sentence_struct, tagset, speech_segment, bib_struct, citation_info,
        metadata} where metadata is a dict with keys {database, label_attr, id_attr, desc, keywords}.
        """
        raise NotImplementedError()

    def mod_corplist_menu(self, plugin_api, menu_item):
        """
        The method allows the plug-in to customize main menu link from "Corpora -> Available corpora".
        """
        pass


class SimpleCorporaArchive(AbstractCorporaArchive):
    """
    An archive without server-side searching/filtering abilities
    """

    def get_all(self, plugin_api):
        """
        Return all the available corpora (user credentials can be accessed
        via plugin_api).
        """
        raise NotImplementedError()


class CorplistProvider(object):
    """
    An object providing actual corpus list based on passed arguments.
    """

    def search(self, plugin_api, query, offset=0, limit=None, filter_dict=None):
        """
        arguments:
        plugin_api --
        query -- raw query entered by user (possibly modified by client-side code)
        offset -- zero-based offset specifying returned data
        limit -- number of items to return
        filter_dict -- a dictionary containing additional search parameters
        """
        raise NotImplementedError()


class AbstractSearchableCorporaArchive(AbstractCorporaArchive):
    """
    An extended version supporting search by user query
    """

    def search(self, plugin_api, query, offset=0, limit=None, filter_dict=None):
        """
        Returns a subset of corplist matching provided query.

        arguments:
        plugin_api -- a controller.PluginApi instance
        query -- any search query the concrete plug-in implementation can understand
                 (KonText itself just passes it around). If False then default parameters
                 are expected. An empty string is understood as "no query".
        offset -- return a list starting from this index (zero-based; default is 0)
        limit -- a maximum number of items to return (default is None; interpretation of None
                 is up to the plug-in, i.e. it can be "no limit" or "default limit" etc.)
        filter_dict -- a dict or werkzeug.datastructures.MultiDict containing additional
                       arguments of the search request; KonText just passes Request.args here

        returns:
        a JSON-serializable dictionary a concrete plug-in implementation understands
        """
        service = self.create_corplist_provider(plugin_api)
        return service.search(plugin_api=plugin_api, query=query, offset=offset, limit=limit,
                              filter_dict=filter_dict)

    def create_corplist_provider(self, plugin_api):
        """
        A factory function for a configured search service

        arguments:
        plugin_api -- a controller.PluginApi instance

        returns:
        A CorplistProvider instance
        """
        raise NotImplementedError()

    def initial_search_params(self, plugin_api, query, args):
        """
        Return a dictionary containing initial corpus search parameters.
        (e.g. you typically don't want to display a full list so you can set a page size).
        """
        raise NotImplementedError()

    def custom_filter(self, plugin_api, corpus_list_item, permitted_corpora):
        """
        An optional custom filter to exclude specific items from results.

        arguments:
        plugin_api -- a controller.PluginApi instance
        corpus_list_item -- a CorpusListItem object
        permitted_corpora -- a dict (corpus_id, corpus_variant) as returned
                             by auth.permitted_corpora
        """
        return True

    def create_corpus_info(self):
        """
        An optional factory method which returns a CorpusInfo compatible instance.
        Overriding this method allows you to use your own CorpusInfo implementations.
        """
        return CorpusInfo()
