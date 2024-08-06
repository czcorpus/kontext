# Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

from action.argmapping.conc import decode_raw_query
from action.argmapping.wordlist import WordlistFormArgs
from action.control import http_action
from action.errors import UserReadableException
from action.krequest import KRequest
from action.model.concordance import ConcActionModel
from action.model.wordlist import WordlistActionModel
from action.response import KResponse
from plugin_types.backlinks import AbstractBacklinks
from sanic.blueprints import Blueprint
from sanic.request import RequestParameters
from views.concordance import view_conc
from views.wordlist import create_result as wl_create_result
from views.wordlist import view_result as wl_view_result

bp = Blueprint('ucnk_backlinks', url_prefix='b')


def col_lemma_log(request: KRequest):
    return dict(
        corpname=request.args.get('corpname'), maincorp=request.args.get('maincorp'),
        viewmode=request.args.get('viewmode'), pagesize=request.args.get('pagesize'),
        attrs=request.args.get('attrs'), attr_vmode=request.args.get('attrs_vmode'),
        q=request.args.get('q'))


@bp.route('/col_lemma')
@http_action(
    mutates_result=True, action_log_mapper=col_lemma_log, template='view.html', page_model='view',
    action_model=ConcActionModel)
async def col_lemma(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    """
    cl = req.args.get('cl')
    if not cl:
        raise UserReadableException('Missing parameter "cl"')
    if amodel.args.corpname not in ('syn_v11', 'syn_v12'):
        raise UserReadableException('Function not supported in {}'.format(amodel.args.corpname))
    pf = req.args.get('p')
    if not pf:
        pf = '.*'
    pw = req.args.get('pw')
    if not pw:
        pw = '.*'
    cl_attr = 'col_lemma'
    amodel.args.q = [f'q(meet [{cl_attr}="{cl}"][{cl_attr}="{cl}" & lemma="{pf}"] 0 15)']
    amodel.args.q.extend(['Fs', 'f'])
    amodel.args.q.append(f'p0 15 -1 (meet[{cl_attr}="{cl}"][{cl_attr}="{cl}" & lc="{pw}"] -15 0)')
    amodel.args.refs = '=doc.title,=doc.pubyear'
    amodel.args.pagesize = 50
    amodel.args.attrs = 'word'
    amodel.args.attr_vmode = 'mouseover'
    amodel.args.base_viewattr = 'word'
    amodel.args.structs = ''
    amodel.args.viewmode = 'sen'

    form_args = await decode_raw_query(
        amodel.plugin_ctx, [amodel.args.corpname], amodel.args.q)
    await amodel.store_unbound_query_chain(form_args)

    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'), disable_auclp=True)


@bp.route('/ic_tags')
@http_action(
    action_model=WordlistActionModel, template='wordlist/result.html', mutates_result=True,
    action_log_mapper=col_lemma_log, page_model='wordlist')
async def ic_tags(amodel: WordlistActionModel, req: KRequest, _):
    form_args = WordlistFormArgs()
    form_args.wlpat = req.args.get('tag', '.+')
    form_args.wlattr = 'tag'
    form_args.wlnums = 'frq'
    form_args.include_nonwords = 0
    form_args.wlminfreq = 1
    ans = await wl_create_result(amodel, form_args)
    if ans.get('freq_files_avail', False) is False:
        if not amodel.args.usesubcorp:
            corp_id = amodel.args.corpname
        else:
            corp_id = f'{amodel.args.corpname}/{amodel.args.usesubcorp}'
        raise UserReadableException(f'Missing intermediate frequency data for {corp_id}')
    return await wl_view_result(amodel, req)


class UcnkBacklinks(AbstractBacklinks):

    def export_actions(self) -> Blueprint:
        return bp


def create_instance(settings) -> UcnkBacklinks:
    return UcnkBacklinks()
