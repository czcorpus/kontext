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
from controller.errors import ImmediateRedirectException
from conclib.calc import require_existing_conc
from conclib.errors import ConcNotFoundException


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
    def index(self, request: werkzeug.Request):
        try:
            conc = require_existing_conc(self.corp, self.args.q)
        except ConcNotFoundException:
            args = list(self._request.args.items()) + [('next', 'dispersion')]
            raise ImmediateRedirectException(self.create_url('restore_conc', args))

        res = request.args.get('resolution', 100, type=int)
        data = conc.xdistribution([0] * res, res)

        return {
            'dispersion_resolution': res,
            'initial_data': [{'position': beg, 'value': val} for val, beg in data],
        }
