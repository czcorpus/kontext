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

from conccgi import ConcCGI
from CGIPublisher import exposed


class Actions(ConcCGI):
    """
    An action controller providing services related to the Federated Content Search support
    """

    def __init__(self, environ, ui_lang):
        """
        arguments:
        environ -- wsgi environment variable
        ui_lang -- a language code in which current action's result will be presented
        """
        super(Actions, self).__init__(environ=environ, ui_lang=ui_lang)

    def _create_common_data(self):
        return {
            'version': '1.2'
        }

    def get_mapping_url_prefix(self):
        """
        This is required as it maps the controller to request URLs. In this case,
        all the requests of the form /fcs/[action name]?[parameters] are mapped here.
        """
        return '/fcs/'

    @exposed(return_type='xml')
    def index(self):
        ans = self._create_common_data()
        return ans

    @exposed(return_type='xml')
    def scan(self):
        ans = self._create_common_data()
        return ans

    @exposed(return_type='xml')
    def search_retrieve(self, query=''):
        ans = self._create_common_data()
        return ans