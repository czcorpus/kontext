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
import hashlib

from controller import exposed
from controller.errors import FunctionNotSupported, UserActionException
from controller.kontext import AsyncTaskStatus
from controller.querying import Querying
from main_menu import MainMenu
from translation import ugettext as translate
import plugins
import l10n
from l10n import import_string
import corplib
from texttypes import TextTypeCollector, get_tt
import settings
import argmapping

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


class SubcorpusError(Exception):
    pass


class Subcorpus(Querying):

    def __init__(self, request, ui_lang):
        super(Subcorpus, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/subcorpus/'

    def prepare_subc_path(self, corpname, subcname, publish):
        if publish:
            code = hashlib.md5(u'{0} {1} {2}'.format(self.session_get(
                'user', 'id'), corpname, subcname).encode('utf-8')).hexdigest()[:10]
            path = os.path.join(self.subcpath[1], corpname)
            if not os.path.isdir(path):
                os.makedirs(path)
            return os.path.join(path, code) + '.subc'
        else:
            path = os.path.join(self.subcpath[0], corpname)
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
        aligned_corpora = request.form.getlist('aligned_corpora')
        publish = bool(int(request.form.get('publish')))
        corpus_info = self.get_corpus_info(self.args.corpname)
        description = request.form.get('description')

        if not subcname:
            raise UserActionException(translate('No subcorpus name specified!'))

        if publish and not description:
            raise UserActionException(translate('No description specified'))

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
        path = self.prepare_subc_path(basecorpname, subcname, publish=False)
        publish_path = self.prepare_subc_path(
            basecorpname, subcname, publish=True) if publish else None

        if type(path) == unicode:
            path = path.encode('utf-8')

        if len(tt_query) == 1 and len(aligned_corpora) == 0:
            result = corplib.create_subcorpus(path, self.corp, tt_query[0][0], tt_query[0][1])
            if result and publish_path:
                corplib.mk_publish_links(path, publish_path, self.session_get(
                    'user', 'fullname'), description)
        elif len(tt_query) > 1 or within_cql or len(aligned_corpora) > 0:
            backend = settings.get('calc_backend', 'type')
            if backend in ('celery', 'konserver'):
                import bgcalc
                app = bgcalc.calc_backend_client(settings)
                res = app.send_task('worker.create_subcorpus',
                                    (self.session_get('user', 'id'), self.args.corpname, path, publish_path,
                                     tt_query, imp_cql, self.session_get('user', 'fullname'), description),
                                    time_limit=TASK_TIME_LIMIT)
                self._store_async_task(AsyncTaskStatus(status=res.status, ident=res.id,
                                                       category=AsyncTaskStatus.CATEGORY_SUBCORPUS,
                                                       label=u'%s:%s' % (basecorpname, subcname),
                                                       args=dict(subcname=subcname, corpname=basecorpname)))
                result = {}
            elif backend == 'multiprocessing':
                from bgcalc import subc_calc
                import functools
                import multiprocessing
                worker = subc_calc.CreateSubcorpusTask(user_id=self.session_get('user', 'id'),
                                                       corpus_id=self.args.corpname)
                multiprocessing.Process(target=functools.partial(
                    worker.run, tt_query, imp_cql, path, publish_path, description)).start()
                result = {}
        else:
            raise UserActionException(translate('Nothing specified!'))
        if result is not False:
            with plugins.runtime.SUBC_RESTORE as sr:
                try:
                    sr.store_query(user_id=self.session_get('user', 'id'),
                                   corpname=self.args.corpname,
                                   subcname=subcname,
                                   cql=full_cql.strip().split('[]', 1)[-1])
                except Exception as e:
                    logging.getLogger(__name__).warning('Failed to store subcorpus query: %s' % e)
                    self.add_system_message('warning',
                                            translate('Subcorpus created but there was a problem saving a backup copy.'))
            unfinished_corpora = filter(lambda at: not at.is_finished(),
                                        self.get_async_tasks(category=AsyncTaskStatus.CATEGORY_SUBCORPUS))
            return dict(processed_subc=[uc.to_dict() for uc in unfinished_corpora])
        else:
            raise SubcorpusError(translate('Empty subcorpus!'))

    @exposed(access_level=1, template='subcorpus/subcorp_form.tmpl', page_model='subcorpForm',
             http_method='POST', return_type='json')
    def subcorp(self, request):
        try:
            return self._create_subcorpus(request)
        except (SubcorpusError, RuntimeError) as e:
            raise UserActionException(e.message)

    @exposed(access_level=1, apply_semi_persist_args=True)
    def subcorp_form(self, request):
        """
        Displays a form to create a new subcorpus
        """
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS + (MainMenu.VIEW, )
        method = request.form.get('method', 'gui')
        subcname = request.form.get('subcname', None)
        subcnorm = request.args.get('subcnorm', 'tokens')

        try:
            tt_sel = get_tt(self.corp, self._plugin_api).export_with_norms(subcnorm=subcnorm)
        except UserActionException as e:
            tt_sel = {'Normslist': [], 'Blocks': []}
            self.add_system_message('warning', e)

        out = dict(SubcorpList=())
        self._attach_aligned_query_params(out)
        corpus_info = self.get_corpus_info(self.args.corpname)

        out.update(dict(
            Normslist=tt_sel['Normslist'],
            text_types_data=tt_sel,
            selected_text_types=TextTypeCollector(self.corp, request).get_attrmap(),
            method=method,
            subcnorm=subcnorm,
            id_attr=corpus_info.metadata.id_attr,
            subcname=subcname,
            aligned_corpora=request.form.getlist('aligned_corpora')
        ))
        return out

    @exposed(access_level=1, return_type='json', http_method='POST')
    def ajax_create_subcorpus(self, request):
        return self._create_subcorpus(request)

    def _create_full_subc_list(self, queries, subc_files):
        pass

    @exposed(access_level=1, http_method='POST', return_type='json')
    def delete(self, _):
        spath = self.corp.spath
        orig_spath = self.corp.orig_spath
        if orig_spath:
            try:
                os.unlink(orig_spath)
            except IOError as e:
                logging.getLogger(__name__).warning(e)
            pub_link = os.path.splitext(orig_spath)[0] + '.pub'
            if os.path.islink(pub_link):
                try:
                    os.unlink(pub_link)
                except IOError as e:
                    logging.getLogger(__name__).warning(e)
        elif not self.corp.is_published:
            try:
                os.unlink(spath)
            except IOError as e:
                logging.getLogger(__name__).warning(e)
        return {}

    @exposed(access_level=1, skip_corpus_init=True)
    def subcorp_list(self, request):
        """
        Displays a list of user subcorpora. In case there is a 'subc_restore' plug-in
        installed then the list is enriched by additional re-use/undelete information.
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)

        filter_args = dict(show_deleted=bool(int(request.args.get('show_deleted', 0))),
                           corpname=request.args.get('corpname'))
        data = []
        user_corpora = plugins.runtime.AUTH.instance.permitted_corpora(
            self.session_get('user')).keys()
        related_corpora = set()
        for corp in user_corpora:
            for item in self.cm.subcorp_names(corp):
                try:
                    sc = self.cm.get_Corpus(corp, subcname=item['n'], decode_desc=False)
                    data.append({
                        'name': '%s / %s' % (corp, item['n']),
                        'size': sc.search_size(),
                        'created': time.mktime(sc.created.timetuple()),
                        'corpname': corp,
                        'human_corpname': sc.get_conf('NAME'),
                        'usesubcorp': sc.subcname,
                        'orig_subcname': sc.orig_subcname,
                        'deleted': False,
                        'description': sc.description,
                        'published': corplib.subcorpus_is_published(sc.spath)
                    })
                    related_corpora.add(corp)
                except RuntimeError as e:
                    logging.getLogger(__name__).warn(
                        u'Failed to fetch information about subcorpus {0}:{1}: {2}'.format(corp, item['n'], e))

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

        sort = request.args.get('sort', '-created')
        sort_key, rev = self._parse_sorting_param(sort)
        if sort_key in ('size', 'created'):
            full_list = sorted(full_list, key=lambda x: x[sort_key], reverse=rev)
        else:
            full_list = l10n.sort(full_list, loc=self.ui_lang,
                                  key=lambda x: x[sort_key], reverse=rev)

        ans = dict(
            SubcorpList=[],   # this is used by subcorpus SELECT element; no need for that here
            subcorp_list=full_list,
            sort_key=dict(name=sort_key, reverse=rev),
            filter=filter_args,
            processed_subc=[v.to_dict() for v in self.get_async_tasks(
                category=AsyncTaskStatus.CATEGORY_SUBCORPUS)],
            related_corpora=sorted(related_corpora),
            uses_subc_restore=plugins.runtime.SUBC_RESTORE.exists
        )
        return ans

    @exposed(access_level=1, return_type='json')
    def ajax_subcorp_info(self, request):
        subcname = request.args.get('subcname', '')
        sc = self.cm.get_Corpus(self.args.corpname, subcname=subcname)
        ans = dict(
            corpusId=self.args.corpname,
            corpusName=self._human_readable_corpname(),
            subCorpusName=subcname,
            origSubCorpusName=sc.orig_subcname if sc.is_published else subcname,
            corpusSize=sc.size(),
            subCorpusSize=sc.search_size(),
            created=time.mktime(sc.created.timetuple()),
            description=sc.description,
            extended_info={}
        )
        if plugins.runtime.SUBC_RESTORE.exists:
            with plugins.runtime.SUBC_RESTORE as sr:
                tmp = sr.get_info(self.session_get('user', 'id'), self.args.corpname, subcname)
                if tmp:
                    ans['extended_info'].update(tmp)
        return ans

    @exposed(access_level=1, return_type='json', http_method='POST')
    def ajax_wipe_subcorpus(self, request):
        if plugins.runtime.SUBC_RESTORE.exists:
            corpus_id = request.form['corpname']
            subcorp_name = request.form['subcname']
            with plugins.runtime.SUBC_RESTORE as sr:
                sr.delete_query(self.session_get('user', 'id'), corpus_id, subcorp_name)
            self.add_system_message('info',
                                    translate('Subcorpus %s has been deleted permanently.') % subcorp_name)
        else:
            self.add_system_message('error', translate(
                'Unsupported operation (plug-in not present)'))
        return {}

    @exposed(access_level=1, return_type='json', http_method='POST')
    def publish_subcorpus(self, request):
        subcname = request.form['subcname']
        corpname = request.form['corpname']
        description = request.form['description']
        curr_subc = os.path.join(self.subcpath[0], corpname, subcname + '.subc')
        public_subc = self.prepare_subc_path(corpname, subcname, True)
        if os.path.isfile(curr_subc):
            corplib.mk_publish_links(curr_subc, public_subc,
                                     self.session_get('user', 'fullname'), description)
            return dict(code=os.path.splitext(os.path.basename(public_subc))[0])
        else:
            raise UserActionException('Subcorpus {0} not found'.format(subcname))

    @exposed(access_level=1, return_type='json', http_method='POST')
    def update_public_desc(self, request):
        if not self.corp.is_published:
            raise UserActionException('Corpus is not published - cannot change description')
        corplib.rewrite_subc_desc(self.corp.spath, request.form['description'])
        return {}

    @exposed(access_level=0, skip_corpus_init=True, page_model='pubSubcorpList')
    def list_published(self, request):
        min_author_prefix = 3
        min_code_prefix = 2
        query = request.args.get('query', '')
        search_type = request.args.get('search_type', '')
        offset = int(request.args.get('offset', '0'))
        limit = int(request.args.get('limit', '20'))
        if search_type == 'author' and len(query) >= min_author_prefix:
            subclist = corplib.list_public_subcorpora(self.subcpath[-1], author_prefix=query,
                                                      code_prefix=None, offset=offset, limit=limit)
        elif search_type == 'code' and len(query) >= min_code_prefix:
            subclist = corplib.list_public_subcorpora(self.subcpath[-1], author_prefix=None,
                                                      code_prefix=query, offset=offset, limit=limit)
        else:
            subclist = []
        return dict(data=subclist, min_author_prefix=min_author_prefix, min_code_prefix=min_code_prefix)
