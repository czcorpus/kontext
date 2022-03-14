# Copyright (c) 2003-2009  Pavel Rychly
# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
import os
import sys
import re
import json
from collections import defaultdict
import time
from typing import Dict, Any, List, Union, Optional, Tuple
from dataclasses import asdict

from controller.kontext import LinesGroups, Kontext
from controller import exposed
from action.errors import UserActionException, ImmediateRedirectException, NotFoundException
from action.argmapping.conc.query import QueryFormArgs
from action.argmapping.conc.filter import (
    FilterFormArgs, ContextFilterArgsConv, QuickFilterArgsConv, SubHitsFilterFormArgs, FirstHitsFilterFormArgs)
from action.argmapping.conc.sort import SortFormArgs
from action.argmapping.conc.other import SampleFormArgs, ShuffleFormArgs, LgroupOpArgs, LockedOpFormsArgs, KwicSwitchArgs
from argmapping.conc import build_conc_form_args
from action.argmapping import log_mapping
from argmapping.analytics import CollFormArgs, FreqFormArgs, CTFreqFormArgs
from action.argmapping import ConcArgsMapping
from plugin_types.corparch import CorpusInfo
import settings
import conclib
from conclib.empty import InitialConc
from conclib.search import get_conc
from conclib.calc import cancel_conc_task, require_existing_conc, ConcNotFoundException
from conclib.errors import (
    UnknownConcordanceAction, ConcordanceException, ConcordanceQueryParamsError, ConcordanceSpecificationError,
    extract_manatee_error)
import corplib
from bgcalc import freq_calc, coll_calc, calc_backend_client
from bgcalc.errors import CalcTaskNotFoundError
from bgcalc.coll_calc import CalculateCollsResult
import plugins
from kwiclib import Kwic, KwicPageArgs
from translation import ugettext as translate
from action.argmapping import WidectxArgsMapping
from texttypes.model import TextTypeCollector
from texttypes.cache import TextTypesCache
from main_menu.model import MainMenu
from main_menu import generate_main_menu
from controller.querying import Querying
import mailing
from conclib.freq import one_level_crit, multi_level_crit
from strings import re_escape, escape_attr_val
from plugin_types.conc_cache import ConcCacheStatusException
from util import as_async


