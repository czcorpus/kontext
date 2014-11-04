# Copyright (c) 2014 Institute of the Czech National Corpus
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
An abstract implementation of the featured_corpora plug-in.
KonText passes its 'settings' module and 'db' objects as
arguments to the factory method create_instance.

required config.xml entries:
<plugins>
...
    <featured_corpora>
        <module>default_featured_corpora</module>
        <list>
            <item>...a corpus 1 name</item>
            ...
            <item>...a corpus N name</item>
        </list>
    </featured_corpora>
...
</plugins>
"""


class AbstractFeaturedCorpora(object):

    def get_corpora(self, user_id, user_corplist):
        """
        arguments:
        user_id -- an ID of a user
        user_corplist -- list of dicts where each contains at least 'id' and 'name' keys

        returns:
        tuple of 2-tuples (corpus_id, corpus_name)
        """
        raise NotImplementedError()