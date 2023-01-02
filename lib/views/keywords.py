# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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
from typing import List
import time

from action.argmapping import log_mapping
from action.control import http_action
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse
from sanic import Blueprint

bp = Blueprint('keywords', url_prefix='keywords')


@bp.route('/form')
@http_action(access_level=2, template='keywords/form.html', page_model='keywordsForm', action_model=CorpusActionModel)
async def form(amodel: CorpusActionModel, _: KRequest, __: KResponse):
    return {}


@bp.route('/submit', ['POST'])
@http_action(
    access_level=2, return_type='json', mutates_result=True,
    action_log_mapper=log_mapping.keywords, action_model=CorpusActionModel)
async def submit(amodel: CorpusActionModel, req: KRequest, _: KResponse):
    return {}


@bp.route('/result')
@http_action(
    access_level=2, template='keywords/result.html', page_model='keywords',
    action_log_mapper=log_mapping.keywords, action_model=CorpusActionModel)
async def result(amodel: CorpusActionModel, req: KRequest, _: KResponse):
    return {}
