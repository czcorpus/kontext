from dataclasses import dataclass
from dataclasses_json import dataclass_json
from sanic import Blueprint
from typing import List
from action.model.concordance import ConcActionModel
from action.decorators import http_action
from action.errors import ImmediateRedirectException, UserActionException
from conclib.pyconc import PyConc
from conclib.calc import require_existing_conc
from conclib.errors import ConcNotFoundException

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
async def ajax_get_freq_dispersion(amodel, req, resp) -> List[FreqDispersionBin]:
    conc = require_existing_conc(amodel.corp, amodel.args.q, req.translate)
    resolution = int(req.args.get('resolution', 100))
    if 0 < resolution < 1000:
        return _get_freq_dispersion(conc, resolution)
    raise UserActionException('Invalid dispersion resolution. Acceptable values [1, 1000].')


@bp.route('/index')
@http_action(action_model=ConcActionModel, page_model='dispersion', template='dispersion.html')
async def index(amodel, req, response):
    try:
        conc = require_existing_conc(amodel.corp, amodel.args.q, req.translate)
    except ConcNotFoundException:
        args = list(req.args.items()) + [('next', 'dispersion')]
        raise ImmediateRedirectException(req.create_url('restore_conc', args))

    resolution = int(req.args.get('resolution', 100))
    if resolution > 1000:
        resolution = 1000
    elif resolution < 1:
        resolution = 1

    return {
        'dispersion_resolution': resolution,
        'initial_data': _get_freq_dispersion(conc, resolution),
    }
