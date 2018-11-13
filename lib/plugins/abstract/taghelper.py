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

    """
    Please note that taghelper is not an instance of CorpusDependentPlugin
    even if it would sound reasonable. The reason is that e.g. in case of
    parallel corpora, tags may not be enabled for primary corpus but they
    can be enabled for one or more aligned corpora. So it is easier to
    enable the plug-in no matter what corpus in on and make some additional
    tests when instantiating query/filter form properties (there we
    use tags_enabled_for method).
    """

    def tags_enabled_for(self, corpus_id):
        """
        Test whether tag variant data exist for a specified
        corpus.

        arguments:
        corpus_id -- a corpus identifier
        """
        raise NotImplementedError()
