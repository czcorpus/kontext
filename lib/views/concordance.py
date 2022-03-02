from typing import Optional, Dict, List, Any
from sanic import Sanic, response, Blueprint
from sanic.views import HTTPMethodView
from sanic.response import text
from sanic.request import Request
from action.decorators import http_action
from action.model.base import BaseActionModel
from action.model.concordance import ConcActionModel
from action.argmapping.conc import build_conc_form_args, QueryFormArgs
from plugin_types.query_persistence.error import QueryPersistenceRecNotFound
from action.errors import NotFoundException
from translation import ugettext
import conclib
import plugins
from main_menu import MainMenu

bp = Blueprint('concordance')


@bp.route('/query')
@http_action(template='query.html', page_model='query', action_model=ConcActionModel)
async def query(request, action_model: ConcActionModel):
    action_model.disabled_menu_items = (
        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
        MainMenu.VIEW('kwic-sent-switch'))
    out = {'aligned_corpora': action_model.args.align}
    tt_data = action_model.tt.export_with_norms(ret_nums=True)
    out['Normslist'] = tt_data['Normslist']
    out['text_types_data'] = tt_data

    corp_info = action_model.get_corpus_info(action_model.args.corpname)
    out['text_types_notes'] = corp_info.metadata.desc
    out['default_virt_keyboard'] = corp_info.metadata.default_virt_keyboard

    qf_args = action_model._fetch_prev_query('conc') if action_model._active_q_data is None else None
    if qf_args is None:
        qf_args = QueryFormArgs(
            plugin_ctx=action_model._plugin_ctx,
            corpora=[action_model.args.corpname] + action_model.args.align,
            persist=False)
    action_model.add_conc_form_args(qf_args)
    action_model._attach_query_params(out)
    action_model._attach_aligned_query_params(out)
    action_model._export_subcorpora_list(action_model.args.corpname, action_model.args.usesubcorp, out)
    import logging
    logging.getLogger(__name__).warning('fooo>>>>>> {}'.format(out))
    return out, 200


@bp.route('/concdesc_json')
@http_action(return_type='json')
async def concdesc_json(request, action_model: BaseActionModel) -> Dict[str, List[Dict[str, Any]]]:
    out_list: List[Dict[str, Any]] = []
    conc_desc = conclib.get_conc_desc(corpus=action_model.corp, q=getattr(action_model.args, 'q'))

    def nicearg(arg):
        args = arg.split('"')
        niceargs = []
        prev_val = ''
        prev_other = ''
        for i in range(len(args)):
            if i % 2:
                tmparg = args[i].strip('\\').replace('(?i)', '')
                if tmparg != prev_val or '|' not in prev_other:
                    niceargs.append(tmparg)
                prev_val = tmparg
            else:
                if args[i].startswith('within'):
                    niceargs.append('within')
                prev_other = args[i]
        return ', '.join(niceargs)

    for o, a, u1, u2, s, opid in conc_desc:
        u2.append(('corpname', getattr(action_model.args, 'corpname')))
        if getattr(action_model.args, 'usesubcorp'):
            u2.append(('usesubcorp', getattr(action_model.args, 'usesubcorp')))
        out_list.append(dict(
            op=o,
            opid=opid,
            arg=a,
            nicearg=nicearg(a),
            tourl=action_model.urlencode(u2),
            size=s))
    return {'Desc': out_list}


@bp.route('/ajax_fetch_conc_form_args')
@http_action(return_type='json', http_method='GET')
async def ajax_fetch_conc_form_args(self, request: Request) -> Dict[str, Any]:
    try:
        # we must include only regular (i.e. the ones visible in the breadcrumb-like
        # navigation bar) operations - otherwise the indices would not match.
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            stored_ops = qp.load_pipeline_ops(
                self._plugin_ctx, request.args['last_key'], build_conc_form_args)
        pipeline = [x for x in stored_ops if x.form_type != 'nop']
        op_data = pipeline[int(request.args['idx'])]
        return op_data.to_dict()
    except (IndexError, KeyError, QueryPersistenceRecNotFound) as ex:
        raise NotFoundException(ugettext('Query information not stored: {}').format(ex))