class Actions(Querying):
    """
    KonText actions are specified here
    """

    CONC_QUICK_SAVE_MAX_LINES = 10000
    FREQ_QUICK_SAVE_MAX_LINES = 10000
    COLLS_QUICK_SAVE_MAX_LINES = 10000

    """
    This class specifies all the actions KonText offers to a user via HTTP
    """

    def __init__(self, request, ui_lang, tt_cache: TextTypesCache):
        """
        arguments:
        request -- werkzeug's Request obj.
        ui_lang -- a language code in which current action's result will be presented
        """
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self.disabled_menu_items = ()

    def get_mapping_url_prefix(self):
        """
        This is required as it maps the controller to request URLs
        """
        return '/'

    def get_speech_segment(self):
        """
        Returns a speech segment (= structural attribute, e.g. 'sp.audio')
        if the current corpus has one configured.

        Returns:
            str: segment name if speech_segment is configured in 'corpora.xml' and it actually exists; else None
        """
        speech_struct = self.get_corpus_info(self.args.corpname).speech_segment
        if speech_struct is not None:
            return tuple(speech_struct.split('.'))
        else:
            return None

    @as_async
    def add_globals(self, request, result, methodname, action_metadata):
        super().add_globals(request, result, methodname, action_metadata)
        conc_args = self._get_mapped_attrs(ConcArgsMapping)
        conc_args['q'] = [q for q in result.get('Q')]
        result['Globals'] = conc_args
        result['conc_dashboard_modules'] = settings.get_list('global', 'conc_dashboard_modules')

    def _get_ipm_base_set_desc(self, contains_within):
        """
        Generates a proper description for i.p.m. depending on the
        method used to select texts:
        1 - whole corpus
        2 - a named subcorpus
        3 - an ad-hoc subcorpus
        """
        corpus_name = self.corp.get_conf('NAME')
        if contains_within:
            return translate('related to the subset defined by the selected text types')
        elif self.corp.is_subcorpus:
            return (translate('related to the whole %s') % (corpus_name,)) + \
                ':%s' % self.corp.subcname
        else:
            return translate('related to the whole %s') % corpus_name

    def _go_to_restore_conc(self, return_action: str):
        args = []
        for k in self._request.args.keys():
            for val in self._request.args.getlist(k):
                args.append((k, val))
        args.append(('next', return_action))
        raise ImmediateRedirectException(self.create_url('restore_conc', args))

    @exposed()
    def first_form(self, request):
        self.redirect(self.create_url('query', request.args), code=301)
        return {}

    @exposed(return_type='json')
    def get_conc_cache_status(self, _):
        self._response.set_header('Content-Type', 'text/plain')
        cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(self.corp)
        q = tuple(self.args.q)
        subchash = getattr(self.corp, 'subchash', None)

        try:
            cache_status = cache_map.get_calc_status(subchash, q)
            if cache_status is None:  # conc is not cached nor calculated
                raise NotFoundException('Concordance calculation is lost')
            elif not cache_status.finished and cache_status.task_id:
                # we must also test directly a respective task as might have been killed
                # and thus failed to store info to cache metadata
                worker = calc_backend_client(settings)
                err = worker.get_task_error(cache_status.task_id)
                if err is not None:
                    raise err
            return dict(
                finished=cache_status.finished,
                concsize=cache_status.concsize,
                fullsize=cache_status.fullsize,
                relconcsize=cache_status.relconcsize,
                arf=cache_status.arf)
        except CalcTaskNotFoundError as ex:
            cancel_conc_task(cache_map, subchash, q)
            raise NotFoundException(f'Concordance calculation is lost: {ex}')
        except Exception as ex:
            cancel_conc_task(cache_map, subchash, q)
            raise ex

    def _is_err_corpus(self):
        availstruct = self.corp.get_structs()
        return 'err' in availstruct and 'corr' in availstruct

    @exposed(access_level=0, template='view.html', vars=('concsize',), page_model='view', mutates_result=True,
             http_method='POST')
    def reduce(self, request):
        """
        random sample
        """
        if len(self._lines_groups) > 0:
            raise UserActionException(
                'Cannot apply a random sample once a group of lines has been saved')
        qinfo = SampleFormArgs(persist=True)
        qinfo.rlines = self.args.rlines
        self.add_conc_form_args(qinfo)
        self.args.q.append('r' + self.args.rlines)
        return self.view(request)

    @exposed(access_level=0, template='view.html', page_model='view', func_arg_mapped=False,
             mutates_result=True, http_method='POST')
    def filter_firsthits(self, request):
        if len(self._lines_groups) > 0:
            raise UserActionException(
                'Cannot apply the function once a group of lines has been saved')
        elif len(self.args.align) > 0:
            raise UserActionException('The function is not supported for aligned corpora')
        self.add_conc_form_args(FirstHitsFilterFormArgs(
            persist=True, doc_struct=self.corp.get_conf('DOCSTRUCTURE')))
        self.args.q.append('F{0}'.format(request.args.get('fh_struct')))
        return self.view(request)

    @exposed(mutates_result=True)
    def restore_conc(self, request):
        out = self._create_empty_conc_result_dict()
        out['result_shuffled'] = not conclib.conc_is_sorted(self.args.q)
        out['items_per_page'] = self.args.pagesize
        try:
            corpus_info = self.get_corpus_info(self.args.corpname)
            conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'), q=self.args.q,
                            fromp=self.args.fromp, pagesize=self.args.pagesize, asnc=True,
                            samplesize=corpus_info.sample_size)
            if conc:
                self._apply_linegroups(conc)
                conc.switch_aligned(os.path.basename(self.args.corpname))

                kwic_args = KwicPageArgs(asdict(self.args), base_attr=Kontext.BASE_ATTR)
                kwic_args.speech_attr = self._get_speech_segment()
                kwic_args.labelmap = {}
                kwic_args.alignlist = [self.cm.get_corpus(c) for c in self.args.align if c]
                kwic_args.structs = self._get_struct_opts()

                kwic = Kwic(self.corp, self.args.corpname, conc)

                out['Sort_idx'] = kwic.get_sort_idx(q=self.args.q, pagesize=self.args.pagesize)
                out.update(kwic.kwicpage(kwic_args))
                out.update(self.get_conc_sizes(conc))
                if request.args.get('next') == 'freqs':
                    out['next_action'] = 'freqs'
                    out['next_action_args'] = {
                        'fcrit': request.args.get('fcrit'),
                        'fcrit_async': request.args.getlist('fcrit_async'),
                        'flimit': request.args.get('flimit'),
                        # client does not always fills this
                        'freq_sort': request.args.get('freq_sort', 'freq'),
                        'freq_type': request.args.get('freq_type'),
                        'force_cache': request.args.get('force_cache', '0')}
                elif request.args.get('next') == 'freqml':
                    out['next_action'] = 'freqml'
                    out['next_action_args'] = {
                        'flimit': request.args.get('flimit'),
                        'freqlevel': request.args.get('freqlevel'),
                        'ml1attr': request.args.get('ml1attr'),
                        'ml2attr': request.args.get('ml2attr'),
                        'ml3attr': request.args.get('ml3attr')
                    }
                elif request.args.get('next') == 'freqct':
                    out['next_action'] = 'freqct'
                    out['next_action_args'] = {
                        'ctminfreq': request.args.get('ctminfreq', '1'),
                        'ctminfreq_type': request.args.get('ctminfreq_type'),
                        'ctattr1': self.args.ctattr1,
                        'ctfcrit1': self.args.ctfcrit1,
                        'ctattr2': self.args.ctattr2,
                        'ctfcrit2': self.args.ctfcrit2}
                elif request.args.get('next') == 'collx':
                    out['next_action'] = 'collx'
                    out['next_action_args'] = {
                        'cattr': request.args.get('cattr'),
                        'csortfn': request.args.get('csortfn'),
                        'cbgrfns':  ''.join(request.args.get('cbgrfns')),
                        'cfromw': request.args.get('cfromw'),
                        'ctow': request.args.get('ctow'),
                        'cminbgr': request.args.get('cminbgr'),
                        'cminfreq': request.args.get('cminfreq'),
                        'citemsperpage': request.args.get('citemsperpage'),
                        'collpage': request.args.get('collpage'),
                        'num_lines': request.args.get('num_lines')}
                elif request.args.get('next') == 'dispersion':
                    out['next_action'] = 'dispersion'
                    out['next_action_args'] = {}
        except TypeError as ex:
            self.add_system_message('error', str(ex))
            logging.getLogger(__name__).error(ex)
        except ConcCacheStatusException as ex:
            if 'syntax error' in f'{ex}'.lower():
                self.add_system_message(
                    'error', translate('Syntax error. Please check the query and its type.'))
            else:
                raise ex
        return out

    @exposed(access_level=0, func_arg_mapped=True, page_model='freq')
    def freqs(self, fcrit=(), fcrit_async=(), flimit=0, freq_sort='', force_cache=0, freq_type='', format=''):
        """
        Display a frequency list (tokens, text types) based on more low-level arguments. In case the
        function runs in HTML return mode, 'freq_type' must be specified so the client part is able
        to determine proper views.

        Alternatively, 'freqml', 'freqtt' actions can be used for more high-level access.
        """
        try:
            require_existing_conc(self.corp, self.args.q)
            ans = self._freqs(
                fcrit=fcrit, fcrit_async=fcrit_async, flimit=flimit, freq_sort=freq_sort, force_cache=force_cache)
            if freq_type not in ('tokens', 'text-types', '2-attribute') and format != 'json':
                raise UserActionException(f'Unknown freq type {freq_type}', code=422)
            ans['freq_type'] = freq_type
            return ans
        except ConcNotFoundException:
            self._go_to_restore_conc('freqs')

    async def _freqs(
            self, fcrit: Tuple[str, ...], fcrit_async: Tuple[str, ...], flimit: int, freq_sort: str,
            force_cache: int):

        self.disabled_menu_items = (
            MainMenu.CONCORDANCE('query-save-as'), MainMenu.VIEW('kwic-sent-switch'),
            MainMenu.CONCORDANCE('query-overview'))

        def parse_fcrit(fcrit):
            attrs, marks, ranges = [], [], []
            for i, item in enumerate(fcrit.split()):
                if i % 2 == 0:
                    attrs.append(item)
                if i % 2 == 1:
                    ranges.append(item)
            return attrs, ranges

        def is_non_structural_attr(criteria):
            crit_attrs = set(re.findall(r'(\w+)/\s+-?[0-9]+[<>][0-9]+\s*', criteria))
            if len(crit_attrs) == 0:
                crit_attrs = set(re.findall(r'(\w+\.\w+)\s+[0-9]+', criteria))
            attr_list = set(self.corp.get_posattrs())
            return crit_attrs <= attr_list

        result = {}
        fcrit_is_all_nonstruct = True
        for fcrit_item in fcrit:
            fcrit_is_all_nonstruct = (fcrit_is_all_nonstruct and is_non_structural_attr(fcrit_item))
        if fcrit_is_all_nonstruct:
            rel_mode = 1
        else:
            rel_mode = 0
        corp_info = self.get_corpus_info(self.args.corpname)

        args = freq_calc.FreqCalcArgs(
            corpname=self.corp.corpname,
            subcname=self.corp.subcname,
            subcpath=self.subcpath,
            user_id=self.session_get('user', 'id'),
            q=self.args.q,
            pagesize=self.args.pagesize,
            samplesize=0,
            flimit=flimit,
            fcrit=fcrit,
            freq_sort=freq_sort,
            ftt_include_empty=self.args.ftt_include_empty,
            rel_mode=rel_mode,
            collator_locale=corp_info.collator_locale,
            fmaxitems=self.args.fmaxitems,
            fpage=self.args.fpage,
            force_cache=True if force_cache else False)

        calc_result = freq_calc.calculate_freqs(args)
        result.update(
            fcrit=[dict(n=f, label=f.split(' ', 1)[0]) for f in fcrit],
            fcrit_async=[dict(n=f, label=f.split(' ', 1)[0]) for f in fcrit_async],
            Blocks=calc_result['data'],
            paging=0,
            concsize=calc_result['conc_size'],
            fmaxitems=self.args.fmaxitems,
            quick_from_line=1,
            quick_to_line=None)

        if not result['Blocks'][0]:
            logging.getLogger(__name__).warning('freqs - empty list: %s' % (result,))
            result.update(
                message=('error', translate('Empty list')),
                Blocks=[],
                paging=0,
                quick_from_line=None,
                quick_to_line=None,
                FCrit=[],
                fcrit=[],
                fcrit_async=[]
            )
        else:
            if len(result['Blocks']) == 1:  # paging
                result['paging'] = 1
                result['lastpage'] = calc_result['lastpage']

            for b in result['Blocks']:
                for item in b['Items']:
                    item['pfilter'] = {}
                    item['nfilter'] = {}
                    # generating positive and negative filter references
            for b_index, block in enumerate(result['Blocks']):
                curr_fcrit = fcrit[b_index]
                attrs, ranges = parse_fcrit(curr_fcrit)
                for level, (attr, range) in enumerate(zip(attrs, ranges)):
                    try:
                        begin, end = range.split('~')
                    except ValueError:
                        begin = end = range
                    attr = attr.split('/')
                    icase = '(?i)' if len(attr) > 1 and "i" in attr[1] else ''
                    attr = attr[0]
                    for ii, item in enumerate(block['Items']):
                        if not item['freq']:
                            continue
                        if '.' not in attr:
                            if attr in self.corp.get_posattrs():
                                wwords = item['Word'][level]['n'].split('  ')  # two spaces
                                fquery = f'{begin} {end} 0 '
                                fquery += ''.join([f'[{attr}="{icase}{escape_attr_val(w)}"]' for w in wwords])
                            else:  # structure number
                                fquery = '0 0 1 [] within <{} #{}/>'.format(
                                    attr, item['Word'][0]['n'].split('#')[1])
                        else:  # text types
                            structname, attrname = attr.split('.')
                            if self.corp.get_conf(structname + '.NESTED'):
                                block['unprecise'] = True
                            fquery = '0 0 1 [] within <{} {}="{}" />'.format(
                                structname, attrname, escape_attr_val(item['Word'][0]['n']))
                        if not item['freq']:
                            continue
                        item['pfilter']['q2'] = f'p{fquery}'
                        if len(attrs) == 1 and item['freq'] <= calc_result['conc_size']:
                            item['nfilter']['q2'] = f'n{fquery}'
                            # adding no error, no correction (originally for CUP)
            errs, corrs, err_block, corr_block = 0, 0, -1, -1
            for b_index, block in enumerate(result['Blocks']):
                curr_fcrit = fcrit[b_index]
                if curr_fcrit.split()[0] == 'err.type':
                    err_block = b_index
                    for item in block['Items']:
                        errs += item['freq']
                elif curr_fcrit.split()[0] == 'corr.type':
                    corr_block = b_index
                    for item in block['Items']:
                        corrs += item['freq']
            freq = calc_result['conc_size'] - errs - corrs
            if freq > 0 and err_block > -1 and corr_block > -1:
                pfilter = {'q': 'p0 0 1 ([] within ! <err/>) within ! <corr/>'}
                cc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'),
                              q=self.args.q + [pfilter[0][1]], fromp=self.args.fromp,
                              pagesize=self.args.pagesize, asnc=False)
                freq = cc.size()
                err_nfilter, corr_nfilter = {}, {}
                if freq != calc_result['conc_size']:
                    # TODO err/corr stuff is untested
                    err_nfilter = {'q': 'p0 0 1 ([] within <err/>) within ! <corr/>'}
                    corr_nfilter = {'q': 'p0 0 1 ([] within ! <err/>) within <corr/>'}
                result['NoRelSorting'] = True
                result['Blocks'][err_block]['Items'].append(
                    {'Word': [{'n': 'no error'}], 'freq': freq,
                     'pfilter': pfilter, 'nfilter': err_nfilter})
                result['Blocks'][corr_block]['Items'].append(
                    {'Word': [{'n': 'no correction'}], 'freq': freq,
                     'pfilter': pfilter, 'nfilter': corr_nfilter})

            self._add_save_menu_item('CSV', save_format='csv',
                                     hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                         self.CONC_QUICK_SAVE_MAX_LINES)))
            self._add_save_menu_item('XLSX', save_format='xlsx',
                                     hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                         self.CONC_QUICK_SAVE_MAX_LINES)))
            self._add_save_menu_item('XML', save_format='xml',
                                     hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                         self.CONC_QUICK_SAVE_MAX_LINES)))
            self._add_save_menu_item('TXT', save_format='text',
                                     hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                         self.CONC_QUICK_SAVE_MAX_LINES)))
            self._add_save_menu_item(translate('Custom'))

        result['coll_form_args'] = CollFormArgs().update(self.args).to_dict()
        result['freq_form_args'] = FreqFormArgs().update(self.args).to_dict()
        result['ctfreq_form_args'] = CTFreqFormArgs().update(self.args).to_dict()
        result['text_types_data'] = await self.tt.export_with_norms(ret_nums=True)
        result['quick_save_row_limit'] = self.FREQ_QUICK_SAVE_MAX_LINES
        self._attach_query_params(result)
        self._attach_query_overview(result)
        return result

    @exposed(access_level=1, func_arg_mapped=True, template='txtexport/savefreq.html', return_type='plain')
    def savefreq(
            self, fcrit=(), flimit=0, freq_sort='', saveformat='text', from_line=1, to_line='',
            colheaders=0, heading=0, multi_sheet_file=0):
        """
        save a frequency list
        """
        from_line = int(from_line)
        to_line = int(to_line) if to_line else sys.maxsize

        self.args.fpage = 1
        self.args.fmaxitems = to_line - from_line + 1

        # following piece of sh.t has hidden parameter dependencies
        result = self.freqs(fcrit=fcrit, flimit=flimit, freq_sort=freq_sort, format='json')
        saved_filename = self.args.corpname
        output = None
        if saveformat == 'text':
            self._response.set_header('Content-Type', 'application/text')
            self._response.set_header(
                'Content-Disposition',
                f'attachment; filename="{saved_filename}-frequencies.txt"')
            output = result
            output['Desc'] = self.concdesc_json()['Desc']
            output['fcrit'] = fcrit
            output['flimit'] = flimit
            output['freq_sort'] = freq_sort
            output['saveformat'] = saveformat
            output['from_line'] = from_line
            output['to_line'] = to_line
            output['colheaders'] = colheaders
            output['heading'] = heading
        elif saveformat in ('csv', 'xml', 'xlsx'):
            def mkfilename(suffix): return '%s-freq-distrib.%s' % (self.args.corpname, suffix)
            writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='freq')

            # Here we expect that when saving multi-block items, all the block have
            # the same number of columns which is quite bad. But currently there is
            # no better common 'denominator'.
            num_word_cols = len(result['Blocks'][0].get('Items', [{'Word': []}])[0].get('Word'))
            writer.set_col_types(*([int] + num_word_cols * [str] + [float, float]))

            self._response.set_header('Content-Type', writer.content_type())
            self._response.set_header('Content-Disposition',
                                      f'attachment; filename="{mkfilename(saveformat)}"')

            for block in result['Blocks']:
                if hasattr(writer, 'new_sheet') and multi_sheet_file:
                    writer.new_sheet(block['Head'][0]['n'])

                col_names = [item['n'] for item in block['Head'][:-2]] + ['freq', 'freq [%]']
                if saveformat == 'xml':
                    col_names.insert(0, 'str')
                if hasattr(writer, 'add_block'):
                    writer.add_block('')  # TODO block name

                if colheaders or heading:
                    writer.writeheading([''] + [item['n'] for item in block['Head'][:-2]] +
                                        ['freq', 'freq [%]'])
                i = 1
                for item in block['Items']:
                    writer.writerow(i, [w['n'] for w in item['Word']] + [str(item['freq']),
                                                                         str(item.get('rel', ''))])
                    i += 1
            output = writer.raw_content()
        return output

    @exposed(access_level=0, template='freqs.html', page_model='freq', accept_kwargs=True, func_arg_mapped=True)
    def freqml(self, flimit=0, freqlevel=1, **kwargs):
        try:
            require_existing_conc(self.corp, self.args.q)
            return self._freqml(flimit, freqlevel, **kwargs)
        except ConcNotFoundException:
            self._go_to_restore_conc('freqml')

    def _freqml(self, flimit=0, freqlevel=1, **kwargs):
        """
        multilevel frequency list
        """
        fcrit = multi_level_crit(freqlevel, **kwargs)
        result = self.freqs(
            fcrit=(fcrit,), fcrit_async=(), flimit=flimit, freq_sort='', force_cache=1, freq_type='tokens')
        result['ml'] = 1
        self._session['last_freq_level'] = freqlevel
        tmp = defaultdict(lambda: [])
        for i in range(1, freqlevel + 1):
            tmp['mlxattr'].append(kwargs.get('ml{0}attr'.format(i), 'word'))
            tmp['mlxctx'].append(kwargs.get('ml{0}ctx'.format(i), '0'))
            tmp['mlxpos'].append(kwargs.get('ml{0}pos'.format(i), 1))
            tmp['mlxicase'].append(kwargs.get('ml{0}icase'.format(i), ''))
            tmp['flimit'] = flimit
            tmp['freq_sort'] = self.args.freq_sort
        result['freq_form_args'] = tmp
        result['freq_type'] = 'tokens'
        return result

    @exposed(access_level=1, template='freqs.html', page_model='freq', func_arg_mapped=True)
    def freqtt(self, flimit=0, fttattr=(), fttattr_async=()):
        if not fttattr:
            raise ConcordanceQueryParamsError(translate('No text type selected'))
        ans = self.freqs(
            fcrit=tuple('%s 0' % a for a in fttattr), fcrit_async=['%s 0' % a for a in fttattr_async], flimit=flimit,
            freq_type='text-types')
        ans['freq_type'] = 'text-types'
        return ans

    @exposed(access_level=1, page_model='freq', template='freqs.html')
    def freqct(self, request):
        """
        """
        try:
            require_existing_conc(self.corp, self.args.q)
            return self._freqct(request)
        except ConcNotFoundException:
            self._go_to_restore_conc('freqct')

    async def _freqct(self, request):
        args = freq_calc.Freq2DCalcArgs(
            corpname=self.corp.corpname,
            subcname=getattr(self.corp, 'subcname', None),
            subcpath=self.subcpath,
            user_id=self.session_get('user', 'id'),
            q=self.args.q,
            ctminfreq=int(request.args.get('ctminfreq', '1')),
            ctminfreq_type=request.args.get('ctminfreq_type'),
            fcrit=f'{self.args.ctattr1} {self.args.ctfcrit1} {self.args.ctattr2} {self.args.ctfcrit2}')
        try:
            freq_data = freq_calc.calculate_freq2d(args)
        except UserActionException as ex:
            freq_data = dict(data=[], full_size=0)
            self.add_system_message('error', str(ex))
        self._add_save_menu_item('XLSX', save_format='xlsx')

        ans = dict(
            freq_type='2-attribute',
            attr1=self.args.ctattr1,
            attr2=self.args.ctattr2,
            data=freq_data,
            freq_form_args=FreqFormArgs().update(self.args).to_dict(),
            coll_form_args=CollFormArgs().update(self.args).to_dict(),
            ctfreq_form_args=CTFreqFormArgs().update(self.args).to_dict()
        )
        ans['text_types_data'] = await self.tt.export_with_norms(ret_nums=True)
        ans['quick_save_row_limit'] = 0
        self._attach_query_params(ans)
        return ans

    @exposed(access_level=1, return_type='plain', http_method='POST', skip_corpus_init=True)
    def export_freqct(self, request):
        with plugins.runtime.EXPORT_FREQ2D as plg:
            data = request.json
            exporter = plg.load_plugin(request.args.get('saveformat'))
            if request.args.get('savemode') == 'table':
                exporter.set_content(attr1=data['attr1'], attr2=data['attr2'],
                                     labels1=data.get('labels1', []), labels2=data.get('labels2', []),
                                     alpha_level=data['alphaLevel'], min_freq=data['minFreq'],
                                     min_freq_type=data['minFreqType'], data=data['data'])
            elif request.args.get('savemode') == 'flat':
                exporter.set_content_flat(headings=data.get('headings', []), alpha_level=data['alphaLevel'],
                                          min_freq=data['minFreq'], min_freq_type=data['minFreqType'],
                                          data=data['data'])
            self._response.set_header('Content-Type', exporter.content_type())
            self._response.set_header(
                'Content-Disposition',
                f'attachment; filename="{self.args.corpname}-2dfreq-distrib.xlsx"')
        return exporter.raw_content()

    @exposed(access_level=1, page_model='coll')
    async def collx(self, request):
        """
        list collocations
        """
        self.disabled_menu_items = (MainMenu.CONCORDANCE('query-save-as'), MainMenu.VIEW('kwic-sent-switch'),
                                    MainMenu.CONCORDANCE('query-overview'))
        self._add_save_menu_item('CSV', save_format='csv',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XLSX', save_format='xlsx',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XML', save_format='xml',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('TXT', save_format='text',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item(translate('Custom'))
        self._save_options(self.LOCAL_COLL_OPTIONS, self.args.corpname)

        try:
            require_existing_conc(self.corp, self.args.q)
            ans = asdict(self._collx(self.args.collpage, self.args.citemsperpage))
            ans['coll_form_args'] = CollFormArgs().update(self.args).to_dict()
            ans['freq_form_args'] = FreqFormArgs().update(self.args).to_dict()
            ans['ctfreq_form_args'] = CTFreqFormArgs().update(self.args).to_dict()
            ans['save_line_limit'] = self.COLLS_QUICK_SAVE_MAX_LINES
            ans['text_types_data'] = await self.tt.export_with_norms(ret_nums=True)
            ans['quick_save_row_limit'] = self.COLLS_QUICK_SAVE_MAX_LINES
            self._attach_query_overview(ans)
            return ans
        except ConcNotFoundException:
            self._go_to_restore_conc('collx')

    def _collx(self, collpage, citemsperpage) -> CalculateCollsResult:

        if self.args.csortfn == '':
            self.args.csortfn = 't'

        calc_args = coll_calc.CollCalcArgs(
            corpus_encoding=self.corp.get_conf('ENCODING'),
            corpname=self.args.corpname,
            subcname=getattr(self.corp, 'subcname', None),
            subcpath=self.subcpath,
            user_id=self.session_get('user', 'id'),
            q=self.args.q,
            samplesize=0,  # TODO (check also freqs)
            cattr=self.args.cattr,
            csortfn=self.args.csortfn,
            cbgrfns=''.join(self.args.cbgrfns),
            cfromw=self.args.cfromw,
            ctow=self.args.ctow,
            cminbgr=self.args.cminbgr,
            cminfreq=self.args.cminfreq,
            citemsperpage=citemsperpage,
            collpage=collpage)
        return coll_calc.calculate_colls(calc_args)

    @exposed(access_level=1, vars=('concsize',), func_arg_mapped=True, template='txtexport/savecoll.html',
             return_type='plain')
    def savecoll(self, from_line=1, to_line='', saveformat='text', heading=0, colheaders=0):
        """
        save collocations
        """
        try:
            require_existing_conc(self.corp, tuple(self.args.q))
            from_line = int(from_line)
            to_line = self.corp.size if to_line == '' else int(
                to_line)  # 'corp.size' is just a safe max value
            result = self._collx(collpage=1, citemsperpage=to_line)
            result.Items = result.Items[from_line - 1:]
            saved_filename = self.args.corpname
            if saveformat == 'text':
                self._response.set_header('Content-Type', 'application/text')
                self._response.set_header(
                    'Content-Disposition',
                    f'attachment; filename="{saved_filename}-collocations.txt"')
                out_data = asdict(result)
                out_data['Desc'] = self.concdesc_json()['Desc']
                out_data['saveformat'] = saveformat
                out_data['from_line'] = from_line
                out_data['to_line'] = to_line
                out_data['heading'] = heading
                out_data['colheaders'] = colheaders
            elif saveformat in ('csv', 'xml', 'xlsx'):
                def mk_filename(suffix):
                    return f'{self.args.corpname}-collocations.{suffix}'

                writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='coll')
                writer.set_col_types(int, str, *(8 * (float,)))

                self._response.set_header('Content-Type', writer.content_type())
                self._response.set_header(
                    'Content-Disposition',
                    f'attachment; filename="{mk_filename(saveformat)}"')
                if colheaders or heading:
                    writer.writeheading([''] + [item['n'] for item in result.Head])
                i = 1
                for item in result.Items:
                    writer.writerow(
                        i, (item['str'], str(item['freq'])) + tuple([str(stat['s']) for stat in item['Stats']]))
                    i += 1
                out_data = writer.raw_content()
            else:
                raise UserActionException(f'Unknown format: {saveformat}')
            return out_data
        except ConcNotFoundException:
            self._go_to_restore_conc('collx')

    @exposed(access_level=1, func_arg_mapped=True, return_type='json')
    def structctx(self, pos=0, struct='doc'):
        """
        display a hit in a context of a structure"
        """
        s = self.corp.get_struct(struct)
        struct_id = s.num_at_pos(pos)
        beg, end = s.beg(struct_id), s.end(struct_id)
        self.args.detail_left_ctx = pos - beg
        self.args.detail_right_ctx = end - pos - 1
        result = self.widectx(pos)
        return result

    @exposed(access_level=0, return_type='json')
    def fullref(self, request):
        """
        display a full reference
        """
        return conclib.get_full_ref(corp=self.corp, pos=int(request.args.get('pos', '0')))

    @exposed(access_level=1, vars=('concsize',), func_arg_mapped=True, template='txtexport/saveconc.html',
             return_type='plain')
    def saveconc(self, saveformat='text', from_line=0, to_line='', heading=0, numbering=0):

        def merge_conc_line_parts(items):
            """
            converts a list of dicts of the format [{'class': u'col0 coll', 'str': u' \\u0159ekl'},
                {'class': u'attr', 'str': u'/j\xe1/PH-S3--1--------'},...] to a CSV compatible form
            """
            ans = []
            for item in items:
                if 'class' in item and item['class'] != 'attr':
                    ans.append(' {}'.format(item['str'].strip()))
                else:
                    ans.append('{}'.format(item['str'].strip()))
                for tp in item.get('tail_posattrs', []):
                    ans.append('/{}'.format(tp))
            return ''.join(ans).strip()

        def process_lang(root, left_key, kwic_key, right_key, add_linegroup):
            if type(root) is dict:
                root = (root,)

            ans = []
            for item in root:
                ans_item = {}
                if 'ref' in item:
                    ans_item['ref'] = item['ref']
                if add_linegroup:
                    ans_item['linegroup'] = item.get('linegroup', '')
                ans_item['left_context'] = merge_conc_line_parts(item[left_key])
                ans_item['kwic'] = merge_conc_line_parts(item[kwic_key])
                ans_item['right_context'] = merge_conc_line_parts(item[right_key])
                ans.append(ans_item)
            return ans

        try:
            corpus_info = self.get_corpus_info(self.args.corpname)
            self._apply_viewmode(corpus_info.sentence_struct)

            conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'),
                            q=self.args.q, fromp=self.args.fromp, pagesize=self.args.pagesize,
                            asnc=False, samplesize=corpus_info.sample_size)
            self._apply_linegroups(conc)
            kwic = Kwic(self.corp, self.args.corpname, conc)
            conc.switch_aligned(os.path.basename(self.args.corpname))
            from_line = int(from_line)
            to_line = min(int(to_line), conc.size())
            output = {
                'from_line': from_line,
                'to_line': to_line,
                'heading': heading,
                'numbering': numbering
            }

            kwic_args = KwicPageArgs(asdict(self.args), base_attr=Kontext.BASE_ATTR)
            kwic_args.speech_attr = self._get_speech_segment()
            kwic_args.fromp = 1
            kwic_args.pagesize = to_line - (from_line - 1)
            kwic_args.line_offset = (from_line - 1)
            kwic_args.labelmap = {}
            kwic_args.align = ()
            kwic_args.alignlist = [self.cm.get_corpus(c) for c in self.args.align if c]
            kwic_args.leftctx = self.args.leftctx
            kwic_args.rightctx = self.args.rightctx
            kwic_args.structs = self._get_struct_opts()

            data = kwic.kwicpage(kwic_args)

            def mkfilename(suffix): return f'{self.args.corpname}-concordance.{suffix}'
            if saveformat == 'text':
                self._response.set_header('Content-Type', 'text/plain')
                self._response.set_header(
                    'Content-Disposition',
                    f"attachment; filename=\"{mkfilename('txt')}\"")
                output.update(data)
                for item in data['Lines']:
                    item['ref'] = ', '.join(item['ref'])
                # we must set contains_within = False as it is impossible (in the current user interface)
                # to offer a custom i.p.m. calculation before the download starts
                output['result_relative_freq_rel_to'] = self._get_ipm_base_set_desc(
                    contains_within=False)
                output['Desc'] = self.concdesc_json()['Desc']
            elif saveformat in ('csv', 'xlsx', 'xml'):
                writer = plugins.runtime.EXPORT.instance.load_plugin(
                    saveformat, subtype='concordance')

                self._response.set_header('Content-Type', writer.content_type())
                self._response.set_header(
                    'Content-Disposition',
                    f'attachment; filename="{mkfilename(saveformat)}"')

                if len(data['Lines']) > 0:
                    aligned_corpora = [self.corp] + \
                                      [self.cm.get_corpus(c) for c in self.args.align if c]
                    writer.set_corpnames([c.get_conf('NAME') or c.get_conffile()
                                          for c in aligned_corpora])

                    if heading:
                        writer.writeheading({
                            'corpus': self._human_readable_corpname(),
                            'subcorpus': self.args.usesubcorp,
                            'concordance_size': data['concsize'],
                            'arf': data['result_arf'],
                            'query': ['%s: %s (%s)' % (x['op'], x['arg'], x['size'])
                                      for x in self.concdesc_json().get('Desc', [])]
                        })

                        doc_struct = self.corp.get_conf('DOCSTRUCTURE')
                        refs_args = [x.strip('=') for x in self.args.refs.split(',')]
                        used_refs = ([('#', translate('Token number')), (doc_struct, translate('Document number'))] +
                                     [(x, x) for x in self.corp.get_structattrs()])
                        used_refs = [x[1] for x in used_refs if x[0] in refs_args]
                        writer.write_ref_headings([''] + used_refs if numbering else used_refs)

                    if 'Left' in data['Lines'][0]:
                        left_key = 'Left'
                        kwic_key = 'Kwic'
                        right_key = 'Right'
                    elif 'Sen_Left' in data['Lines'][0]:
                        left_key = 'Sen_Left'
                        kwic_key = 'Kwic'
                        right_key = 'Sen_Right'
                    else:
                        raise ConcordanceQueryParamsError(translate('Invalid data'))

                    for i in range(len(data['Lines'])):
                        line = data['Lines'][i]
                        if numbering:
                            row_num = str(i + from_line)
                        else:
                            row_num = None

                        lang_rows = process_lang(line, left_key, kwic_key, right_key,
                                                 add_linegroup=self._lines_groups.is_defined())
                        if 'Align' in line:
                            lang_rows += process_lang(line['Align'], left_key, kwic_key, right_key,
                                                      add_linegroup=False)
                        writer.writerow(row_num, *lang_rows)
                output = writer.raw_content()
            else:
                raise UserActionException(translate('Unknown export data type'))
            return output
        except Exception as e:
            self._response.set_header('Content-Type', 'text/html')
            if self._response.contains_header('Content-Disposition'):
                self._response.remove_header('Content-Disposition')
            raise e

    @exposed(access_level=0, return_type='plain')
    def audio(self, request):
        """
        Provides access to audio-files containing speech segments.
        Access rights are per-corpus (i.e. if a user has a permission to
        access corpus 'X' then all related audio files are accessible).
        """
        with plugins.runtime.AUDIO_PROVIDER as audiop:
            headers, ans = audiop.get_audio(self._plugin_ctx, request)
            for h, v in headers.items():
                self._response.set_header(h, v)
            return ans

    @exposed(return_type='json', access_level=0)
    def audio_waveform(self, request):
        with plugins.runtime.AUDIO_PROVIDER as audiop:
            return audiop.get_waveform(self._plugin_ctx, request)

    def _collect_conc_next_url_params(self, query_id):
        params = {
            'corpname': self.args.corpname,
            'q': '~%s' % query_id,
            'viewmode': self.args.viewmode,
            'attrs': self.args.attrs,
            'structs': self.args.structs,
            'refs': self.args.refs,
            'attr_vmode': self.args.attr_vmode
        }
        if self.args.usesubcorp:
            params['usesubcorp'] = self.args.usesubcorp
        if self.args.align:
            params['align'] = self.args.align
        return params

    @staticmethod
    def _filter_lines(data, pnfilter):
        def expand(x, n):
            return list(range(x, x + n))

        sel_lines = []
        for item in data:
            sel_lines.append(''.join(['[#%d]' % x2 for x2 in expand(item[0], item[1])]))
        return '%s%s %s %i %s' % (pnfilter, 0, 0, 0, '|'.join(sel_lines))

    @exposed(return_type='json', http_method='POST', mutates_result=True)
    def ajax_unset_lines_groups(self, _):
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            pipeline = qp.load_pipeline_ops(self._plugin_ctx, self._q_code, build_conc_form_args)
        i = len(pipeline) - 1
        # we have to go back before the current block
        # of lines-groups operations and find an
        # operation to start a new query pipeline
        while i >= 0 and pipeline[i].form_type == 'lgroup':
            i -= 1
        if i < 0:
            raise Exception('Broken operation chain')
        self._clear_prev_conc_params()  # we do not want to chain next state with the current one
        self._lines_groups = LinesGroups(data=[])
        pipeline[i].make_saveable()  # drop old opKey, set as persistent
        self.add_conc_form_args(pipeline[i])
        return {}

    @exposed(return_type='json', http_method='POST', mutates_result=True)
    def ajax_apply_lines_groups(self, request):
        rows = request.form.get('rows')
        self._lines_groups = LinesGroups(data=json.loads(rows))
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(return_type='json', http_method='POST', mutates_result=True)
    def ajax_remove_non_group_lines(self, _):
        self.args.q.append(self._filter_lines([(x[0], x[1]) for x in self._lines_groups], 'p'))
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(return_type='json', http_method='POST', mutates_result=True)
    def ajax_sort_group_lines(self, _):
        self._lines_groups.sorted = True
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(return_type='json', http_method='POST', mutates_result=True)
    def ajax_remove_selected_lines(self, request):
        pnfilter = request.args.get('pnfilter', 'p')
        rows = request.form.get('rows', '')
        data = json.loads(rows)
        self.args.q.append(self._filter_lines(data, pnfilter))
        self.add_conc_form_args(LockedOpFormsArgs(persist=True))
        return {}

    @exposed(return_type='json', http_method='POST', func_arg_mapped=False)
    def ajax_send_group_selection_link_to_mail(self, request):
        with plugins.runtime.AUTH as auth:
            user_info = auth.get_user_info(self._plugin_ctx)
            user_email = user_info['email']
            username = user_info['username']
            smtp_server = mailing.smtp_factory()
            url = request.args.get('url')
            recip_email = request.args.get('email')

            text = translate('KonText user %s has sent a concordance link to you') % (
                username,) + ':'
            text += '\n\n'
            text += url + '\n\n'
            text += '\n---------------------\n'
            text += time.strftime('%d.%m. %Y %H:%M')
            text += '\n'

            msg = mailing.message_factory(
                recipients=[recip_email],
                subject=translate('KonText concordance link'),
                text=text,
                reply_to=user_email)
            return dict(ok=mailing.send_mail(smtp_server, msg, [recip_email]))

    @exposed(return_type='json', http_method='POST', mutates_result=True)
    def ajax_reedit_line_selection(self, _):
        ans = self._lines_groups.as_list()
        self._lines_groups = LinesGroups(data=[])
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return dict(selection=ans)

    @exposed(return_type='json')
    def ajax_get_line_groups_stats(self, _):
        ans = defaultdict(lambda: 0)
        for item in self._lines_groups:
            ans[item[2]] += 1

        return dict(groups=ans)

    @exposed(return_type='json')
    def ajax_get_first_line_select_page(self, _):
        corpus_info = self.get_corpus_info(self.args.corpname)
        conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'),
                        q=self.args.q, fromp=self.args.fromp, pagesize=self.args.pagesize,
                        asnc=False, samplesize=corpus_info.sample_size)
        self._apply_linegroups(conc)
        kwic = Kwic(self.corp, self.args.corpname, conc)
        return {'first_page': int((kwic.get_groups_first_line() - 1) / self.args.pagesize) + 1}

    @exposed(return_type='json', http_method='POST', mutates_result=True)
    def ajax_rename_line_group(self, request):
        from_num = int(request.form.get('from_num', '0'))
        to_num = int(request.form.get('to_num', '-1'))
        new_groups = [v for v in self._lines_groups if v[2] != from_num or to_num != -1]
        if to_num > 0:
            new_groups = [v if v[2] != from_num else (v[0], v[1], to_num) for v in new_groups]
        self._lines_groups = LinesGroups(data=new_groups)
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(access_level=1, return_type='plain', http_method='POST')
    def export_line_groups_chart(self, request):
        with plugins.runtime.CHART_EXPORT as ce:
            format = request.json.get('cformat')
            filename = 'line-groups-{0}.{1}'.format(self.args.corpname, ce.get_suffix(format))
            self._response.set_header('Content-Type', ce.get_content_type(format))
            self._response.set_header('Content-Disposition',
                                      f'attachment; filename="{filename}.{format}"')
            data = sorted(request.json.get('data', {}), key=lambda x: int(x['groupId']))
            total = sum(x['count'] for x in data)
            data = [('#{0} ({1}%)'.format(x['groupId'], round(x['count'] / float(total) * 100, 1)), x['count'])
                    for x in data]
            return ce.export_pie_chart(data=data, title=request.form.get('title', '??'), format=format)

    @exposed(return_type='json', http_method='POST')
    def get_adhoc_subcorp_size(self, request):
        if plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(
                self._plugin_ctx, [self.args.corpname] + self.args.align):
            # a faster solution based on liveattrs
            with plugins.runtime.LIVE_ATTRIBUTES as liveatt:
                attr_map = TextTypeCollector(self.corp, request.json['text_types']).get_attrmap()
                involved_corpora = [self.args.corpname] + self.args.align[:]
                size = liveatt.get_subc_size(self._plugin_ctx, involved_corpora, attr_map)
                return dict(total=size)
        else:
            tt_query = TextTypeCollector(self.corp, request.json['text_types']).get_query()
            query = 'aword,[] within {}'.format(
                ' '.join('<{0} {1} />'.format(k, v) for k, v in tt_query))
            self.args.q = [query]
            conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'), q=self.args.q,
                            fromp=self.args.fromp, pagesize=self.args.pagesize, asnc=0)
            return dict(total=conc.fullsize() if conc else None)

    @exposed(http_method='GET', return_type='json')
    def load_query_pipeline(self, _):
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            pipeline = qp.load_pipeline_ops(self._plugin_ctx, self._q_code, build_conc_form_args)
        ans = dict(ops=[dict(id=x.op_key, form_args=x.to_dict()) for x in pipeline])
        self._attach_query_overview(ans)
        return ans

    @exposed(http_method='GET', return_type='json')
    def matching_structattr(self, request):
        def is_invalid(v):
            return re.search(r'[<>\]\[]', v) is not None

        if (is_invalid(request.args.get('struct')) or is_invalid(request.args.get('attr')) or
                is_invalid(request.args.get('attr_val')) or is_invalid(request.args.get('search_attr'))):
            raise UserActionException('Invalid character in attribute/structure name/value')

        ans, found, used = corplib.matching_structattr(
            self.corp, request.args.get('struct'), request.args.get(
                'attr'), request.args.get('attr_val'),
            request.args.get('search_attr'))
        if len(ans) == 0:
            self._response.set_http_status(404)
        return dict(result=ans, conc_size=found, lines_used=used)
