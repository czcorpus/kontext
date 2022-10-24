# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import collections
from dataclasses import fields

import settings
from action.argmapping import GeneralOptionsArgs, WidectxArgsMapping
from action.control import http_action
from action.krequest import KRequest
from action.model.concordance import ConcActionModel
from action.model.corpus import CorpusActionModel
from action.model.user import UserActionModel
from action.response import KResponse
from sanic import Blueprint

bp = Blueprint('options', url_prefix='options')


def _set_new_viewopts(
        amodel: UserActionModel, pagesize=0, newctxsize=0, ctxunit='', line_numbers=False, shuffle=False, wlpagesize=0,
        fmaxitems=0, fdefault_view='charts', citemsperpage=0, pqueryitemsperpage=0, rich_query_editor=False, subcpagesize=0):
    amodel.args.pagesize = pagesize
    if ctxunit == '@pos':
        ctxunit = ''
    new_kwicright = f'{newctxsize}{ctxunit}'
    if new_kwicright != amodel.args.kwicrightctx:
        amodel.args.kwicleftctx = f'-{new_kwicright}'
        amodel.args.kwicrightctx = new_kwicright
    amodel.args.line_numbers = line_numbers
    amodel.args.shuffle = int(shuffle)
    amodel.args.wlpagesize = wlpagesize
    amodel.args.fmaxitems = fmaxitems
    amodel.args.fdefault_view = fdefault_view
    amodel.args.citemsperpage = citemsperpage
    amodel.args.pqueryitemsperpage = pqueryitemsperpage
    amodel.args.rich_query_editor = rich_query_editor
    amodel.args.subcpagesize = subcpagesize


def _set_new_corp_options(amodel: CorpusActionModel, attrs=(), attr_vmode='', structs=(), refs=(),
                          structattrs=(), base_viewattr='word', qs_enabled=True):
    if amodel.BASE_ATTR not in attrs:
        attrs = (amodel.BASE_ATTR, *attrs)
    amodel.args.attrs = ','.join(attrs)
    amodel.args.structs = ','.join(structs)
    amodel.args.refs = ','.join(refs)
    amodel.args.attr_vmode = attr_vmode
    amodel.args.structattrs = structattrs
    amodel.args.base_viewattr = base_viewattr
    amodel.args.qs_enabled = qs_enabled


