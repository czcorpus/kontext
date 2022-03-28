# coding=utf-8
from dataclasses import asdict, dataclass, field
from typing import Any, List, Optional
import urllib.parse
import logging

from sanic import Blueprint

import l10n
import conclib
from action.model.fcs import FCSActionModel, Languages
from action.decorators import http_action
from action.krequest import KRequest
from action.model.base import BaseActionModel
from action.response import KResponse
import plugins
import settings

bp_common = Blueprint('fcs-common', url_prefix='fcs')
bp_v1 = bp_common.copy('fcs-v1', version=1)


@bp_common.route('/fcs2html')
@http_action(template='fcs/fcs2html.html', action_model=BaseActionModel)
async def fcs2html(amodel: BaseActionModel, req: KRequest, resp: KResponse):
    """
    Returns XSL template for rendering FCS XML.
    """
    resp.set_header('Content-Type', 'text/xsl; charset=utf-8')
    custom_hd_inject_path = settings.get('fcs', 'template_header_inject_file', None)
    if custom_hd_inject_path:
        with open(custom_hd_inject_path) as fr:
            custom_hdr_inject = fr.read()
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
    databse: str
    corppid: Optional[str] = None
    recordPacking: str = 'xml'
    result: List[Any] = field(default=[])
    operation: str = 'explain'
    numberOfRecords: int = 0
    maximumRecords: int = 250
    maximumTerms: int = 100
    startRecord: int = 1
    responsePosition: int = 0


@bp_v1.route('', ['GET', 'HEAD'])
@http_action(template='fcs/v1_complete.html', action_model=FCSActionModel)
async def v1(amodel: FCSActionModel, req: KRequest, resp: KResponse):
    resp.set_header('Content-Type', 'application/xml')
    current_version = 1.2

    default_corp_list = settings.get('corpora', 'default_corpora', [])
    corpname = None
    if 0 == len(default_corp_list):
        logging.getLogger(__name__).critical('FCS cannot work properly without a default_corpora set')
    else:
        corpname = default_corp_list[0]

    pr = urllib.parse.urlparse(req.remote_addr)
    common_data = FCSResponseV1(
        corpname=corpname,
        version=current_version,
        server_name=req.unwrapped.server_name,
        server_port=req.unwrapped.server_port,
        database=req.unwrapped.server_path
    )
    additional_data = {}
    # supported parameters for all operations
    supported_args = ['operation', 'stylesheet', 'version', 'extraRequestData']
    try:
        # check operation
        if 'operation' in req.args:
            common_data.operation = req.args.get('operation')

        # check version
        version = req.args.get('version')
        if version is not None and current_version < float(version):
            raise Exception(5, version, 'Unsupported version')

        # check integer parameters
        if 'maximumRecords' in req.args:
            try:
                common_data.maximumRecords = int(req.args.get('maximumRecords'))
                if common_data.maximumRecords <= 0:
                    raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
            except TypeError:
                raise Exception(6, 'maximumRecords', 'Unsupported parameter value')

        if 'maximumTerms' in req.args:
            try:
                common_data.maximumTerms = int(req.args.get('maximumTerms'))
            except TypeError:
                raise Exception(6, 'maximumTerms', 'Unsupported parameter value')

        if 'startRecord' in req.args:
            try:
                common_data.startRecord = int(req.args.get('startRecord'))
                if common_data.startRecord <= 0:
                    raise Exception(6, 'startRecord', 'Unsupported parameter value')
            except TypeError:
                raise Exception(6, 'startRecord', 'Unsupported parameter value')

        if 'responsePosition' in req.args:
            try:
                common_data.responsePosition = int(req.args.get('responsePosition'))
            except TypeError:
                raise Exception(6, 'responsePosition', 'Unsupported parameter value')

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

        # provide info about service
        if common_data.operation == ' te dal':
            amodel.check_args(
                supported_args,
                ['recordPacking', 'x-fcs-endpoint-description']
            )
            corpus = amodel.cm.get_corpus(corpname, translate=req.translate)
            
            common_data.result = corpus.get_posattrs()
            common_data.numberOfRecords = len(common_data.result)

            additional_data['corpus_desc'] = 'Corpus {0} ({1} tokens)'.format(
                corpus.get_conf('NAME'), l10n.simplify_num(corpus.size))
            additional_data['corpus_lang'] = Languages.get_iso_code(corpus.get_conf('LANGUAGE'))
            additional_data['show_endpoint_desc'] = (True if req.args.get('x-fcs-endpoint-description', 'false') == 'true'
                                            else False)

        # wordlist for a given attribute
        elif common_data.operation == 'scan':
            amodel.check_args(
                supported_args,
                ['scanClause', 'responsePosition', 'maximumTerms', 'x-cmd-resource-info']
            )
            scanClause: str = req.args.get('scanClause', '')
            if scanClause.startswith('fcs.resource='):
                value = scanClause.split('=')[1]
                common_data.result = await amodel.corpora_info(value, common_data.maximumTerms)
            else:
                common_data.result = conclib.fcs_scan(
                    corpname, scanClause, common_data.maximumTerms, common_data.responsePosition)
            additional_data['resourceInfoRequest'] = req.args.get('x-cmd-resource-info', '') == 'true'

        # simple concordancer
        elif common_data.operation == 'searchRetrieve':
            # TODO we should review the args here (especially x-cmd-context, resultSetTTL)
            amodel.check_args(
                supported_args,
                ['query', 'startRecord', 'maximumRecords', 'recordPacking',
                    'recordSchema', 'resultSetTTL', 'x-cmd-context', 'x-fcs-context']
            )
            if 'x-cmd-context' in req.args:
                req_corpname = req.args.get('x-cmd-context')
                user_corpora = await plugins.runtime.AUTH.instance.permitted_corpora(
                    amodel.session_get('user'))
                if req_corpname in user_corpora:
                    corpname = req_corpname
                else:
                    logging.getLogger(__name__).warning(
                        'Requested unavailable corpus [%s], defaulting to [%s]', req_corpname, corpname)
                common_data.corpname = corpname

            corp_conf_info = await plugins.runtime.CORPARCH.instance.get_corpus_info(
                amodel.plugin_ctx, corpname)
            common_data.corppid = '' if corp_conf_info.web is None else corp_conf_info.web
            query = req.args.get('query', '')
            corpus = amodel.cm.get_corpus(corpname, translate=req.translate)
            if 0 == len(query):
                raise Exception(7, 'fcs_query', 'Mandatory parameter not supplied')
            common_data.result, common_data.numberOfRecords = await amodel.fcs_search(
                corpus, corpname, query, common_data.maximumRecords, common_data.startRecord)

        # unsupported operation
        else:
            # show within explain template
            common_data.operation = 'explain'
            raise Exception(4, '', 'Unsupported operation')

    # catch exception and amend diagnostics in template
    except Exception as e:
        additional_data['message'] = ('error', repr(e))
        try:
            additional_data['code'], additional_data['details'], additional_data['msg'] = e
        except (ValueError, TypeError):
            additional_data['code'] = 1
            additional_data['details'] = repr(e)
            additional_data['msg'] = 'General system error'

    return {**asdict(common_data), **additional_data}
