import logging
from typing import List

from sanic import Blueprint

from action.decorators import http_action
from action.krequest import KRequest
from action.response import KResponse
from action.argmapping import log_mapping
from action.argmapping.wordlist import WordlistFormArgs, WordlistSaveFormArgs
from action.model.wordlist import WordlistActionModel, WordlistError
from bgcalc import calc_backend_client, freq_calc
from bgcalc.wordlist import make_wl_query, require_existing_wordlist
from bgcalc.errors import BgCalcError
from corplib.errors import MissingSubCorpFreqFile
import plugins
from plugins.export import AbstractExport
from main_menu import MainMenu
import settings


bp = Blueprint('wordlist')


@bp.route('/wordlist/form')
@http_action(access_level=1, template='wordlist/form.html', page_model='wordlistForm', action_model=WordlistActionModel)
async def form(amodel: WordlistActionModel, req: KRequest, resp: KResponse):
    """
    Word List Form
    """
    amodel.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                  MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
    out = dict(freq_figures=amodel.FREQ_FIGURES)
    amodel.export_subcorpora_list(amodel.args.corpname, amodel.args.usesubcorp, out)
    amodel.export_form_args(out)
    return out


@bp.route('/wordlist/submit', ['POST'])
@http_action(access_level=1, return_type='json', page_model='wordlist', mutates_result=True, action_log_mapper=log_mapping.wordlist, action_model=WordlistActionModel)
async def submit(amodel: WordlistActionModel, req: KRequest, resp: KResponse):
    form_args = WordlistFormArgs()
    form_args.update_by_user_query(req.json)
    worker = calc_backend_client(settings)
    ans = dict(corpname=amodel.args.corpname, usesubcorp=amodel.args.usesubcorp,
               freq_files_avail=True, subtasks=[])
    async_res = await worker.send_task(
        'get_wordlist', object.__class__,
        args=(form_args.to_dict(), amodel.corp.size, amodel.session_get('user', 'id')))
    bg_result = async_res.get()
    if isinstance(bg_result, MissingSubCorpFreqFile):
        data_calc = freq_calc.build_arf_db(amodel.session_get(
            'user', 'id'), amodel.corp, form_args.wlattr)
        if type(data_calc) is list:
            for subtask in data_calc:
                # TODO get rid of private method
                amodel._store_async_task(subtask)
                ans['subtasks'].append(subtask.to_dict())
            ans['freq_files_avail'] = False
        else:
            # TODO we should join the current calculation here instead of throwing an error
            raise WordlistError('The data calculation is already running')
    elif isinstance(bg_result, Exception):
        raise bg_result
    # TODO get rid of private variable
    amodel._curr_wlform_args = form_args

    def on_query_store(query_ids, history_ts, result):
        result['wl_query_id'] = query_ids[0]
        if history_ts:
            amodel.store_last_search('wlist', query_ids[0])

    amodel.on_query_store(on_query_store)
    return ans


