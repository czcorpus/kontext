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
import time
import hashlib
from typing import Any, List, Dict, Union

from werkzeug.wrappers import Request

from dataclasses import dataclass
from controller import exposed
from action.errors import FunctionNotSupported, UserActionException
from bgcalc.task import AsyncTaskStatus
from controller.querying import Querying
from corplib.corpus import list_public_subcorpora
from main_menu.model import MainMenu
from translation import ugettext as translate
import plugins
import l10n
import corplib
from texttypes.model import TextTypeCollector
import settings
import bgcalc
from action.argmapping import log_mapping

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


class SubcorpusError(Exception):
    pass


@dataclass
class SubmitBase:
    corpname: str
    subcname: str
    publish: bool
    description: str
    aligned_corpora: List[str]
    form_type: str

    def has_aligned_corpora(self):
        return len(self.aligned_corpora) > 0 if type(self.aligned_corpora) is list else False


@dataclass
class CreateSubcorpusArgs(SubmitBase):
    text_types: Dict[str, Union[List[str], List[int]]]


@dataclass
class CreateSubcorpusWithinArgs(SubmitBase):
    within: List[Dict[str, Union[str, bool]]]  # negated, structure_name, attribute_cql


@dataclass
class CreateSubcorpusRawCQLArgs(SubmitBase):
    cql: str


