# Copyright (c) 2017 Charles University - Faculty of Arts,
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

import logging


class Elasticsearch(object):

    def __init__(self, servers):
        pass

    def index(self, index, doc_type, id, body):
        logging.getLogger(__name__).warning(
            'Failed to store monitored data to ElasticSearch: id: {0}, body: {1}'.format(id, body))
