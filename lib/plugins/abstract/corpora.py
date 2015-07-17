# Copyright (c) 2015 Institute of the Czech National Corpus
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
'corparch' plug-in interfaces
"""

import json

from structures import ThreadLocalData


class DictLike(object):
    def __getitem__(self, item):
        return getattr(self, item)

    def __contains__(self, item):
        return hasattr(self, item)

    def get(self, key, default=None):
        return getattr(self, key, default)

    def to_json(self):
        return json.dumps(self, cls=CorpInfoEncoder)


class CorpusMetadata(DictLike):
    def __init__(self):
        self.database = None
        self.label_attr = None
        self.id_attr = None
        self.desc = {}
        self.keywords = {}


class CitationInfo(DictLike):
    def __init__(self):
        self.default_ref = None
        self.article_ref = None
        self.other_bibliography = None


class CorpusInfo(DictLike):
    def __init__(self):
        self.id = None
        self.path = None
        self.web = None
        self.sentence_struct = None
        self.tagset = None
        self.speech_segment = None
        self.bib_struct = None
        self.collator_locale = 'en_US'  # this does not apply for Manatee functions
        self.citation_info = CitationInfo()
        self.metadata = CorpusMetadata()


class CorpInfoEncoder(json.JSONEncoder):
    def default(self, o):
        ans = {}
        for key, val in o.__dict__.items():
            if isinstance(val, DictLike):
                ans[key] = val.__dict__
            else:
                ans[key] = val
        return ans


class AbstractCorporaArchive(ThreadLocalData):
    """
    A template for the 'corparch' (the quite misleading name stays
    for historical reasons) plug-in.

    Please note that the interface may change in the future as it is
    not defined in a KonText core independent way.
    """

    def setup(self, controller_obj):
        pass

    def get_corpus_info(self, corp_id, language=None):
        """
        Returns an information related to the provided corpus ID as defined in
        the respective configuration XML file.

        arguments:
        corp_id -- corpus identifier (both canonical and non-canonical should be accepted)
        language -- a language to export localized data to; both xx_YY and xx variants are
                    accepted (in case there is no match for xx_YY xx is used).
                    If None then all the variants are returned (=> slightly different structure
                    of returned dictionary; typically - instead of a str value there is a dict
                    where keys correspond to language codes).

        returns:
        A dictionary containing corpus information. Expected keys are:
        {id, path, web, sentence_struct, tagset, speech_segment, bib_struct, citation_info,
        metadata} where metadata is a dict with keys {database, label_attr, id_attr, desc, keywords}.
        """
        raise NotImplementedError()

    def get_list(self, user_allowed_corpora):
        """
        Returns a list of dicts containing information about individual corpora.
        (it should be equal to self.corplist().values())

        arguments:
        user_allowed_corpora -- a dict (corpus_canonical_id, corpus_id) of corpora ids the current
                                user can access
        """
        raise NotImplementedError()


class AbstractSearchableCorporaArchive(AbstractCorporaArchive):
    """
    An extended version supporting search by user query
    """

    def search(self, user_id, query, offset=0, limit=None, filter_dict=None):
        """
        Returns a subset of corplist matching provided query.

        arguments:
        user_id -- a database ID of the user who triggered the search
        query -- any search query the concrete plug-in implementation can understand
                 (KonText itself just passes it around).
        offset -- return a list starting from this index (zero-based; default is 0)
        limit -- a maximum number of items to return (default is None; interpretation of None
                 is up to the plug-in, i.e. it can be "no limit" or "default limit" etc.)
        filter_dict -- a dict or werkzeug.datastructures.MultiDict containing additional
                       arguments of the search request; KonText just passes Request.args here

        returns:
        a JSON-serializable dictionary a concrete plug-in implementation understands
        """
        raise NotImplementedError()

    def initial_search_params(self, user_id, lang):
        raise NotImplementedError()