@bp.route('/wordlist/result')
@http_action(access_level=1, template='wordlist/result.html', page_model='wordlist', action_log_mapper=log_mapping.wordlist, action_model=WordlistActionModel)
async def result(amodel: WordlistActionModel, req: KRequest, resp: KResponse):
    amodel.disabled_menu_items = (MainMenu.VIEW('kwic-sent-switch', 'structs-attrs'),
                                  MainMenu.FILTER, MainMenu.FREQUENCY,
                                  MainMenu.COLLOCATIONS, MainMenu.CONCORDANCE)

    wlsort = req.args.get('wlsort', 'f')
    rev = bool(int(req.args.get('reverse', '1')))
    page = int(req.args.get('wlpage', '1'))
    offset = (page - 1) * amodel.args.wlpagesize
    total, data = require_existing_wordlist(
        form=amodel._curr_wlform_args, reverse=rev, offset=offset,
        limit=amodel.args.wlpagesize, wlsort=wlsort,
        collator_locale=(await amodel.get_corpus_info(amodel.corp.corpname)).collator_locale)

    result = dict(data=data, total=total, form=amodel._curr_wlform_args.to_dict(),
                  query_id=amodel._curr_wlform_args.id, reverse=rev, wlsort=wlsort, wlpage=page,
                  wlpagesize=amodel.args.wlpagesize)
    try:
        result['wlattr_label'] = (amodel.corp.get_conf(amodel._curr_wlform_args.wlattr + '.LABEL') or
                                  amodel._curr_wlform_args.wlattr)
    except Exception as e:
        result['wlattr_label'] = amodel._curr_wlform_args.wlattr
        logging.getLogger(__name__).warning(f'wlattr_label set failed: {e}')

    result['freq_figure'] = req.translate(amodel.FREQ_FIGURES.get('frq', '?'))

    amodel.add_save_menu_item('CSV', save_format='csv',
                              hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                  amodel.WORDLIST_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item('XLSX', save_format='xlsx',
                              hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                  amodel.WORDLIST_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item('XML', save_format='xml',
                              hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                  amodel.WORDLIST_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item('TXT', save_format='text',
                              hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                  amodel.WORDLIST_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(req.translate('Custom'))
    # custom save is solved in templates because of compatibility issues
    result['tasks'] = []
    result['SubcorpList'] = []
    result['quick_save_row_limit'] = amodel.WORDLIST_QUICK_SAVE_MAX_LINES
    result['query_id'] = amodel.q_code
    amodel.export_subcorpora_list(amodel.args.corpname, amodel.args.usesubcorp, result)
    return result


@bp.route('/wordlist/struct_result', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=WordlistActionModel)
async def struct_result(amodel: WordlistActionModel, req: KRequest, resp: KResponse):
    form_args = WordlistFormArgs()
    form_args.update_by_user_query(req.json)
    amodel._curr_wlform_args = form_args

    if amodel.args.fcrit:
        amodel.args.q = make_wl_query(
            wlattr=form_args.wlattr, wlpat=form_args.wlpat,
            include_nonwords=form_args.include_nonwords,
            pfilter_words=form_args.pfilter_words,
            nfilter_words=form_args.nfilter_words,
            non_word_re=amodel.corp.get_conf('NONWORDRE'))
        args = [('corpname', form_args.corpname), ('usesubcorp', form_args.usesubcorp),
                ('fcrit', amodel.args.fcrit), ('flimit', amodel.args.flimit),
                ('freq_sort', amodel.args.freq_sort), ('next', 'freqs')] + [('q', q) for q in amodel.args.q]
        return dict(location=req.create_url('restore_conc', args))
    if '.' in form_args.wlattr:
        raise WordlistError('Text types are limited to Simple output')
    if form_args.wlnums != 'frq':
        raise WordlistError('Multilevel lists are limited to Word counts frequencies')
    if len(form_args.wlposattrs) == 0:
        raise WordlistError(req.translate('No output attribute specified'))
    if not form_args.wlpat and len(form_args.pfilter_words) == 0:
        raise WordlistError(
            req.translate('You must specify either a pattern or a file to get the multilevel wordlist'))
    amodel.args.q = make_wl_query(
        wlattr=form_args.wlattr, wlpat=form_args.wlpat,
        include_nonwords=form_args.include_nonwords,
        pfilter_words=form_args.pfilter_words,
        nfilter_words=form_args.nfilter_words,
        non_word_re=amodel.corp.get_conf('NONWORDRE'))
    amodel.args.flimit = form_args.wlminfreq
    args = [('corpname', form_args.corpname), ('usesubcorp', form_args.usesubcorp),
            ('flimit', amodel.args.flimit), ('freqlevel', len(form_args.wlposattrs)),
            ('ml1attr', form_args.get_wlposattr(0)),
            ('ml2attr', form_args.get_wlposattr(1)),
            ('ml3attr', form_args.get_wlposattr(2)),
            ('next', 'freqml')] + [('q', q) for q in amodel.args.q]
    return dict(location=req.create_url('restore_conc', args))


@bp.route('/wordlist/savewl', ['POST'])
@http_action(access_level=1, return_type='plain', template='txtexport/savewl.html', action_model=WordlistActionModel)
async def savewl(amodel: WordlistActionModel, req: KRequest, resp: KResponse):
    """
    save word list
    """
    form_args = WordlistSaveFormArgs()
    form_args.update_by_user_query(req.json)
    if form_args.to_line is None:
        form_args.to_line = amodel.corp.size
    num_lines = form_args.to_line - form_args.from_line + 1
    total, data = require_existing_wordlist(
        form=amodel._curr_wlform_args, reverse=False, offset=form_args.from_line, limit=num_lines,
        wlsort='', collator_locale=(await amodel.get_corpus_info(amodel.corp.corpname)).collator_locale)
    saved_filename = form_args.corpname
    if form_args.saveformat == 'text':
        resp.set_header('Content-Type', 'application/text')
        resp.set_header('Content-Disposition',
                        f'attachment; filename="{saved_filename}-word-list.txt"')
        return dict(Items=data,
                    pattern=amodel._curr_wlform_args.wlpat,
                    from_line=form_args.from_line,
                    to_line=form_args.to_line,
                    usesubcorp=form_args.usesubcorp,
                    saveformat=form_args.saveformat,
                    colheaders=form_args.colheaders,
                    heading=form_args.heading)
    elif form_args.saveformat in ('csv', 'xml', 'xlsx'):
        def mkfilename(suffix): return f'{amodel.args.corpname}-word-list.{suffix}'
        writer: AbstractExport = plugins.runtime.EXPORT.instance.load_plugin(
            form_args.saveformat, subtype='wordlist', translate=req.translate)
        writer.set_col_types(int, str, float)

        resp.set_header('Content-Type', writer.content_type())
        resp.set_header(
            'Content-Disposition', f'attachment; filename="{mkfilename(form_args.saveformat)}"')
        # write the header first, if required
        if form_args.colheaders:
            writer.writeheading(('', amodel._curr_wlform_args.wlattr, 'freq'))
        elif form_args.heading:
            writer.writeheading({
                'corpus': amodel.corp.human_readable_corpname,
                'subcorpus': amodel.args.usesubcorp,
                'pattern': amodel._curr_wlform_args.wlpat
            })

        i = 1
        for item in data:
            writer.writerow(i, (item[0], str(item[1])))
            i += 1
        return writer.raw_content()
    return None


@bp.route('/wordlist/process')
@http_action(return_type='json', action_model=WordlistActionModel)
async def process(amodel: WordlistActionModel, req: KRequest, resp: KResponse):
    worker_tasks: List[str] = req.args.get('worker_tasks')
    backend = settings.get('calc_backend', 'type')
    if worker_tasks and backend in ('celery', 'rq'):
        import bgcalc
        worker = bgcalc.calc_backend_client(settings)
        for t in worker_tasks:
            tr = worker.AsyncResult(t)
            if tr.status == 'FAILURE':
                raise BgCalcError(f'Task {t} failed')
    return {'status': freq_calc.build_arf_db_status(amodel.corp, req.args.get('attrname', ''))}