@bp.route('/viewattrs')
@http_action(return_type='json', action_model=ConcActionModel)
async def viewattrs(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    attrs, refs, structs form
    """

    out = {}
    if amodel.args.maincorp:
        corp = await amodel.cf.get_corpus(amodel.args.maincorp)
    else:
        corp = amodel.corp
    out['AttrList'] = [
        {
            'label': corp.get_conf(f'{n}.LABEL') or n,
            'n': n,
            'multisep': corp.get_conf(f'{n}.MULTISEP')
        } for n in corp.get_posattrs() if n
    ]
    out['fixed_attr'] = 'word'
    out['attr_vmode'] = amodel.args.attr_vmode
    availstruct = corp.get_structs()
    structlist = set(amodel.args.structs.split(',')).union(
        x.split('.')[0] for x in amodel.args.structattrs)
    out['Availstructs'] = [
        {
            'n': n,
            'sel': 'selected' if n in structlist else '',
            'label': corp.get_conf(f'{n}.LABEL')
        } for n in availstruct if n and n != '#'
    ]
    out['base_viewattr'] = amodel.args.base_viewattr
    availref = corp.get_structattrs()
    reflist = amodel.args.refs.split(',') if amodel.args.refs else []
    out['qs_enabled'] = amodel.args.qs_enabled

    async def ref_is_allowed(r):
        return r and r not in (
            '#', (await amodel.get_corpus_info(amodel.args.corpname)).speech_segment)

    structattrs = collections.defaultdict(list)
    for item in availref:
        if await ref_is_allowed(item):
            k, v = item.split('.', 1)
            structattrs[k].append(v)
    out['Availrefs'] = [{
        'n': '#',
        'label': req.translate('Token number'),
        'sel': 'selected' if '#' in reflist else '',
    }]
    for n in availref:
        if await ref_is_allowed(n):
            out['Availrefs'].append({
                'n': '=' + n,
                'sel': 'selected' if ('=' + n) in reflist else '',
                'label': corp.get_conf(f'{n}.LABEL') or n
            })

    doc = corp.get_conf('DOCSTRUCTURE')
    if doc in availstruct:
        out['Availrefs'].insert(1, {
            'n': doc,
            'label': req.translate('Document number'),
            'sel': doc in reflist and 'selected' or ''
        })
    out['newctxsize'] = amodel.args.kwicleftctx[1:]
    out['structattrs'] = structattrs
    out['curr_structattrs'] = amodel.args.structattrs
    out['query_overview'] = [x.to_dict() for x in (await amodel.concdesc_json())]
    out['CurrentAttrs'] = amodel.args.attrs.split(',')
    out['use_conc_toolbar'] = settings.get_bool('global', 'use_conc_toolbar')
    return out


@bp.route('/viewattrsx', ['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def viewattrsx(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    _set_new_corp_options(
        amodel,
        attrs=req.json.get('attrs'),
        attr_vmode=req.json.get('attr_vmode'),
        structs=req.json.get('structs'),
        refs=req.json.get('refs', ()),
        structattrs=req.json.get('structattrs'),
        qs_enabled=req.json.get('qs_enabled'),
        base_viewattr=req.json.get('base_viewattr'),
    )
    await amodel.save_options(
        ['attrs', 'attr_vmode', 'structs', 'refs', 'structattrs', 'base_viewattr', 'qs_enabled'],
        amodel.args.corpname,
    )
    return {
        'widectx_globals': amodel.get_mapped_attrs(
            WidectxArgsMapping,
            {'structs': amodel.get_struct_opts()}
        ),
        'conc_args': amodel.get_curr_conc_args()
    }


@bp.route('/viewopts')
@http_action(return_type='json', action_model=UserActionModel)
async def viewopts(amodel: UserActionModel, req: KRequest, resp: KResponse):
    return dict(
        pagesize=amodel.args.pagesize,
        newctxsize=amodel.args.kwicleftctx[1:],
        ctxunit='@pos',
        line_numbers=amodel.args.line_numbers,
        shuffle=bool(amodel.args.shuffle),
        wlpagesize=amodel.args.wlpagesize,
        fmaxitems=amodel.args.fmaxitems,
        fdefault_view=amodel.args.fdefault_view,
        citemsperpage=amodel.args.citemsperpage,
        pqueryitemsperpage=amodel.args.pqueryitemsperpage,
        rich_query_editor=amodel.args.rich_query_editor,
        subcpagesize=amodel.args.subcpagesize,
    )


@bp.route('/viewoptsx', ['POST'])
@http_action(return_type='json', action_model=UserActionModel)
async def viewoptsx(amodel: UserActionModel, req: KRequest, resp: KResponse):
    _set_new_viewopts(
        amodel,
        pagesize=req.json.get('pagesize'),
        newctxsize=req.json.get('newctxsize'),
        ctxunit=req.json.get('ctxunit'),
        line_numbers=req.json.get('line_numbers'),
        shuffle=req.json.get('shuffle'),
        wlpagesize=req.json.get('wlpagesize'),
        fmaxitems=req.json.get('fmaxitems'),
        fdefault_view=req.json.get('fdefault_view'),
        citemsperpage=req.json.get('citemsperpage'),
        pqueryitemsperpage=req.json.get('pqueryitemsperpage'),
        rich_query_editor=req.json.get('rich_query_editor'),
        subcpagesize=req.json.get('subcpagesize'),
    )
    await amodel.save_options(
        optlist=[field.name for field in fields(GeneralOptionsArgs)])
    return {}


@bp.route('/toggle_conc_dashboard', ['POST'])
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def toggle_conc_dashboard(amodel: UserActionModel, req: KRequest, resp: KResponse):
    return {}
