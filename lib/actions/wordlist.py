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

import sys
import logging
import os

import corplib
from corplib.errors import MissingSubCorpFreqFile
from controller import exposed
from controller.kontext import Kontext
from controller.errors import ImmediateRedirectException
from main_menu import MainMenu
from translation import ugettext as translate
from controller.errors import UserActionException
from bgcalc import freq_calc
from bgcalc.errors import CalcBackendError
import plugins
import settings
from argmapping import log_mapping
from argmapping.wordlist import WordlistFormArgs
from werkzeug import Request
from texttypes import TextTypesCache
from typing import Optional, Callable, List, Dict, Any
from conclib.wordlist import make_wl_query


class WordlistError(UserActionException):
    pass


class Wordlist(Kontext):

    FREQ_FIGURES = {'docf': 'Document counts', 'frq': 'Word counts', 'arf': 'ARF'}

    WORDLIST_QUICK_SAVE_MAX_LINES = 10000

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self._curr_wlform_args: Optional[WordlistFormArgs] = None
        self.on_conc_store: Callable[[List[str], bool, Dict[str, Any]], None] = lambda s, uh, res: None

    def get_mapping_url_prefix(self):
        return '/wordlist/'

    def post_dispatch(self, methodname, action_metadata, tmpl, result, err_desc):
        super().post_dispatch(methodname, action_metadata, tmpl, result, err_desc)
        if action_metadata['mutates_result']:
            with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
                query_id = qp.store(user_id=self.session_get('user', 'id'),
                                    curr_data=dict(form=self._curr_wlform_args.to_qp(),
                                                   corpora=[self._curr_wlform_args.corpname],
                                                   usesubcorp=self._curr_wlform_args.usesubcorp))
                qh.store(user_id=self.session_get('user', 'id'), query_id=query_id, q_supertype='pquery')
                self.on_conc_store([query_id], True, result)

    @exposed(access_level=1, return_type='json')
    def ajax_get_wordlist_size(self, request):
        if '.' in self.args.wlattr:
            wlnums = self._wlnums2structattr(self.args.wlnums)
        else:
            wlnums = self.args.wlnums
        return dict(size=corplib.get_wordlist_length(corp=self.corp, wlattr=self.args.wlattr, wlpat=self.args.wlpat,
                                                     wlnums=wlnums, wlminfreq=self.args.wlminfreq,
                                                     pfilter_words=self.args.pfilter_words, nfilter_words=self.args.nfilter_words,
                                                     include_nonwords=self.args.include_nonwords))

    def _wlnums2structattr(self, wlnums):
        if wlnums == 'arf':
            raise WordlistError(translate('ARF cannot be used with text types'))
        elif wlnums == 'frq':
            return 'doc sizes'
        elif wlnums == 'docf':
            return 'docf'
        else:
            return wlnums

    @staticmethod
    def load_bw_file(hash):
        res = ''
        fname = hash + '.txt'
        path = os.path.join(settings.get('global', 'user_filter_files_dir'), fname)
        rpath = os.path.realpath(path)
        if os.path.exists(rpath):
            f = open(rpath, 'r')
            res = f.read()
            f.close()
        return res

    @exposed(access_level=1, vars=('LastSubcorp',), page_model='wordlistForm')
    def form(self, request):
        """
        Word List Form
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
        out = dict(freq_figures=self.FREQ_FIGURES)
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, out)
        return out

    def _search(self, form: WordlistFormArgs):
        return corplib.wordlist(corp=self.corp, pfilter_words=form.pfilter_words, wlattr=form.wlattr,
                                wlpat=form.wlpat, wlminfreq=form.wlminfreq,
                                wlmaxitems=sys.maxsize, wlsort=form.wlsort, # TODO wlmaxitems
                                nfilter_words=form.nfilter_words,
                                wlnums=form.wlnums,
                                include_nonwords=form.include_nonwords)

    @exposed(access_level=1, http_method='POST', page_model='wordlist',
             return_type='json', mutates_result=True, action_log_mapper=log_mapping.wordlist)
    def submit(self, request):
        form_args = WordlistFormArgs()
        form_args.update_by_user_query(request.json)
        self._search(form_args)
        self._curr_wlform_args = form_args

        def on_conc_store(query_ids, stored_history, result):
            result['wl_query_id'] = query_ids[0]

        self.on_conc_store = on_conc_store
        return dict(corpname=self.args.corpname, usesubcorp=self.args.usesubcorp)

    @exposed(access_level=1, http_method=('POST', 'GET'), page_model='wordlist',
             action_log_mapper=log_mapping.wordlist)
    def result(self, request): # TODO wlpat='', paginate=True, wlhash='', blhash=''):
        """
        """
        self.disabled_menu_items = (MainMenu.VIEW('kwic-sentence', 'structs-attrs'),
                                    MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.CONCORDANCE)

        with plugins.runtime.QUERY_PERSISTENCE as qp:
            stored_form = qp.open(request.args.get('query_id'))
            self._curr_wlform_args = WordlistFormArgs()
            self._curr_wlform_args.update_by_user_query(stored_form['form'])

        
        if not wlpat:
            self.args.wlpat = '.*'
        if '.' in self.args.wlattr:
            orig_wlnums = self.args.wlnums
            self.args.wlnums = self._wlnums2structattr(self.args.wlnums)

        if paginate:
            wlmaxitems = self.args.wlpagesize * self.args.wlpage + 1
        else:
            wlmaxitems = sys.maxsize
        wlstart = (self.args.wlpage - 1) * self.args.wlpagesize
        result = dict(
            reload_args=list(dict(
                corpname=self.args.corpname, usesubcorp=self.args.usesubcorp,
                wlattr=self.args.wlattr, wlpat=self.args.wlpat,
                wlminfreq=self.args.wlminfreq, include_nonwords=self.args.include_nonwords,
                wlsort=self.args.wlsort, wlnums=self.args.wlnums).items()),
            form_args=dict(
                wlattr=self.args.wlattr, wlpat=self.args.wlpat, wlsort=self.args.wlsort,
                subcnorm=self.args.subcnorm, wltype=self.args.wltype, wlnums=self.args.wlnums,
                wlminfreq=self.args.wlminfreq, pfilter_words=self.args.pfilter_words,
                nfilter_words=self.args.nfilter_words, wlFileName='', blFileName='',
                includeNonwords=self.args.include_nonwords))
        try:
            if hasattr(self, 'wlfile') and self.args.wlpat == '.*':
                self.args.wlsort = ''



            result['reload_args'] = list(dict(
                corpname=self.args.corpname, usesubcorp=self.args.usesubcorp,
                wlattr=self.args.wlattr, wlpat=self.args.wlpat,
                wlminfreq=self.args.wlminfreq, include_nonwords=self.args.include_nonwords,
                wlsort=self.args.wlsort, wlnums=self.args.wlnums,
                wlhash=wlhash, blhash=blhash).items())

            result_list = corplib.wordlist(corp=self.corp, pfilter_words=pfilter_words, wlattr=self.args.wlattr,
                                           wlpat=self.args.wlpat, wlminfreq=self.args.wlminfreq,
                                           wlmaxitems=wlmaxitems, wlsort=self.args.wlsort, nfilter_words=nfilter_words,
                                           wlnums=self.args.wlnums,
                                           include_nonwords=self.args.include_nonwords)[wlstart:]
            result['Items'] = result_list
            if len(result_list) < self.args.wlpagesize + 1:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0
                if paginate:
                    result_list = result_list[:-1]
            result['Items'] = result_list

            if '.' in self.args.wlattr:
                self.args.wlnums = orig_wlnums

            try:
                result['wlattr_label'] = (self.corp.get_conf(self.args.wlattr + '.LABEL') or
                                          self.args.wlattr)
            except Exception as e:
                result['wlattr_label'] = self.args.wlattr
                logging.getLogger(__name__).warning('wlattr_label set failed: %s' % e)

            result['freq_figure'] = translate(self.FREQ_FIGURES.get(self.args.wlnums, '?'))
            result['processing'] = None

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
            self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, result)
            return result

        except MissingSubCorpFreqFile as e:
            result.update({'attrname': self.args.cattr, 'tasks': []})
            out = freq_calc.build_arf_db(e.corpus, self.args.wlattr)
            if type(out) is list:
                processing = 0
                result['tasks'].extend(out)
            elif out:
                processing = out
            else:
                processing = 0
            result['quick_save_row_limit'] = self.WORDLIST_QUICK_SAVE_MAX_LINES
            result['wlattr'] = self.args.wlattr
            result['wlattr_label'] = ''
            result['processing'] = processing
            result['SubcorpList'] = []
            result['freq_figure'] = ''
            result['lastpage'] = None
            return result

    @exposed(template='freqs.html', page_model='freq', http_method='POST', mutates_result=True)
    def struct_result(self, request):
        self.args.corpname = request.form.get('corpname')
        self.args.usesubcorp = request.form.get('usesubcorp')

        if self.args.fcrit:
            self.args.q = make_wl_query(wlattr=request.form['wlattr'], wlpat=request.form['wlpat'],
                                        include_nonwords=request.form['include_nonwords'],
                                        pfilter_words=request.form['pfilter_words'],
                                        nfilter_words=request.form['nfilter_words'],
                                        non_word_re=self.corp.get_conf('NONWORDRE'))
            args = [('corpname', request.form.get('corpname')), ('usesubcorp', request.form.get('usesubcorp')),
                    ('fcrit', self.args.fcrit), ('flimit', self.args.flimit),
                    ('freq_sort', self.args.freq_sort), ('next', 'freqs')] + [('q', q) for q in self.args.q]
            raise ImmediateRedirectException(self.create_url('restore_conc', args))

        if '.' in self.args.wlattr:
            raise WordlistError('Text types are limited to Simple output')
        if self.args.wlnums != 'frq':
            raise WordlistError('Multilevel lists are limited to Word counts frequencies')
        level = 3
        if not self.args.wlposattr1:
            raise WordlistError(translate('No output attribute specified'))
        if not self.args.wlposattr3:
            level = 2
        if not self.args.wlposattr2:
            level = 1
        if not self.args.wlpat and not self.args.pfilter_words:
            raise WordlistError(
                translate('You must specify either a pattern or a file to get the multilevel wordlist'))
        self.args.q = make_wl_query(wlattr=request.form['wlattr'], wlpat=request.form['wlpat'],
                                    include_nonwords=request.form['include_nonwords'],
                                    pfilter_words=request.form['pfilter_words'],
                                    nfilter_words=request.form['nfilter_words'],
                                    non_word_re=self.corp.get_conf('NONWORDRE'))
        self.args.flimit = self.args.wlminfreq
        args = [('corpname', request.form.get('corpname')), ('usesubcorp', request.form.get('usesubcorp')),
                ('flimit', self.args.wlminfreq), ('freqlevel', level), ('ml1attr', self.args.wlposattr1),
                ('ml2attr', self.args.wlposattr2), ('ml3attr', self.args.wlposattr3),
                ('next', 'freqml')] + [('q', q) for q in self.args.q]
        raise ImmediateRedirectException(self.create_url('restore_conc', args))

    @exposed(access_level=1, func_arg_mapped=True, template='txtexport/savewl.html', return_type='plain')
    def savewl(self, from_line=1, to_line='', usesubcorp='', saveformat='text', colheaders=0, heading=0):
        """
        save word list
        """
        from_line = int(from_line)
        to_line = int(to_line) if to_line else sys.maxsize
        self.args.wlpage = 1
        ans = self.result(wlpat=self.args.wlpat, paginate=False)
        ans['Items'] = ans['Items'][:(to_line - from_line + 1)]
        saved_filename = self.args.corpname

        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-word-list.txt"' % (
                saved_filename,)
            out_data = ans
            out_data['pattern'] = self.args.wlpat
            out_data['from_line'] = from_line
            out_data['to_line'] = to_line
            out_data['usesubcorp'] = usesubcorp
            out_data['saveformat'] = saveformat
            out_data['colheaders'] = colheaders
            out_data['heading'] = heading
        elif saveformat in ('csv', 'xml', 'xlsx'):
            def mkfilename(suffix): return '%s-word-list.%s' % (self.args.corpname, suffix)
            writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='wordlist')
            writer.set_col_types(int, str, float)

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                mkfilename(saveformat),)
            # write the header first, if required
            if colheaders:
                writer.writeheading(('', self.args.wlattr, 'freq'))
            elif heading:
                writer.writeheading({
                    'corpus': self._human_readable_corpname(),
                    'subcorpus': self.args.usesubcorp,
                    'pattern': self.args.wlpat
                })

            i = 1
            for item in ans['Items']:
                writer.writerow(i, (item['str'], str(item['freq'])))
                i += 1
            out_data = writer.raw_content()
        return out_data

    @exposed(func_arg_mapped=True, return_type='json')
    def process(self, attrname='', worker_tasks=None):
        backend = settings.get('calc_backend', 'type')
        if worker_tasks and backend in ('celery', 'rq'):
            import bgcalc
            app = bgcalc.calc_backend_client(settings)
            for t in worker_tasks:
                tr = app.AsyncResult(t)
                if tr.status == 'FAILURE':
                    raise CalcBackendError('Task %s failed' % (t,))
        return {'status': freq_calc.build_arf_db_status(self.corp, attrname)}
