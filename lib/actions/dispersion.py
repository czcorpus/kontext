# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

from texttypes.cache import TextTypesCache
import werkzeug
from controller.querying import Querying
from controller import exposed


class Dispersion(Querying):

    def __init__(self, request: werkzeug.Request, ui_lang: str, tt_cache: TextTypesCache):
        """
        arguments:
        request -- werkzeug's Request obj.
        ui_lang -- a language code in which current action's result will be presented
        """
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self.disabled_menu_items = ()

    def get_mapping_url_prefix(self):
        """
        This is required as it maps the controller to request URLs
        """
        return '/dispersion/'

    @exposed(page_model='dispersion', template='dispersion.html')
    def index(self, request):
        # TODO the action will require at least some concordance ID
        return {}
