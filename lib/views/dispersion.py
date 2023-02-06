# Copyright (c) 2012 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

from dataclasses import dataclass
from typing import List

from action.argmapping.analytics import (
    CollFormArgs, CTFreqFormArgs, FreqFormArgs)
from action.control import http_action
from action.errors import ImmediateRedirectException, UserReadableException
from action.krequest import KRequest
from action.model.concordance import ConcActionModel
from action.response import KResponse
from conclib.calc import require_existing_conc
from conclib.errors import ConcNotFoundException
from conclib.pyconc import PyConc
from dataclasses_json import dataclass_json
from main_menu import MainMenu
from sanic import Blueprint

bp = Blueprint('dispersion', url_prefix='dispersion')


@dataclass_json
@dataclass
class FreqDispersionBin:
    start: float
    position: float
    end: float
    freq: int


def _get_freq_dispersion(conc: PyConc, resolution: int) -> List[FreqDispersionBin]:
    conc_begs, values = conc.xdistribution([0] * resolution, 101)

    abs_freq = []
    last_valid_item = None
    for beg in reversed(conc_begs):
        # if beg is 0, it means there are no concordances in the bin
        if beg > 0:
            if last_valid_item is None:
                abs_freq.append(int(conc.size()) - beg)
            else:
                # `last_valid_item - beg` is number of concordances
                # between beginnig of last non empty bin and the beginning of current bin
                # (for cycle is going backwards)
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


@bp.route('/ajax_get_freq_dispersion')
@http_action(action_model=ConcActionModel, return_type='json')
async def ajax_get_freq_dispersion(amodel: ConcActionModel, req: KRequest, resp: KResponse) -> List[FreqDispersionBin]:
    conc = await require_existing_conc(amodel.corp, amodel.args.q)
    resolution = int(req.args.get('resolution', 100))
    if 0 < resolution <= 1000:
        return _get_freq_dispersion(conc, resolution)
    raise UserReadableException('Invalid dispersion resolution. Acceptable values [1, 1000].')


@bp.route('/index')
@http_action(action_model=ConcActionModel, page_model='dispersion', template='dispersion.html')
async def index(amodel: ConcActionModel, req: KRequest, response: KResponse):
    amodel.disabled_menu_items = (
        MainMenu.CONCORDANCE('query-save-as'),
        MainMenu.VIEW('kwic-sent-switch'),
        MainMenu.CONCORDANCE('query-overview'))

    try:
        conc = await require_existing_conc(amodel.corp, amodel.args.q)
    except ConcNotFoundException:
        args = list(req.args.items()) + [('next', 'dispersion')]
        raise ImmediateRedirectException(req.create_url('restore_conc', args))

    resolution = int(req.args.get('resolution', 100))
    if resolution > 1000:
        resolution = 1000
    elif resolution < 1:
        resolution = 1

    result = {
        'coll_form_args': CollFormArgs().update(amodel.args).to_dict(),
        'freq_form_args': FreqFormArgs().update(amodel.args).to_dict(),
        'ctfreq_form_args': CTFreqFormArgs().update(amodel.args).to_dict(),
        'text_types_data': await amodel.tt.export_with_norms(ret_nums=True),
        'dispersion_resolution': resolution,
        'initial_data': _get_freq_dispersion(conc, resolution),
    }
    await amodel.export_query_forms(result)
    return result
