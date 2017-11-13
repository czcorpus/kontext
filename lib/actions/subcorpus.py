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
from controller.errors import FunctionNotSupported, UserActionException
from kontext import MainMenu, AsyncTaskStatus
from querying import Querying
from translation import ugettext as _
import plugins
import l10n
from l10n import import_string, export_string, format_number
import corplib
from texttypes import TextTypeCollector, get_tt
import settings
import argmapping


class SubcorpusError(Exception):
    pass


class Subcorpus(Querying):

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
        corp_encoding = self.corp.get_conf('ENCODING')
        aligned_corpora = request.form.getlist('aligned_corpora')
        corpus_info = self.get_corpus_info(self.args.corpname)

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
        elif len(aligned_corpora) > 0 and plugins.runtime.LIVE_ATTRIBUTES.exists:
            if corpus_info.metadata.label_attr and corpus_info.metadata.id_attr:
                within_cql = None
                attrs = json.loads(request.form.get('attrs', '{}'))
                sel_match = plugins.runtime.LIVE_ATTRIBUTES.instance.get_attr_values(
                    self._plugin_api, corpus=self.corp,
                    attr_map=attrs,
                    aligned_corpora=aligned_corpora,
                    limit_lists=False)
                values = sel_match['attr_values'][corpus_info.metadata.label_attr]
                args = argmapping.Args()
                setattr(args, 'sca_{0}'.format(
                    corpus_info.metadata.id_attr), [v[1] for v in values])
                tt_query = TextTypeCollector(self.corp, args).get_query()
                tmp = ['<%s %s />' % item for item in tt_query]
                full_cql = ' within '.join(tmp)
                full_cql = 'aword,[] within %s' % full_cql
                full_cql = import_string(full_cql, from_encoding=self.corp_encoding)
                imp_cql = (full_cql,)
            else:
                raise FunctionNotSupported(
                    'Corpus must have a bibliography item defined to support this function')
        else:
            within_cql = None
            tt_query = TextTypeCollector(self.corp, request).get_query()
            tmp = ['<%s %s />' % item for item in tt_query]
            full_cql = ' within '.join(tmp)
            full_cql = 'aword,[] within %s' % full_cql
            full_cql = import_string(full_cql, from_encoding=self.corp_encoding)
            imp_cql = (full_cql,)

        basecorpname = self.args.corpname.split(':')[0]
        if not subcname:
            raise UserActionException(_('No subcorpus name specified!'))
        path = self.prepare_subc_path(basecorpname, subcname)

        if type(path) == unicode:
            path = path.encode('utf-8')

        if len(tt_query) == 1 and len(aligned_corpora) == 0:
            result = corplib.create_subcorpus(path, self.corp, tt_query[0][0], tt_query[0][1])
        elif len(tt_query) > 1 or within_cql or len(aligned_corpora) > 0:
            backend, conf = settings.get_full('global', 'calc_backend')
            if backend == 'celery':
                import task
                app = task.get_celery_app(conf['conf'])
                res = app.send_task('worker.create_subcorpus',
                                    (self.session_get('user', 'id'), self.args.corpname, path, tt_query, imp_cql))
                self._store_async_task(AsyncTaskStatus(status=res.status, ident=res.id,
                                                       category=AsyncTaskStatus.CATEGORY_SUBCORPUS,
                                                       label=u'%s:%s' % (self._canonical_corpname(basecorpname),
                                                                         subcname),
                                                       args=dict(subcname=subcname, corpname=basecorpname)))
                result = {}
            elif backend == 'multiprocessing':
                from bgcalc import subc_calc
                import functools
                import multiprocessing
                worker = subc_calc.CreateSubcorpusTask(user_id=self.session_get('user', 'id'),
                                                       corpus_id=self.args.corpname)
                multiprocessing.Process(target=functools.partial(
                    worker.run, tt_query, imp_cql, path)).start()
                result = {}
        else:
            raise UserActionException(_('Nothing specified!'))
        if result is not False:
            if plugins.runtime.SUBC_RESTORE.exists:
                try:
                    with plugins.runtime.SUBC_RESTORE as sr:
                        sr.store_query(user_id=self.session_get('user', 'id'),
                                       corpname=self.args.corpname,
                                       subcname=subcname,
                                       cql=full_cql.strip().split('[]', 1)[-1])
                except Exception as e:
                    logging.getLogger(__name__).warning('Failed to store subcorpus query: %s' % e)
                    self.add_system_message('warning',
                                            _('Subcorpus created but there was a problem saving a backup copy.'))
            unfinished_corpora = filter(lambda at: not at.is_finished(),
                                        self.get_async_tasks(category=AsyncTaskStatus.CATEGORY_SUBCORPUS))
            return dict(unfinished_subc=[uc.to_dict() for uc in unfinished_corpora])
        else:
            raise SubcorpusError(_('Empty subcorpus!'))

    @exposed(access_level=1, template='subcorpus/subcorp_form.tmpl', page_model='subcorpForm',
             http_method='POST')
    def subcorp(self, request):
        try:
            ans = self._create_subcorpus(request)
            self.redirect('subcorpus/subcorp_list?corpname=%s' % self.args.corpname)
        except (SubcorpusError, UserActionException, RuntimeError) as e:
            self.add_system_message('error', getattr(e, 'message', e.__repr__()))
            ans = self.subcorp_form(request)
        return ans

    @exposed(access_level=1)
    def subcorp_form(self, request):
        """
        Displays a form to create a new subcorpus
        """
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS + (MainMenu.VIEW, )
        method = request.form.get('method', 'gui')
        within_json = request.form.get('within_json', None)
        if within_json:
            within_data = json.loads(within_json)
        else:
            within_data = []
        subcname = request.form.get('subcname', None)
        subcnorm = request.args.get('subcnorm', 'tokens')

        try:
            tt_sel = get_tt(self.corp, self._plugin_api).export_with_norms(subcnorm=subcnorm)
        except UserActionException as e:
            tt_sel = {'Normslist': [], 'Blocks': []}
            self.add_system_message('warning', e)
        structs_and_attrs = {}
        for s, a in [t.split('.') for t in self.corp.get_conf('STRUCTATTRLIST').split(',')]:
            if s not in structs_and_attrs:
                structs_and_attrs[s] = []
            structs_and_attrs[s].append(a)

        out = dict(SubcorpList=())
        self._attach_aligned_query_params(out)
        corpus_info = self.get_corpus_info(self.args.corpname)
        out.update(dict(
            Normslist=tt_sel['Normslist'],
            text_types_data=json.dumps(tt_sel),
            structs_and_attrs=structs_and_attrs,
            method=method,
            within_data=within_data,
            subcname=subcname,
            subcnorm=subcnorm,
            id_attr=corpus_info.metadata.id_attr
        ))
        return out

    @exposed(access_level=1, return_type='json')
    def ajax_create_subcorpus(self, request):
        return self._create_subcorpus(request)

    def _create_full_subc_list(self, queries, subc_files):
        pass

    @exposed(access_level=1, skip_corpus_init=True, http_method='POST', return_type='json')
    def delete(self, request):
        selected_corpora = json.loads(request.get_data())
        subc_user_path = self.subcpath[-1]
        for item in selected_corpora:
            try:
                os.unlink(os.path.join(subc_user_path, item['corpname'],
                                       item['subcname']).encode('utf-8') + '.subc')
            except TypeError as e:
                self.add_system_message('error', e)
        return {}

    @exposed(access_level=1, skip_corpus_init=True)
    def subcorp_list(self, request):
        """
        Displays a list of user subcorpora. In case there is a 'subc_restore' plug-in
        installed then the list is enriched by additional re-use/undelete information.
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)

        sort = request.args.get('sort', 'name')
        filter_args = dict(show_deleted=bool(int(request.args.get('show_deleted', 0))),
                           corpname=request.args.get('corpname'))
        data = []
        user_corpora = plugins.runtime.AUTH.instance.permitted_corpora(
            self.session_get('user')).values()
        related_corpora = set()
        for corp in user_corpora:
            try:
                for item in self.cm.subcorp_names(corp):
                    sc = self.cm.get_Corpus(corp, item['n'])
                    data.append({
                        'name': '%s:%s' % (self._canonical_corpname(corp), item['n']),
                        'size': sc.search_size(),
                        'created': time.mktime(sc.created.timetuple()),
                        'corpname': corp,
                        'human_corpname': sc.get_conf('NAME'),
                        'usesubcorp': item['n'],
                        'deleted': False})
                    related_corpora.add(self._canonical_corpname(corp))
            except Exception as e:
                for d in data:
                    # permitted_corpora does this
                    d['usesubcorp'] = werkzeug.urls.url_quote(d['usesubcorp'], unsafe='+')
                logging.getLogger(__name__).warn(
                    'Failed to fetch information about subcorpus of [%s]: %s' % (corp, e))

        if filter_args['corpname']:
            data = filter(lambda item: not filter_args['corpname'] or item['corpname'] == filter_args['corpname'],
                          data)
        elif filter_args['corpname'] is None:
            filter_args['corpname'] = ''  # JS code requires non-null value

        if plugins.runtime.SUBC_RESTORE.exists:
            try:
                full_list = plugins.runtime.SUBC_RESTORE.instance.extend_subc_list(self._plugin_api, data,
                                                                                   filter_args, 0)
            except Exception as e:
                logging.getLogger(__name__).error(
                    'subc_restore plug-in failed to list queries: %s' % e)
                full_list = data
        else:
            full_list = data

        sort_key, rev = self._parse_sorting_param(sort)
        if sort_key in ('size', 'created'):
            full_list = sorted(full_list, key=lambda x: x[sort_key], reverse=rev)
        else:
            full_list = l10n.sort(full_list, loc=self.ui_lang,
                                  key=lambda x: x[sort_key], reverse=rev)
        unfinished_corpora = filter(lambda at: not at.is_finished(),
                                    self.get_async_tasks(category=AsyncTaskStatus.CATEGORY_SUBCORPUS))
        ans = dict(
            SubcorpList=[],   # this is used by subcorpus SELECT element; no need for that here
            subcorp_list=full_list,
            sort_key=dict(name=sort_key, reverse=rev),
            filter=filter_args,
            unfinished_subc=[uc.to_dict() for uc in unfinished_corpora],
            related_corpora=sorted(related_corpora)
        )
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
        if plugins.runtime.SUBC_RESTORE.exists:
            with plugins.runtime.SUBC_RESTORE as sr:
                tmp = sr.get_info(self.session_get('user', 'id'), self.args.corpname, subcname)
                if tmp:
                    ans['extended_info'].update(tmp)
        return ans

    @exposed(access_level=1, return_type='json')
    def ajax_wipe_subcorpus(self, request):
        if plugins.runtime.SUBC_RESTORE.exists:
            corpus_id = request.form['corpname']
            subcorp_name = request.form['subcname']
            with plugins.runtime.SUBC_RESTORE as sr:
                sr.delete_query(self.session_get('user', 'id'), corpus_id, subcorp_name)
            self.add_system_message('info',
                                    _('Subcorpus %s has been deleted permanently.') % subcorp_name)
        else:
            self.add_system_message('error', _('Unsupported operation (plug-in not present)'))
        return {}
