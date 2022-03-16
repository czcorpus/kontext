import collections
import os
import json
import re
import time
import mailing
from typing import Optional, Dict, List, Any
from sanic import Blueprint
import logging
from dataclasses import asdict
from action.decorators import http_action
from action.krequest import KRequest
from action.response import KResponse
from action.errors import NotFoundException, UserActionException
from action.model.base import BaseActionModel
from action.model.authorized import UserActionModel
from action.model.corpus import CorpusActionModel
from action.model.concordance import ConcActionModel
from action.model.concordance.linesel import LinesGroups
from action.argmapping import log_mapping, ConcArgsMapping, WidectxArgsMapping
from action.argmapping.conc import build_conc_form_args, QueryFormArgs, ShuffleFormArgs
from action.argmapping.conc.filter import FilterFormArgs, FirstHitsFilterFormArgs, QuickFilterArgsConv, SubHitsFilterFormArgs
from action.argmapping.conc.sort import SortFormArgs
from action.argmapping.conc.other import KwicSwitchArgs, LgroupOpArgs, LockedOpFormsArgs
from action.argmapping.analytics import CollFormArgs, FreqFormArgs, CTFreqFormArgs
from texttypes.model import TextTypeCollector
from plugin_types.query_persistence.error import QueryPersistenceRecNotFound
from plugin_types.conc_cache import ConcCacheStatusException
import corplib
import conclib
from conclib.freq import one_level_crit
from conclib.search import get_conc
from conclib.errors import (
    ConcordanceException, ConcordanceQueryParamsError, ConcordanceSpecificationError, UnknownConcordanceAction, extract_manatee_error)
from conclib.empty import InitialConc
from kwiclib import KwicPageArgs, Kwic
import plugins
from main_menu import MainMenu, generate_main_menu
import settings


bp = Blueprint('wordlist')


@bp.route('/wordlist/form')
@http_action(action_model=BaseActionModel)
async def firstform_form(amodel: BaseActionModel, req: KRequest, resp: KResponse):
    pass
