# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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


class AbstractTaghelper(object):

    def tag_variants_file_exists(self, corpus_id):
        """
        Test whether tag variant data exist for a specified
        corpus.

        arguments:
        corpus_id -- a corpus identifier
        """
        raise NotImplementedError()

    def load_tag_descriptions(self, tagset_name, lang):
        """
        Load tags definition as specified by a respective
        client-side widget.

        arguments:
        tagset_name -- an identifier used in tagset definition XML
        lang -- user language (e.g. en_US, cs_CZ)
        """
        raise NotImplementedError()
