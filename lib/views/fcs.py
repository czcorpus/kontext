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

from dataclasses import asdict, dataclass, field
from typing import Any, List, Optional, Dict, Tuple

import aiofiles
import conclib
import l10n
import plugins
import settings
from action.control import http_action
from action.krequest import KRequest
from action.req_args import AnyRequestArgProxy
from action.model.base import BaseActionModel
from action.argmapping.conc import QueryFormArgs
from action.model.fcs import FCSActionModel, Languages
from action.response import KResponse
from action.errors import ForbiddenException
from sanic import Blueprint

bp_common = Blueprint('fcs-common', url_prefix='fcs')
bp_v1 = bp_common.copy('fcs-v1')


@bp_common.route('/fcs2html')
@http_action(template='fcs/fcs2html.html', action_model=BaseActionModel)
async def fcs2html(amodel: BaseActionModel, req: KRequest, resp: KResponse):
    """
    Returns XSL template for rendering FCS XML.
    """
    resp.set_header('Content-Type', 'text/xsl; charset=utf-8')
    custom_hd_inject_path = settings.get('fcs', 'template_header_inject_file', None)
    if custom_hd_inject_path:
        async with aiofiles.open(custom_hd_inject_path) as fr:
            custom_hdr_inject = await fr.read()
    else:
        custom_hdr_inject = None

    return dict(
        fcs_provider_heading=settings.get('fcs', 'provider_heading', 'KonText FCS Data Provider'),
        fcs_provider_website=settings.get('fcs', 'provider_website', None),
        fcs_template_css_url=settings.get_list('fcs', 'template_css_url'),
        fcs_custom_hdr_inject=custom_hdr_inject,
    )


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
    resp_common.result = amodel.corp.get_posattrs()
    resp_common.numberOfRecords = len(resp_common.result)

    resp['corpus_desc'] = 'Corpus {0} ({1} tokens)'.format(
        amodel.corp.get_conf('NAME'), l10n.simplify_num(amodel.corp.size))
    resp['corpus_lang'] = Languages.get_iso_code(amodel.corp.get_conf('LANGUAGE'))
    resp['show_endpoint_desc'] = (
        True if req.args.get('x-fcs-endpoint-description', 'false') == 'true' else False)

async def op_scan(amodel: FCSActionModel, req: KRequest, resp_common: FCSResponseV1, resp: Dict[str, Any]):
    amodel.check_args(['scanClause', 'responsePosition', 'maximumTerms', 'x-cmd-resource-info'])

    if 'maximumTerms' in req.args:
        try:
            resp_common.maximumTerms = int(req.args.get('maximumTerms'))
        except TypeError:
            raise Exception(6, 'maximumTerms', 'Unsupported parameter value')
    if 'responsePosition' in req.args:
        try:
            resp_common.responsePosition = int(req.args.get('responsePosition'))
        except TypeError:
            raise Exception(6, 'responsePosition', 'Unsupported parameter value')

    scan_clause: str = req.args.get('scanClause', '')
    if scan_clause.startswith('fcs.resource='):
        value = scan_clause.split('=')[1]
        resp_common.result = await amodel.corpora_info(value, resp_common.maximumTerms)
    else:
        resp_common.result = await conclib.fcs_scan(
            amodel.args.corpname, scan_clause, resp_common.maximumTerms, resp_common.responsePosition)
    resp['resourceInfoRequest'] = req.args.get(
        'x-cmd-resource-info', '') == 'true'

async def op_search_retrieve(amodel: FCSActionModel, req: KRequest, resp_common: FCSResponseV1, resp: Dict[str, Any]):
    # TODO we should review the args here (especially x-cmd-context, resultSetTTL)
    amodel.check_args([
        'query', 'startRecord', 'maximumRecords', 'recordPacking',
        'recordSchema', 'resultSetTTL', 'x-cmd-context', 'x-fcs-context'
    ])
    resp_common.corpname = amodel.args.corpname
    # check integer parameters
    if 'maximumRecords' in req.args:
        try:
            resp_common.maximumRecords = int(req.args.get('maximumRecords'))
            if resp_common.maximumRecords <= 0:
                raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
        except TypeError:
            raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
    if 'startRecord' in req.args:
        try:
            resp_common.startRecord = int(req.args.get('startRecord'))
            if resp_common.startRecord <= 0:
                raise Exception(6, 'startRecord', 'Unsupported parameter value')
        except TypeError:
            raise Exception(6, 'startRecord', 'Unsupported parameter value')

    corp_conf_info = await plugins.runtime.CORPARCH.instance.get_corpus_info(
        amodel.plugin_ctx, amodel.args.corpname)
    resp_common.corppid = '' if corp_conf_info.web is None else corp_conf_info.web
    query = req.args.get('query', '')
    if 0 == len(query):
        raise Exception(7, 'fcs_query', 'Mandatory parameter not supplied')

    result, cql_query = await amodel.fcs_search(
        amodel.corp, amodel.args.corpname, query, resp_common.maximumRecords, resp_common.startRecord)
    resp_common.result = result.rows
    resp_common.numberOfRecords = result.size

    form = QueryFormArgs(amodel.plugin_ctx, [resp_common.corpname], True)
    form.data.curr_queries[resp_common.corpname] = cql_query
    form.data.curr_query_types[resp_common.corpname] = 'advanced'
    resp['conc_view_url_tpl'] = req.create_url('view', {'q': ''})

async def determine_curr_corpus(req_args: AnyRequestArgProxy, user: Dict[str, Any]) -> Tuple[str, bool]:
    corpname = req_args.getvalue('x-cmd-context')
    if not corpname:
        default_corp_list = settings.get('corpora', 'default_corpora', [])
        if len(default_corp_list) < 1:
            raise Exception('Cannot determine current corpus')
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
    mutates_result=True,
    corpus_name_determiner=determine_curr_corpus)
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
        version = req.args.get('version')
        if version is not None and current_version < float(version):
            raise Exception(5, version, 'Unsupported version')
        # set content-type in HTTP header
        if 'recordPacking' in req.args:
            common_data.recordPacking = req.args.get('recordPacking')
        if common_data.recordPacking == 'xml':
            pass
        elif common_data.recordPacking == 'string':
            # TODO(jm)!!!
            resp.set_header('Content-Type', 'text/plain; charset=utf-8')
        else:
            raise Exception(71, 'recordPacking', 'Unsupported record packing')

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
            raise Exception(4, '', 'Unsupported operation')

    # catch exception and amend diagnostics in template
    except Exception as e:
        custom_resp['message'] = ('error', repr(e))
        try:
            custom_resp['code'], custom_resp['details'], custom_resp['msg'] = e
        except (ValueError, TypeError):
            custom_resp['code'] = 1
            custom_resp['details'] = repr(e)
            custom_resp['msg'] = 'General system error'

    return {**asdict(common_data), **custom_resp}
