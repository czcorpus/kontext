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

import logging
from typing import Any, List, Dict, Union

from dataclasses import dataclass
from action.errors import FunctionNotSupported, UserActionException
from bgcalc.task import AsyncTaskStatus
from action.model.corpus import CorpusActionModel
import plugins
import corplib
from texttypes.model import TextTypeCollector
import settings
import bgcalc


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


class SubcorpusActionModel(CorpusActionModel):

    TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)

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

    async def create_subcorpus(self) -> Dict[str, Any]:
        """
        req. arguments:
        subcname -- name of new subcorpus
        create -- bool, sets whether to create new subcorpus
        cql -- custom within condition
        """
        within_cql = None
        form_type = self._req.json['form_type']

        if form_type == 'tt-sel':
            data = CreateSubcorpusArgs(**self._req.json)
            corpus_info = await self.get_corpus_info(data.corpname)
            if (plugins.runtime.LIVE_ATTRIBUTES.exists
                    and await plugins.runtime.LIVE_ATTRIBUTES.instance.is_enabled_for(
                        self.plugin_ctx, [data.corpname])  # TODO here we skip aligned corpora which is debatable
                    and len(data.aligned_corpora) > 0):
                if corpus_info.metadata.label_attr and corpus_info.metadata.id_attr:
                    within_cql = None
                    sel_match = await plugins.runtime.LIVE_ATTRIBUTES.instance.get_attr_values(
                        self.plugin_ctx, corpus=self.corp,
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
            data = CreateSubcorpusWithinArgs(**self._req.json)
            tt_query = ()
            within_cql = self._deserialize_custom_within(data.within)
            full_cql = 'aword,[] %s' % within_cql
            imp_cql = (full_cql,)
        elif form_type == 'cql':
            data = CreateSubcorpusRawCQLArgs(**self._req.json)
            tt_query = ()
            within_cql = data.cql
            full_cql = f'aword,[] {data.cql}'
            imp_cql = (full_cql,)
        else:
            raise UserActionException(f'Invalid form type provided - "{form_type}"')

        if not data.subcname:
            raise UserActionException(self._req.translate('No subcorpus name specified!'))

        if data.publish and not data.description:
            raise UserActionException(self._req.translate('No description specified'))

        path = self.prepare_subc_path(self.args.corpname, data.subcname, publish=False)
        publish_path = self.prepare_subc_path(
            self.args.corpname, data.subcname, publish=True) if data.publish else None

        if len(tt_query) == 1 and not data.has_aligned_corpora():
            result = corplib.create_subcorpus(
                path, self.corp, tt_query[0][0], tt_query[0][1], translate=self._req.translate)
            if result and publish_path:
                await corplib.mk_publish_links(path, publish_path, self.session_get(
                    'user', 'fullname'), data.description)
        elif len(tt_query) > 1 or within_cql or data.has_aligned_corpora():
            worker = bgcalc.calc_backend_client(settings)
            res = await worker.send_task(
                'create_subcorpus', object.__class__,
                (self.session_get('user', 'id'), self.args.corpname, path, publish_path,
                    tt_query, imp_cql, self.session_get('user', 'fullname'), data.description),
                time_limit=self.TASK_TIME_LIMIT)
            self.store_async_task(AsyncTaskStatus(status=res.status, ident=res.id,
                                                  category=AsyncTaskStatus.CATEGORY_SUBCORPUS,
                                                  label=f'{self.args.corpname}/{data.subcname}',
                                                  args=dict(subcname=data.subcname,
                                                            corpname=self.args.corpname)))
            result = {}
        else:
            raise UserActionException(self._req.translate('Nothing specified!'))
        if result is not False:
            with plugins.runtime.SUBC_RESTORE as sr:
                try:
                    await sr.store_query(user_id=self.session_get('user', 'id'),
                                         corpname=self.args.corpname,
                                         subcname=data.subcname,
                                         cql=full_cql.strip().split('[]', 1)[-1])
                except Exception as e:
                    logging.getLogger(__name__).warning('Failed to store subcorpus query: %s' % e)
                    self.add_system_message('warning',
                                            self._req.translate('Subcorpus created but there was a problem saving a backup copy.'))
            unfinished_corpora = [at for at in self.get_async_tasks(
                category=AsyncTaskStatus.CATEGORY_SUBCORPUS) if not at.is_finished()]
            return dict(processed_subc=[uc.to_dict() for uc in unfinished_corpora])
        else:
            raise SubcorpusError(self._req.translate('Empty subcorpus!'))
