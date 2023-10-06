# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import asyncio
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import aiofiles
import plugins
import settings
from action.argmapping.conc import QueryFormArgs
from action.control import http_action
from action.errors import ForbiddenException
from action.krequest import KRequest
from action.model.fcs import (
    FCSActionModel, FCSError, FCSResourceInfo, FCSSearchResult)
from action.req_args import AnyRequestArgProxy
from action.response import KResponse
from l10n import get_lang_code
from sanic import Blueprint

bp_common = Blueprint('fcs-common', url_prefix='fcs')
bp_v1 = bp_common.copy('fcs-v1')


@dataclass
class FCSResponseV1:
    corpname: str
    version: float
    server_name: str
    server_port: int
    database: str

    corppid: Optional[str] = None
    recordPacking: str = 'xml'
    result: List[Any] = field(default_factory=list)
    operation: str = 'explain'
    numberOfRecords: int = 0
    maximumRecords: int = 250
    maximumTerms: int = 100
    startRecord: int = 1
    responsePosition: int = 0


async def op_explain(amodel: FCSActionModel, req: KRequest, resp_common: FCSResponseV1, resp: Dict[str, Any]):
    amodel.check_args(['recordPacking', 'x-fcs-endpoint-description'])
    resp_common.numberOfRecords = len(resp_common.result)

    resp['database_title'] = settings.get('fcs', 'database_title')
    resp['database_description'] = settings.get('fcs', 'database_description')
    extended_desc = True if req.args.get('x-fcs-endpoint-description', 'false') == 'true' else False
    resp['show_endpoint_desc'] = extended_desc
    if extended_desc:
        resp['resources'] = []
        # we must determine which attributes are in all fcs set corpora
        attrs_cnt = defaultdict(lambda: 0)
        with plugins.runtime.CORPARCH as ca:
            for corp in settings.get_list('fcs', 'corpora'):
                cinfo = await ca.get_corpus_info(amodel.plugin_ctx, corp)
                for attr in cinfo.manatee.attrs:
                    attrs_cnt[attr] += 1
                if cinfo.manatee.lang:
                    lang_code = get_lang_code(name=cinfo.manatee.lang)
                else:
                    lang_code = get_lang_code(a2=cinfo.collator_locale.split('_')[0])
                resp['resources'].append(
                    FCSResourceInfo(
                        title=corp,
                        description=cinfo.localized_desc('en'),
                        landing_page_uri=cinfo.web,
                        language=lang_code
                    )
                )
        resp_common.result = []
        for attr, cnt in attrs_cnt.items():
            if cnt == len(settings.get_list('fcs', 'corpora')):
                resp_common.result.append(attr)


async def op_scan(amodel: FCSActionModel, req: KRequest, resp_common: FCSResponseV1, resp: Dict[str, Any]):
    amodel.check_args(['scanClause', 'responsePosition', 'maximumTerms', 'x-cmd-resource-info'])

    if 'maximumTerms' in req.args:
        try:
            resp_common.maximumTerms = int(req.args.get('maximumTerms'))
        except Exception:
            raise FCSError(6, 'maximumTerms', 'Unsupported parameter value')
    if 'responsePosition' in req.args:
        try:
            resp_common.responsePosition = int(req.args.get('responsePosition'))
        except Exception:
            raise FCSError(6, 'responsePosition', 'Unsupported parameter value')

    scan_clause: str = req.args.get('scanClause', '')
    if not scan_clause:
        raise FCSError(7, 'scanClause', 'Mandatory parameter not supplied')
    if scan_clause.startswith('fcs.resource='):
        value = scan_clause.split('=')[1]
        resp_common.result = await amodel.corpora_info(value, resp_common.maximumTerms)
    else:
        resp_common.result = await amodel.fcs_scan(
            amodel.args.corpname, scan_clause, resp_common.maximumTerms, resp_common.responsePosition)
    resp['resourceInfoRequest'] = req.args.get(
        'x-cmd-resource-info', '') == 'true'


