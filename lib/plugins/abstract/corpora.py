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
'corptree' plug-in related interfaces.
"""


from structures import ThreadLocalData


class AbstractCorporaArchive(ThreadLocalData):
    """
    A template for the 'corptree' (the quite misleading name stays
    for historical reasons) plug-in.

    Please note that the interface may change in the future as it is
    not defined in a KonText core independent way.
    """

    def setup(self, controller_obj):
        pass

    def get_all_corpus_keywords(self):
        """
        returns:
        a list of 2-tuples (localized_label, spec_prop)
        where spec_prop is int such as that:
        0 - no special property
        1 - featured label
        2 - favorite label
        """
        raise NotImplementedError()

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

    def search(self, corplist, query):
        """
        Returns a list of
        """
        raise NotImplementedError()