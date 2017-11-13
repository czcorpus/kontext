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

from controller.kontext import Kontext
from controller import exposed


class Actions(Kontext):
    """
    An action controller providing services related to the Federated Content Search support
    """

    def __init__(self, request, ui_lang):
        """
        arguments:
        request -- Werkzeug's request object
        ui_lang -- a language code in which current action's result will be presented
        """
        super(Actions, self).__init__(request=request, ui_lang=ui_lang)

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
    def index(self, request):
        ans = self._create_common_data()
        return ans

    @exposed(return_type='xml')
    def scan(self, request):
        ans = self._create_common_data()
        return ans

    @exposed(return_type='xml')
    def search_retrieve(self, request):
        ans = self._create_common_data()
        return ans
