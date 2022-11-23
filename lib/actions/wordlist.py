# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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
from typing import Optional, Callable, List, Dict, Any, Union

from corplib.errors import MissingSubCorpFreqFile
from controller import exposed
from controller.kontext import Kontext
from main_menu.model import MainMenu
from translation import ugettext as translate
from controller.errors import UserActionException
from bgcalc import freq_calc, calc_backend_client
from bgcalc.errors import BgCalcError
from bgcalc.wordlist import make_wl_query, require_existing_wordlist
import plugins
import settings
from argmapping import log_mapping
from argmapping.wordlist import WordlistFormArgs, WordlistSaveFormArgs
from werkzeug import Request
from texttypes import TextTypesCache
from argmapping import WordlistArgsMapping, ConcArgsMapping
from controller.req_args import RequestArgsProxy, JSONRequestArgsProxy
from babel.numbers import format_decimal


class WordlistError(UserActionException):
    pass


class Wordlist(Kontext):

    FREQ_FIGURES = {'docf': 'Document counts', 'frq': 'Word counts', 'arf': 'ARF'}

    WORDLIST_QUICK_SAVE_MAX_LINES = 10000

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self._curr_wlform_args: Optional[WordlistFormArgs] = None
        self.on_conc_store: Callable[[List[str], Optional[int],
                                      Dict[str, Any]], None] = lambda s, uh, res: None

    def get_mapping_url_prefix(self):
        return '/wordlist/'

    def pre_dispatch(self, action_name, action_metadata=None) -> Union[RequestArgsProxy, JSONRequestArgsProxy]:
        ans = super().pre_dispatch(action_name, action_metadata)
        if self._active_q_data is not None:
            if self._active_q_data.get('form', {}).get('form_type') != 'wlist':
                raise UserActionException('Invalid search session for a word-list')
            self._curr_wlform_args = WordlistFormArgs.from_dict(
                self._active_q_data['form'], id=self._active_q_data['id'])
        return ans

    def post_dispatch(self, methodname, action_metadata, tmpl, result, err_desc):
        super().post_dispatch(methodname, action_metadata, tmpl, result, err_desc)
        if action_metadata['mutates_result']:
            with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
                query_id = qp.store(user_id=self.session_get('user', 'id'),
                                    curr_data=dict(form=self._curr_wlform_args.to_qp(),
                                                   corpora=[self._curr_wlform_args.corpname],
                                                   usesubcorp=self._curr_wlform_args.usesubcorp))
                ts = qh.store(
                    user_id=self.session_get('user', 'id'),
                    query_id=query_id, q_supertype='wlist')
                self.on_conc_store([query_id], ts, result)

    def export_form_args(self, result):
        if self._curr_wlform_args:
            result['wordlist_form'] = self._curr_wlform_args.to_dict()
        else:
            result['wordlist_form'] = None

    def add_globals(self, request, result, methodname, action_metadata):
        super().add_globals(request, result, methodname, action_metadata)
        conc_args = self._get_mapped_attrs(WordlistArgsMapping + ConcArgsMapping)
        q = request.args.get('q')
        if q:
            conc_args['q'] = [q]
        result['Globals'] = conc_args
        result['conc_dashboard_modules'] = settings.get_list('global', 'conc_dashboard_modules')

    @exposed(access_level=1, page_model='wordlistForm')
    def form(self, request):
        """
        Word List Form
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
        out = dict(freq_figures=self.FREQ_FIGURES)
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, out)
        self.export_form_args(out)
        return out

    def create_result(self, form_args: WordlistFormArgs):
        worker = calc_backend_client(settings)
        ans = dict(corpname=self.args.corpname, usesubcorp=self.args.usesubcorp,
                   freq_files_avail=True, subtasks=[])
        async_res = worker.send_task(
            'get_wordlist', object.__class__,
            args=(form_args.to_dict(), self.corp.size, self.session_get('user', 'id')))
        bg_result = async_res.get()
        if isinstance(bg_result, MissingSubCorpFreqFile):
            data_calc = freq_calc.build_arf_db(self.session_get(
                'user', 'id'), self.corp, form_args.wlattr)
            if type(data_calc) is list:
                for subtask in data_calc:
                    self._store_async_task(subtask)
                    ans['subtasks'].append(subtask.to_dict())
                ans['freq_files_avail'] = False
            else:
                # TODO we should join the current calculation here instead of throwing an error
                raise WordlistError('The data calculation is already running')
        elif isinstance(bg_result, Exception):
            raise bg_result
        self._curr_wlform_args = form_args

        def on_conc_store(query_ids, history_ts, result):
            result['wl_query_id'] = query_ids[0]
            if history_ts:
                self._store_last_search('wlist', query_ids[0])

        self.on_conc_store = on_conc_store
        return ans

    @exposed(access_level=1, http_method='POST', page_model='wordlist',
             return_type='json', mutates_result=True, action_log_mapper=log_mapping.wordlist)
    def submit(self, request):
        form_args = WordlistFormArgs()
        form_args.update_by_user_query(request.json)
        return self.create_result(form_args)

    def view_result(self, request):
        """
        """
        self.disabled_menu_items = (MainMenu.VIEW('kwic-sent-switch', 'structs-attrs'),
                                    MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.CONCORDANCE)

        wlsort = request.args.get('wlsort', 'f')
        rev = bool(int(request.args.get('reverse', '1')))
        page = int(request.args.get('wlpage', '1'))
        offset = (page - 1) * self.args.wlpagesize
        total, data = require_existing_wordlist(
            form=self._curr_wlform_args, reverse=rev, offset=offset,
            limit=self.args.wlpagesize, wlsort=wlsort,
            collator_locale=self.get_corpus_info(self.corp.corpname).collator_locale)

        result = dict(data=data, total=total, form=self._curr_wlform_args.to_dict(),
                      query_id=self._curr_wlform_args.id, reverse=rev, wlsort=wlsort, wlpage=page,
                      wlpagesize=self.args.wlpagesize)
        try:
            result['wlattr_label'] = (self.corp.get_conf(self._curr_wlform_args.wlattr + '.LABEL') or
                                      self._curr_wlform_args.wlattr)
        except Exception as e:
            result['wlattr_label'] = self._curr_wlform_args.wlattr
            logging.getLogger(__name__).warning(f'wlattr_label set failed: {e}')

        result['freq_figure'] = translate(self.FREQ_FIGURES.get('frq', '?'))

        self._add_save_menu_item('CSV', save_format='csv',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.WORDLIST_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XLSX', save_format='xlsx',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.WORDLIST_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XML', save_format='xml',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.WORDLIST_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('TXT', save_format='text',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.WORDLIST_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item(translate('Custom'))
        # custom save is solved in templates because of compatibility issues
        result['tasks'] = []
        result['SubcorpList'] = []
        result['quick_save_row_limit'] = self.WORDLIST_QUICK_SAVE_MAX_LINES
        result['query_id'] = self._q_code
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, result)
        return result

    @exposed(access_level=1, http_method='GET', page_model='wordlist',
             action_log_mapper=log_mapping.wordlist)
    def result(self, request):
        return self.view_result(request)

    @exposed(http_method='POST', mutates_result=True, return_type='json')
    def struct_result(self, request):
        form_args = WordlistFormArgs()
        form_args.update_by_user_query(request.json)
        self._curr_wlform_args = form_args

        if self.args.fcrit:
            self.args.q = make_wl_query(
                wlattr=form_args.wlattr, wlpat=form_args.wlpat,
                include_nonwords=form_args.include_nonwords,
                pfilter_words=form_args.pfilter_words,
                nfilter_words=form_args.nfilter_words,
                non_word_re=self.corp.get_conf('NONWORDRE'))
            args = [('corpname', form_args.corpname), ('usesubcorp', form_args.usesubcorp),
                    ('fcrit', self.args.fcrit), ('flimit', self.args.flimit),
                    ('freq_sort', self.args.freq_sort), ('next', 'freqs')] + [('q', q) for q in self.args.q]
            return dict(location=self.create_url('restore_conc', args))
        if '.' in form_args.wlattr:
            raise WordlistError('Text types are limited to Simple output')
        if form_args.wlnums != 'frq':
            raise WordlistError('Multilevel lists are limited to Word counts frequencies')
        if len(form_args.wlposattrs) == 0:
            raise WordlistError(translate('No output attribute specified'))
        if not form_args.wlpat and len(form_args.pfilter_words) == 0:
            raise WordlistError(
                translate('You must specify either a pattern or a file to get the multilevel wordlist'))
        self.args.q = make_wl_query(
            wlattr=form_args.wlattr, wlpat=form_args.wlpat,
            include_nonwords=form_args.include_nonwords,
            pfilter_words=form_args.pfilter_words,
            nfilter_words=form_args.nfilter_words,
            non_word_re=self.corp.get_conf('NONWORDRE'))
        self.args.flimit = form_args.wlminfreq
        args = [('corpname', form_args.corpname), ('usesubcorp', form_args.usesubcorp),
                ('flimit', self.args.flimit), ('freqlevel', len(form_args.wlposattrs)),
                ('ml1attr', form_args.get_wlposattr(0)),
                ('ml2attr', form_args.get_wlposattr(1)),
                ('ml3attr', form_args.get_wlposattr(2)),
                ('next', 'freqml')] + [('q', q) for q in self.args.q]
        return dict(location=self.create_url('restore_conc', args))

    @exposed(access_level=1, template='txtexport/savewl.html', http_method='POST', return_type='plain')
    def savewl(self, request):
        """
        save word list
        """
        form_args = WordlistSaveFormArgs()
        form_args.update_by_user_query(request.json)
        if form_args.to_line is None:
            form_args.to_line = self.corp.size
        num_lines = form_args.to_line - form_args.from_line + 1
        total, data = require_existing_wordlist(
            form=self._curr_wlform_args, reverse=False, offset=form_args.from_line, limit=num_lines,
            wlsort='', collator_locale=self.get_corpus_info(self.corp.corpname).collator_locale)

        locale = self.get_locale()
        def formatnumber(x): return x if form_args.saveformat == 'xlsx' else format_decimal(x, locale=locale, decimal_quantization=False)

        if form_args.saveformat == 'text':
            self._response.set_header('Content-Type', 'application/text')
            self._response.set_header('Content-Disposition',
                                      f'attachment; filename="{form_args.corpname}-word-list.txt"')
            return dict(Items=[(wlattr, formatnumber(freq)) for wlattr, freq in data],
                        pattern=self._curr_wlform_args.wlpat,
                        from_line=form_args.from_line,
                        to_line=form_args.to_line,
                        usesubcorp=form_args.usesubcorp,
                        saveformat=form_args.saveformat,
                        colheaders=form_args.colheaders,
                        heading=form_args.heading)
        elif form_args.saveformat in ('csv', 'xml', 'xlsx'):
            def mkfilename(suffix): return f'{self.args.corpname}-word-list.{suffix}'
            writer = plugins.runtime.EXPORT.instance.load_plugin(
                form_args.saveformat, 'wordlist')
            writer.set_col_types(int, str, float)

            self._response.set_header('Content-Type', writer.content_type())
            self._response.set_header(
                'Content-Disposition', f'attachment; filename="{mkfilename(form_args.saveformat)}"')
            # write the header first, if required
            if form_args.colheaders:
                writer.writeheading(('', self._curr_wlform_args.wlattr, 'freq'))
            elif form_args.heading:
                writer.writeheading([
                    'corpus: {}\nsubcorpus: {},\npattern: {}'.format(
                        self._human_readable_corpname(), self.args.usesubcorp, self._curr_wlform_args.wlpat),
                    '', ''
                ])
            for i, (wlattr, freq) in enumerate(data, 1):
                writer.writerow(i, (wlattr, formatnumber(freq)))
            return writer.raw_content()
        return None

    @exposed(func_arg_mapped=True, return_type='json')
    def process(self, attrname='', worker_tasks=None):
        backend = settings.get('calc_backend', 'type')
        if worker_tasks and backend in ('celery', 'rq'):
            import bgcalc
            worker = bgcalc.calc_backend_client(settings)
            for t in worker_tasks:
                tr = worker.AsyncResult(t)
                if tr.status == 'FAILURE':
                    raise BgCalcError(f'Task {t} failed')
        return {'status': freq_calc.build_arf_db_status(self.corp, attrname)}

    @exposed(
        template='wordlist/result.html', mutates_result=True, page_model='wordlist', access_level=1)
    def ic_tags(self, req):
        form_args = WordlistFormArgs()
        form_args.corpname = self.args.corpname
        form_args.usesubcorp = self.args.usesubcorp
        form_args.wlpat = req.args.get('tag', '.+')
        form_args.wlattr = 'tag'
        form_args.wlnums = 'frq'
        form_args.include_nonwords = 0
        form_args.wlminfreq = 1
        ans = self.create_result(form_args)
        if ans.get('freq_files_avail', False) is False:
            if not self.args.usesubcorp:
                corp_id = self.args.corpname
            else:
                corp_id = f'{self.args.corpname}/{self.args.usesubcorp}'
            raise UserActionException(f'Missing intermediate frequency data for {corp_id}')
        return self.view_result(req)