class Subcorpus(Querying):

    def get_mapping_url_prefix(self):
        return '/subcorpus/'

    def prepare_subc_path(self, corpname: str, subcname: str, publish: bool) -> str:
        if publish:
            code = hashlib.md5('{0} {1} {2}'.format(self.session_get(
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

    def _deserialize_custom_within(self, data: Dict[str, Any]) -> str:
        """
         return this.lines.filter((v)=>v != null).map(
            (v:WithinLine) => (
                (v.negated ? '!within' : 'within') + ' <' + v.structureName
                    + ' ' + v.attributeCql + ' />')
        ).join(' ');
        }
        """
        return ' '.join([('!within' if item['negated'] else 'within') + ' <%s %s />' % (
            item['structure_name'], item['attribute_cql']) for item in [item for item in data if bool(item)]])

    async def _create_subcorpus(self, request: Request) -> Dict[str, Any]:
        """
        req. arguments:
        subcname -- name of new subcorpus
        create -- bool, sets whether to create new subcorpus
        cql -- custom within condition
        """
        within_cql = None
        form_type = request.json['form_type']

        if form_type == 'tt-sel':
            data = CreateSubcorpusArgs(**request.json)
            corpus_info = self.get_corpus_info(data.corpname)
            if (plugins.runtime.LIVE_ATTRIBUTES.exists
                    and plugins.runtime.LIVE_ATTRIBUTES.instance.is_enabled_for(
                        self._plugin_ctx, [data.corpname])  # TODO here we skip aligned corpora which is debatable
                    and len(data.aligned_corpora) > 0):
                if corpus_info.metadata.label_attr and corpus_info.metadata.id_attr:
                    within_cql = None
                    sel_match = plugins.runtime.LIVE_ATTRIBUTES.instance.get_attr_values(
                        self._plugin_ctx, corpus=self.corp,
                        attr_map=data.text_types,
                        aligned_corpora=data.aligned_corpora,
                        limit_lists=False)
                    sel_attrs = {}
                    for k, vals in sel_match.attr_values.items():
                        if k == corpus_info.metadata.label_attr:
                            k = corpus_info.metadata.id_attr
                        if '.' in k:
                            sel_attrs[k] = [v[1] for v in vals]
                    tt_query = TextTypeCollector(self.corp, sel_attrs).get_query()
                    tmp = ['<%s %s />' % item for item in tt_query]
                    full_cql = ' within '.join(tmp)
                    full_cql = 'aword,[] within %s' % full_cql
                    imp_cql = (full_cql,)
                else:
                    raise FunctionNotSupported(
                        'Corpus must have a bibliography item defined to support this function')
            else:
                tt_query = TextTypeCollector(self.corp, data.text_types).get_query()
                tmp = ['<%s %s />' % item for item in tt_query]
                full_cql = ' within '.join(tmp)
                full_cql = 'aword,[] within %s' % full_cql
                imp_cql = (full_cql,)
        elif form_type == 'within':
            data = CreateSubcorpusWithinArgs(**request.json)
            tt_query = ()
            within_cql = self._deserialize_custom_within(data.within)
            full_cql = 'aword,[] %s' % within_cql
            imp_cql = (full_cql,)
        elif form_type == 'cql':
            data = CreateSubcorpusRawCQLArgs(**request.json)
            tt_query = ()
            within_cql = data.cql
            full_cql = f'aword,[] {data.cql}'
            imp_cql = (full_cql,)
        else:
            raise UserActionException(f'Invalid form type provided - "{form_type}"')

        if not data.subcname:
            raise UserActionException(translate('No subcorpus name specified!'))

        if data.publish and not data.description:
            raise UserActionException(translate('No description specified'))

        path = self.prepare_subc_path(self.args.corpname, data.subcname, publish=False)
        publish_path = self.prepare_subc_path(
            self.args.corpname, data.subcname, publish=True) if data.publish else None

        if len(tt_query) == 1 and not data.has_aligned_corpora():
            result = corplib.create_subcorpus(path, self.corp, tt_query[0][0], tt_query[0][1])
            if result and publish_path:
                corplib.mk_publish_links(path, publish_path, self.session_get(
                    'user', 'fullname'), data.description)
        elif len(tt_query) > 1 or within_cql or data.has_aligned_corpora():
            worker = bgcalc.calc_backend_client(settings)
            res = await worker.send_task(
                'create_subcorpus', object.__class__,
                (self.session_get('user', 'id'), self.args.corpname, path, publish_path,
                    tt_query, imp_cql, self.session_get('user', 'fullname'), data.description),
                time_limit=TASK_TIME_LIMIT)
            self._store_async_task(AsyncTaskStatus(status=res.status, ident=res.id,
                                                   category=AsyncTaskStatus.CATEGORY_SUBCORPUS,
                                                   label=f'{self.args.corpname}/{data.subcname}',
                                                   args=dict(subcname=data.subcname,
                                                             corpname=self.args.corpname)))
            result = {}
        else:
            raise UserActionException(translate('Nothing specified!'))
        if result is not False:
            with plugins.runtime.SUBC_RESTORE as sr:
                try:
                    sr.store_query(user_id=self.session_get('user', 'id'),
                                   corpname=self.args.corpname,
                                   subcname=data.subcname,
                                   cql=full_cql.strip().split('[]', 1)[-1])
                except Exception as e:
                    logging.getLogger(__name__).warning('Failed to store subcorpus query: %s' % e)
                    self.add_system_message('warning',
                                            translate('Subcorpus created but there was a problem saving a backup copy.'))
            unfinished_corpora = [at for at in self.get_async_tasks(
                category=AsyncTaskStatus.CATEGORY_SUBCORPUS) if not at.is_finished()]
            return dict(processed_subc=[uc.to_dict() for uc in unfinished_corpora])
        else:
            raise SubcorpusError(translate('Empty subcorpus!'))

    @exposed(access_level=1, template='subcorpus/subcorp_form.html', page_model='subcorpForm',
             http_method='POST', return_type='json', action_log_mapper=log_mapping.new_subcorpus)
    def create(self, request: Request) -> Dict[str, Any]:
        try:
            return self._create_subcorpus(request)
        except (SubcorpusError, RuntimeError) as e:
            raise UserActionException(str(e)) from e

    @exposed(access_level=1, apply_semi_persist_args=True, page_model='subcorpForm')
    async def new(self, request: Request) -> Dict[str, Any]:
        """
        Displays a form to create a new subcorpus
        """
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS + (MainMenu.VIEW, )
        method = request.form.get('method', 'gui')
        subcname = request.form.get('subcname', None)
        subcnorm = request.args.get('subcnorm', 'tokens')

        try:
            tt_sel = await self.tt.export_with_norms(subcnorm=subcnorm)
        except UserActionException as e:
            tt_sel = {'Normslist': [], 'Blocks': []}
            self.add_system_message('warning', e)

        out = dict(SubcorpList=())
        await self._attach_aligned_query_params(out)
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
    def ajax_create_subcorpus(self, request: Request) -> Dict[str, Any]:
        return self._create_subcorpus(request)

    def _create_full_subc_list(self, queries, subc_files):
        pass

    @exposed(access_level=1, http_method='POST', return_type='json')
    def delete(self, _) -> Dict[str, Any]:
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

    @exposed(access_level=1, skip_corpus_init=True, page_model='subcorpList')
    def list(self, request: Request) -> Dict[str, Any]:
        """
        Displays a list of user subcorpora. In case there is a 'subc_restore' plug-in
        installed then the list is enriched by additional re-use/undelete information.
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)

        filter_args = dict(show_deleted=bool(int(request.args.get('show_deleted', 0))),
                           corpname=request.args.get('corpname'))
        data = []
        user_corpora = list(plugins.runtime.AUTH.instance.permitted_corpora(
            self.session_get('user')))
        related_corpora = set()
        for corp in user_corpora:
            for item in self.user_subc_names(corp):
                try:
                    sc = self.cm.get_corpus(corp, subcname=item['n'], decode_desc=False)
                    data.append({
                        'name': '%s / %s' % (corp, item['n']),
                        'size': sc.search_size,
                        'created': time.mktime(sc.created.timetuple()),
                        'corpname': corp,
                        'human_corpname': sc.get_conf('NAME'),
                        'usesubcorp': sc.subcname,
                        'orig_subcname': sc.orig_subcname,
                        'deleted': False,
                        'description': sc.description,
                        'published': sc.is_published
                    })
                    related_corpora.add(corp)
                except RuntimeError as e:
                    logging.getLogger(__name__).warning(
                        'Failed to fetch information about subcorpus {0}:{1}: {2}'.format(corp, item['n'], e))

        if filter_args['corpname']:
            data = [item for item in data if not filter_args['corpname']
                    or item['corpname'] == filter_args['corpname']]
        elif filter_args['corpname'] is None:
            filter_args['corpname'] = ''  # JS code requires non-null value

        if plugins.runtime.SUBC_RESTORE.exists:
            with plugins.runtime.SUBC_RESTORE as sr:
                try:
                    full_list = sr.extend_subc_list(self._plugin_ctx, data, filter_args, 0)
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
            processed_subc=[
                v.to_dict()
                for v in self.get_async_tasks(category=AsyncTaskStatus.CATEGORY_SUBCORPUS)
            ],
            related_corpora=sorted(related_corpora),
            uses_subc_restore=plugins.runtime.SUBC_RESTORE.exists
        )
        return ans

    @exposed(access_level=1, return_type='json')
    def subcorpus_info(self, _) -> Dict[str, Any]:
        if not self.corp.is_subcorpus:
            raise UserActionException('Not a subcorpus')
        ans = dict(
            corpusId=self.corp.corpname,
            corpusName=self._human_readable_corpname(),
            subCorpusName=self.corp.subcname,
            origSubCorpusName=self.corp.orig_subcname,
            corpusSize=self.corp.size,
            subCorpusSize=self.corp.search_size,
            created=time.mktime(self.corp.created.timetuple()),
            description=self.corp.description,
            published=self.corp.is_published,
            extended_info={}
        )

        if plugins.runtime.SUBC_RESTORE.exists:
            with plugins.runtime.SUBC_RESTORE as sr:
                tmp = sr.get_info(self.session_get('user', 'id'),
                                  self.args.corpname, self.corp.subcname)
                if tmp:
                    ans['extended_info'].update(tmp.to_dict())
        return ans

    @exposed(access_level=1, return_type='json', http_method='POST')
    def ajax_wipe_subcorpus(self, request: Request) -> Dict[str, Any]:
        if plugins.runtime.SUBC_RESTORE.exists:
            corpus_id = request.form.get('corpname')
            subcorp_name = request.form.get('subcname')
            with plugins.runtime.SUBC_RESTORE as sr:
                sr.delete_query(self.session_get('user', 'id'), corpus_id, subcorp_name)
            self.add_system_message('info',
                                    translate('Subcorpus %s has been deleted permanently.') % subcorp_name)
        else:
            self.add_system_message('error', translate(
                'Unsupported operation (plug-in not present)'))
        return {}

    @exposed(access_level=1, return_type='json', http_method='POST')
    def publish_subcorpus(self, request: Request) -> Dict[str, Any]:
        subcname = request.form.get('subcname')
        corpname = request.form.get('corpname')
        description = request.form.get('description')
        curr_subc = os.path.join(self.subcpath[0], corpname, subcname + '.subc')
        public_subc = self.prepare_subc_path(corpname, subcname, True)
        if os.path.isfile(curr_subc):
            corplib.mk_publish_links(curr_subc, public_subc,
                                     self.session_get('user', 'fullname'), description)
            return dict(code=os.path.splitext(os.path.basename(public_subc))[0])
        else:
            raise UserActionException('Subcorpus {0} not found'.format(subcname))

    @exposed(access_level=1, return_type='json', http_method='POST')
    def update_public_desc(self, request: Request) -> Dict[str, Any]:
        if not self.corp.is_published:
            raise UserActionException('Corpus is not published - cannot change description')
        self.corp.save_subc_description(request.form.get('description'))
        return {}

    @exposed(access_level=0, skip_corpus_init=True, page_model='pubSubcorpList')
    def list_published(self, request: Request) -> Dict[str, Any]:
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)

        min_query_size = 3
        query = request.args.get('query', '')
        offset = int(request.args.get('offset', '0'))
        limit = int(request.args.get('limit', '20'))
        if len(query) >= min_query_size:
            subclist = list_public_subcorpora(self.subcpath[-1], value_prefix=query,
                                              offset=offset, limit=limit)
        else:
            subclist = []
        return dict(data=subclist, min_query_size=min_query_size)