async def op_search_retrieve(amodel: FCSActionModel, req: KRequest, resp_common: FCSResponseV1, resp: Dict[str, Any]):
    # TODO review resultSetTTL arg
    amodel.check_args([
        'query', 'startRecord', 'maximumRecords', 'recordPacking',
        'recordSchema', 'resultSetTTL', 'x-fcs-context'
    ])
    resp_common.corpname = amodel.args.corpname
    # check integer parameters
    if 'maximumRecords' in req.args:
        try:
            resp_common.maximumRecords = int(req.args.get('maximumRecords'))
            if resp_common.maximumRecords <= 0:
                raise FCSError(6, 'maximumRecords', 'Unsupported parameter value')
        except Exception:
            raise FCSError(6, 'maximumRecords', 'Unsupported parameter value')
    if 'startRecord' in req.args:
        try:
            resp_common.startRecord = int(req.args.get('startRecord'))
            if resp_common.startRecord <= 0:
                raise FCSError(6, 'startRecord', 'Unsupported parameter value')
        except Exception:
            raise FCSError(6, 'startRecord', 'Unsupported parameter value')

    corp_conf_info = await plugins.runtime.CORPARCH.instance.get_corpus_info(
        amodel.plugin_ctx, amodel.args.corpname)
    resp_common.corppid = '' if corp_conf_info.web is None else corp_conf_info.web
    query = req.args.get('query', '')
    if 0 == len(query):
        raise FCSError(7, 'fcs_query', 'Mandatory parameter not supplied')

    # multi-corpora search
    tasks = [
        amodel.fcs_search(
            await amodel.cf.get_corpus(corp),
            query,
            resp_common.maximumRecords,
            resp_common.startRecord,
        )
        for corp in settings.get('fcs', 'corpora')
    ]
    results: List[List[FCSSearchResult], str] = await asyncio.gather(*tasks)
    # merging results
    merged_results = FCSSearchResult(
        rows=[row for result, _ in results for row in result.rows],
        size=sum(r.size for r, _ in results),
    )
    cql_query = results[0][1]

    resp_common.result = merged_results.rows
    resp_common.numberOfRecords = merged_results.size

    form = QueryFormArgs(amodel.plugin_ctx, [resp_common.corpname], True)
    form.data.curr_queries[resp_common.corpname] = cql_query
    form.data.curr_query_types[resp_common.corpname] = 'advanced'
    resp['conc_view_url_tpl'] = req.create_url('view', {'q': ''})


async def determine_curr_corpus(req_args: AnyRequestArgProxy, user: Dict[str, Any]) -> Tuple[str, bool]:
    corpname = req_args.getvalue('x-fcs-context')
    if not corpname:
        default_corp_list = settings.get('corpora', 'default_corpora', [])
        if len(default_corp_list) < 1:
            raise FCSError('Cannot determine current corpus')
        corpname = default_corp_list[0]

    with plugins.runtime.AUTH as auth:
        has_access, variant = await auth.validate_access(corpname, user)
        if not has_access:
            raise ForbiddenException(f'cannot access corpus {corpname}')

    return corpname, False


@bp_v1.route('/v1', ['GET', 'HEAD'])
@http_action(
    template='fcs/v1_complete.html',
    action_model=FCSActionModel,
    corpus_name_determiner=determine_curr_corpus,
    return_type='template_xml')
async def v1(amodel: FCSActionModel, req: KRequest, resp: KResponse):
    resp.set_header('Content-Type', 'application/xml')
    current_version = 1.2
    common_data = FCSResponseV1(
        corpname=amodel.args.corpname,
        version=current_version,
        server_name=req.unwrapped.server_name,
        server_port=req.unwrapped.server_port,
        database=req.unwrapped.server_path
    )
    custom_resp = {}
    # supported parameters for all operations

    try:
        # check operation
        if 'operation' in req.args:
            common_data.operation = req.args.get('operation')
        # check version
        if 'version' in req.args:
            version = req.args.get('version')
            try:
                vnum = float(version)
            except ValueError:
                raise FCSError(5, str(current_version), f'Unsupported version {version}')
            if current_version < vnum:
                raise FCSError(5, str(current_version), f'Unsupported version {version}')
        # set content-type in HTTP header
        if 'recordPacking' in req.args:
            common_data.recordPacking = req.args.get('recordPacking')
        if common_data.recordPacking == 'xml':
            pass
        elif common_data.recordPacking == 'string':
            # TODO what is the format here?
            resp.set_header('Content-Type', 'text/plain; charset=utf-8')
        else:
            raise FCSError(71, 'recordPacking', 'Unsupported record packing')

        try:
            handler = dict(
                explain=op_explain,
                scan=op_scan,
                searchRetrieve=op_search_retrieve,
            )[common_data.operation]
            await handler(amodel, req, common_data, custom_resp)
        except KeyError:
            # show within explain template
            common_data.operation = 'explain'
            raise FCSError(4, '', 'Unsupported operation')

    # catch exception and amend diagnostics in template
    except FCSError as ex:
        custom_resp['code'] = ex.code
        custom_resp['ident'] = ex.ident
        custom_resp['msg'] = ex.msg
    except Exception as e:
        custom_resp['code'] = 1
        custom_resp['ident'] = repr(e)
        custom_resp['msg'] = 'General system error'

    return {**asdict(common_data), **custom_resp}
