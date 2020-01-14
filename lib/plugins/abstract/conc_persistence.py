# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

import abc


class AbstractConcPersistence(abc.ABC):
    """
    Custom conc_persistence plug-in implementations should inherit from this class.

    Concordance persistence plug-in is expected to store current query and provide
    access to it via a string identifier.

    Please note that by 'query' we actually mean two representations:
    1) data entered by user via query form (query, additional options,
       checked checkboxes of text types,...)
    2) encoded version of (1) (controller's self.args.q attribute)

    The essential part is to store values from (2) but for a more convenient
    user experience (1) should be stored too as it allows easy restoring
    of a state of respective forms.
    """

    @abc.abstractmethod
    def is_valid_id(self, data_id):
        """
        Return True if data_id is a valid data identifier else False

        arguments:
        data_id -- identifier to be tested
        """

    @abc.abstractmethod
    def get_conc_ttl_days(self, user_id):
        """
        Returns how many days a concordance link persist for
        a specified user (typically it is a registered vs. public user).
        """

    @abc.abstractmethod
    def open(self, data_id):
        """
        Load operation data according to the passed data_id argument.
        The data are assumed to be public (as are URL parameters of a query).

        arguments:
        data_id -- an unique ID of operation data

        returns:
        a dictionary containing operation data or None if nothing is found
        """

    @abc.abstractmethod
    def store(self, user_id, curr_data, prev_data=None):
        """
        Store a current operation (defined in curr_data) into the database. If also prev_date argument is
        provided then a comparison is performed and based on the result, new record is created and new
        ID is returned. In case there is no reason to store anything (e.g. curr and prev data are the same)
        it is valid to do nothing and return the previous operation ID.

        arguments:
        user_id -- database ID of the current user
        curr_data -- a dictionary containing operation data to be stored; currently at least 'q' entry must be present
        prev_data -- optional dictionary with previous operation data; again, 'q' entry must be there

        returns:
        new operation ID if a new record is created or current ID if no new operation is defined
        """

    @abc.abstractmethod
    def archive(self, user_id, conc_id, revoke=False):
        """
        Make the concordance record persistent. For implementations which
        archive concordances automatically this can be just an empty
        function.

        !!! Important note: it is up to this method to decide
        whether the user user_id is permitted to change
        the concordance identified by conc_id !!!

        arguments:
        user_id -- user who wants to perform the operation
        conc_id -- an identifier of the concordance

        returns:
        a 2-tuple:
         0: number of updates performed (typically - 0 for no need to update anything, 1 - written archive item
         1: respective data row
        """

    @abc.abstractmethod
    def is_archived(self, conc_id):
        """
        arguments:
            conc_id -- a concordance hash

        returns:
            True if the concordance is archived else False
        """
