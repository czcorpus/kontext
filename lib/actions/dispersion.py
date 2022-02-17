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

from typing import List
from texttypes.cache import TextTypesCache
import werkzeug
from controller.querying import Querying
from controller import exposed
from controller.errors import ImmediateRedirectException, UserActionException
from conclib.pyconc import PyConc
from conclib.calc import require_existing_conc
from conclib.errors import ConcNotFoundException

from dataclasses import dataclass
from dataclasses_json import dataclass_json


@dataclass_json
@dataclass
class FreqDispersionBin:
    start: float
    position: float
    end: float
    freq: int


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

    def _get_freq_dispersion(self, conc: PyConc, resolution: int) -> List[FreqDispersionBin]:
        conc_begs, values = conc.xdistribution([0] * resolution, 101)

        abs_freq = []
        last_valid_item = None
        for beg in reversed(conc_begs):
            if beg > 0:
                if last_valid_item is None:
                    abs_freq.append(int(conc.size()) - beg)
                else:
                    abs_freq.append(last_valid_item - beg)
                last_valid_item = beg
            else:
                abs_freq.append(0)

        freq_dispersion = [
            FreqDispersionBin(
                100 * i / len(conc_begs),
                100 * (i + 0.5) / len(conc_begs),
                100 * (i + 1) / len(conc_begs),
                freq,
            ) for i, freq in enumerate(reversed(abs_freq))
        ]

        return freq_dispersion

    @exposed(return_type='json')
    def ajax_get_freq_dispersion(self, request: werkzeug.Request) -> List[FreqDispersionBin]:
        conc = require_existing_conc(self.corp, self.args.q)
        resolution = request.args.get('resolution', 100, type=int)
        if 0 < resolution < 1000:
            return self._get_freq_dispersion(conc, resolution)
        raise UserActionException('Invalid dispersion resolution. Acceptable values [1, 1000].')

    @exposed(page_model='dispersion', template='dispersion.html')
    def index(self, request: werkzeug.Request):
        try:
            conc = require_existing_conc(self.corp, self.args.q)
        except ConcNotFoundException:
            args = list(self._request.args.items()) + [('next', 'dispersion')]
            raise ImmediateRedirectException(self.create_url('restore_conc', args))

        resolution = request.args.get('resolution', 100, type=int)
        if resolution > 1000:
            resolution = 1000
        elif resolution < 1:
            resolution = 1

        return {
            'dispersion_resolution': resolution,
            'initial_data': self._get_freq_dispersion(conc, resolution),
        }
