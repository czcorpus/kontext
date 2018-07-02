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

"""
This package is activated in case regular 'elasticsearch' client library
is not available. In such case the classes below trigger warnings each
time some API method is called.
"""

import logging


_logger = logging.getLogger(__name__)


class Elasticsearch(object):

    def __init__(self, *args, **kw):
        _logger.warning('Elasticsearch lib not available - instantiating a dummy replacement')


class SnapshotClient(object):

    def __init__(self, client):
        pass

    def create(self, repository, snapshot, body):
        _logger.warning(
            'Calling DUMMY SnapshotClient.create({0}, {1},...)'.format(repository, snapshot))

    def get(self, repository, snapshot):
        _logger.warning(
            'Calling DUMMY SnapshotClient.get({0}, {1},...)'.format(repository, snapshot))
