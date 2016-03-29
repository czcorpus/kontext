# Copyright (c) 2015 Institute of the Czech National Corpus
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

import os
import logging
import json
import time

import werkzeug.urls

from controller import exposed
from kontext import Kontext, ConcError, MainMenu, UserActionException, AsyncTaskStatus
from translation import ugettext as _
import plugins
import l10n
from l10n import import_string, export_string, format_number
import corplib
from argmapping import ConcArgsMapping
from texttypes import TextTypeCollector, get_tt
import settings


class Subcorpus(Kontext):

    def __init__(self, request, ui_lang):
        super(Subcorpus, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/subcorpus/'

    def prepare_subc_path(self, corpname, subcname):
        path = os.path.join(self.subcpath[-1], corpname)
        if not os.path.isdir(path):
            os.makedirs(path)
        return os.path.join(path, subcname) + '.subc'

    def _deserialize_custom_within(self, data):
        """
         return this.lines.filter((v)=>v != null).map(
            (v:WithinLine) => (
                (v.negated ? '!within' : 'within') + ' <' + v.structureName
                    + ' ' + v.attributeCql + ' />')
        ).join(' ');
        }
        """
        return ' '.join(map(lambda item: ('!within' if item['negated'] else 'within') + ' <%s %s />' % (
                item['structure_name'], item['attribute_cql']),
            filter(lambda item: bool(item), data)))

    def _create_subcorpus(self, request):
        """
        req. arguments:
        subcname -- name of new subcorpus
        create -- bool, sets whether to create new subcorpus
        cql -- custom within condition
        """
        subcname = request.form['subcname']
        within_json = request.form.get('within_json')
        raw_cql = request.form.get('cql')
        corp_encoding = self._corp().get_conf('ENCODING')

        if raw_cql:
            aligned_corpora = []
            tt_query = ()
            within_cql = raw_cql
            full_cql = 'aword,[] %s' % raw_cql
            imp_cql = (full_cql,)
        elif within_json:  # user entered a subcorpus query manually
            aligned_corpora = []
            tt_query = ()
            within_cql = self._deserialize_custom_within(json.loads(within_json))
            full_cql = 'aword,[] %s' % within_cql
            imp_cql = (full_cql,)
        else:
            within_cql = None
            tt_query = TextTypeCollector(self._corp(), request).get_query()
            tmp = ['<%s %s />' % item for item in tt_query]
            aligned_corpora = request.form.getlist('aligned_corpora')
            if len(aligned_corpora) > 0:
                tmp.extend(map(lambda cn: '%s: []' % export_string(cn, to_encoding=corp_encoding), aligned_corpora))
            full_cql = ' within '.join(tmp)
            full_cql = 'aword,[] within %s' % full_cql
            full_cql = import_string(full_cql, from_encoding=corp_encoding)
            imp_cql = (full_cql,)

        basecorpname = self.args.corpname.split(':')[0]
        if not subcname:
            raise UserActionException(_('No subcorpus name specified!'))
        path = self.prepare_subc_path(basecorpname, subcname)

        if type(path) == unicode:
            path = path.encode('utf-8')

        if len(tt_query) == 1 and len(aligned_corpora) == 0:
            result = corplib.create_subcorpus(path, self._corp(), tt_query[0][0], tt_query[0][1])
        elif len(tt_query) > 1 or within_cql or len(aligned_corpora) > 0:
            # TEST BEGIN
            backend, conf = settings.get_full('global', 'calc_backend')
            if backend == 'celery':
                import task
                from kontext import AsyncTaskStatus
                app = task.get_celery_app(conf['conf'])
                res = app.send_task('worker.create_subcorpus',
                                    (self._session_get('user', 'id'), self.args.corpname, path, tt_query, imp_cql))
                self._store_async_task(AsyncTaskStatus(status=res.status, ident=res.id,
                                                       category=AsyncTaskStatus.CATEGORY_SUBCORPUS,
                                                       label=u'%s:%s' % (basecorpname, subcname),
                                                       args={'subcname': subcname, 'corpname': basecorpname}))
                result = {}
            else:
                # TODO
                pass
            # TEST END
        else:
            raise UserActionException(_('Nothing specified!'))
        if result is not False:
            if plugins.has_plugin('subc_restore'):
                try:
                    plugins.get('subc_restore').store_query(user_id=self._session_get('user', 'id'),
                                                            corpname=self.args.corpname,
                                                            subcname=subcname,
                                                            cql=full_cql.split('[]')[-1])
                except Exception as e:
                    logging.getLogger(__name__).warning('Failed to store subcorpus query: %s' % e)
                    self.add_system_message('warning',
                                            _('Subcorpus created but there was a problem saving a backup copy.'))
            return {}
        else:
            raise ConcError(_('Empty subcorpus!'))

    @exposed(access_level=1, template='subcorpus/subcorp_form.tmpl', page_model='subcorpForm',
             http_method='POST')
    def subcorp(self, request):
        try:
            ans = self._create_subcorpus(request)
            self._redirect('subcorpus/subcorp_list?corpname=%s' % self.args.corpname)
        except (ConcError, UserActionException, RuntimeError) as e:
            self.add_system_message('error', getattr(e, 'message', e.__repr__()))
            ans = self.subcorp_form(request, None)
        return ans

    @exposed(access_level=1, argmappings=(ConcArgsMapping,))
    def subcorp_form(self, request, conc_args):
        """
        Displays a form to create a new subcorpus
        """
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS
        method = request.form.get('method', 'gui')
        within_json = request.form.get('within_json', 'null')
        subcname = request.form.get('subcname', None)
        subcnorm = request.args.get('subcnorm', 'tokens')

        try:
            tt_sel = get_tt(self._corp(), self.ui_lang).export_with_norms(subcnorm=subcnorm)
        except UserActionException as e:
            tt_sel = {'Normslist': [], 'Blocks': []}
            self.add_system_message('warning', e)
        structs_and_attrs = {}
        for s, a in [t.split('.') for t in self._corp().get_conf('STRUCTATTRLIST').split(',')]:
            if s not in structs_and_attrs:
                structs_and_attrs[s] = []
            structs_and_attrs[s].append(a)

        out = {'SubcorpList': ()}
        if self.environ['REQUEST_METHOD'] == 'POST':
            self._store_checked_text_types(request.form, out)

        if plugins.has_plugin('subcmixer'):
            out['subcmixer_form_data'] = plugins.get('subcmixer').form_data(self._plugin_api)
        else:
            out['subcmixer_form_data'] = {}
        self._attach_aligned_corpora_info(out)
        out.update({
            'TextTypeSel': tt_sel,
            'structs_and_attrs': structs_and_attrs,
            'method': method,
            'within_json': within_json,
            'subcname': subcname,
            'subcnorm': subcnorm
        })
        return out

    @exposed(access_level=1, return_type='json')
    def ajax_create_subcorpus(self, request):
        return self._create_subcorpus(request)

    def _delete_subcorpora(self, subc_list):
        """
        arguments:
        subc_list -- a list of (corpus, subcorpus) tuples or corpus:subcorpus strings
        """
        base = self.subcpath[-1]
        for subcorp_id in subc_list:
            try:
                if type(subcorp_id) in (str, unicode):
                    corp, subcorp = subcorp_id.split(':', 1)
                else:
                    corp, subcorp = subcorp_id
                os.unlink(os.path.join(base, corp, subcorp).encode('utf-8') + '.subc')
            except TypeError as e:
                self.add_system_message('error', e)

    def _create_full_subc_list(self, queries, subc_files):
        pass

    @exposed(access_level=1, skip_corpus_init=True)
    def subcorp_list(self, request):
        """
        Displays a list of user subcorpora. In case there is a 'subc_restore' plug-in
        installed then the list is enriched by additional re-use/undelete information.
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)

        sort = 'n'  # TODO
        show_deleted = int(request.args.get('show_deleted', 0))
        if self.get_http_method() == 'POST':
            selected_subc = request.form.getlist('selected_subc')
            self._delete_subcorpora(selected_subc)

        data = []
        user_corpora = plugins.get('auth').permitted_corpora(self._session_get('user', 'id')).values()
        for corp in user_corpora:
            try:
                for item in self.cm.subcorp_names(corp):
                    sc = self.cm.get_Corpus(corp, item['n'])
                    data.append({
                        'n': '%s:%s' % (self._canonical_corpname(corp), item['n']),
                        'internal_n': '%s:%s' % (corp, item['n']),
                        'v': item['n'],
                        'size': sc.search_size(),
                        'created': sc.created,
                        'corpname': corp,
                        'human_corpname': sc.get_conf('NAME'),
                        'usesubcorp': item['n'],
                        'deleted': False
                    })
            except Exception as e:
                for d in data:
                    # permitted_corpora does this
                    d['usesubcorp'] = werkzeug.urls.url_quote(d['usesubcorp'], unsafe='+')
                logging.getLogger(__name__).warn(
                    'Failed to fetch information about subcorpus of [%s]: %s' % (corp, e))

        if plugins.has_plugin('subc_restore'):
            try:
                full_list = plugins.get('subc_restore').extend_subc_list(
                    data, self._session_get('user', 'id'),
                    self._canonical_corpname,
                    bool(show_deleted), 0)
            except Exception as e:
                logging.getLogger(__name__).error('subc_restore plug-in failed to list queries: %s' % e)
                full_list = []
        else:
            full_list = data

        # TODO sorting does not work
        sort_key, rev = Kontext._parse_sorting_param(sort)
        if sort_key in ('size', 'created'):
            data = sorted(data, key=lambda x: x[sort_key], reverse=rev)
        else:
            data = l10n.sort(data, loc=self.ui_lang, key=lambda x: x[sort_key], reverse=rev)

        sort_keys = dict([(x, (x, '')) for x in ('n', 'size', 'created')])
        if not rev:
            sort_keys[sort_key] = ('-%s' % sort_key, '&#8593;')
        else:
            sort_keys[sort_key] = (sort_key, '&#8595;')

        ans = {
            'SubcorpList': [],   # this is used by subcorpus SELECT element; no need for that here
            'subcorp_list': full_list,
            'sort_keys': sort_keys,
            'show_deleted': show_deleted,
            'rev': rev,
            'unfinished_subc': filter(lambda at: at.category == AsyncTaskStatus.CATEGORY_SUBCORPUS and not at.is_finished(),
                                      self.get_async_tasks())
        }
        return ans

    @exposed(access_level=1, return_type='json', legacy=True)
    def ajax_subcorp_info(self, subcname=''):
        sc = self.cm.get_Corpus(self.args.corpname, subcname)
        ans = {
            'corpusName': self._canonical_corpname(self.args.corpname),
            'subCorpusName': subcname,
            'corpusSize': format_number(sc.size()),
            'subCorpusSize': format_number(sc.search_size()),
            'created': time.strftime(l10n.datetime_formatting(), sc.created.timetuple()),
            'extended_info': {}
        }
        if plugins.has_plugin('subc_restore'):
            tmp = plugins.get('subc_restore').get_info(self._session_get('user', 'id'),
                                                       self.args.corpname, subcname)
            if tmp:
                ans['extended_info'].update(tmp)
        return ans

    @exposed(access_level=1, return_type='json')
    def ajax_wipe_subcorpus(self, request):
        if plugins.has_plugin('subc_restore'):
            corpus_id = request.form['corpname']
            subcorp_name = request.form['subcname']
            plugins.get('subc_restore').delete_query(self._session_get('user', 'id'),
                                                     corpus_id, subcorp_name)
            self.add_system_message('info',
                                    _('Subcorpus %s has been deleted permanently.') % subcorp_name)
        else:
            self.add_system_message('error', _('Unsupported operation (plug-in not present)'))
        return {}

