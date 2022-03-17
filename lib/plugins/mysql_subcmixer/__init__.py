# Copyright (c) 2022 Institute of the Czech National Corpus
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

from typing import Any, Dict, List, Tuple, Union
try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict
from collections import defaultdict
import json
import struct

from aiomysql import Connection, Cursor
from sanic.blueprints import Blueprint

import plugins
from plugins import inject
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.integration_db import IntegrationDatabase
from plugin_types.subcmixer import AbstractSubcMixer, ExpressionItem
from plugin_types.subcmixer.error import SubcMixerException, ResultNotFoundException
from action.plugin.ctx import PluginCtx
import corplib
from corplib.corpus import KCorpus
from action.model.corpus import CorpusActionModel
from action.decorators import http_action
from .category_tree import CategoryTree, CategoryExpression, TaskArgs
from .metadata_model import MetadataModel

"""
This module provides a mysql-based implementation for the subc-mixer plug-in. It requires mysql_integration_db.
To be able to use the plug-in, the following requirements must be met:

- enabled mysql_integration_db (i.e. the mysql_subcmixer does not provide its individual db connection)
- enabled mysql_live_attributes
- also, a corpus we want to used the plug-in with must have bib_id_struct, bib_id_attr configured 
"""

bp = Blueprint('mysql_subcmixer')


class RealSizes(TypedDict):
    attrs: List[Tuple[str, float]]
    total: int


class EmptyResponse(TypedDict):
    pass


class ProcessResponse(TypedDict):
    attrs: List[Tuple[str, float]]
    total: int
    ids: List[int]
    structs: List[str]


@bp.route('/subcmixer_run_calc',  methods=['POST'])
@http_action(return_type='json', access_level=1, action_model=CorpusActionModel)
async def subcmixer_run_calc(amodel, req, resp) -> Union[ProcessResponse, EmptyResponse]:
    try:
        with plugins.runtime.SUBCMIXER as sm:
            return await sm.process(
                plugin_ctx=amodel.plugin_ctx,
                corpus=amodel.corp,
                corpname=req.form.get('corpname'),
                aligned_corpora=req.form.getlist('aligned_corpora'),
                args=json.loads(req.form.get('expression'))
            )
    except ResultNotFoundException as err:
        amodel.add_system_message('error', str(err))
        return {}


@bp.route('/subcmixer_create_subcorpus', methods=['POST'])
@http_action(return_type='json', access_level=1, action_model=CorpusActionModel)
async def subcmixer_create_subcorpus(amodel, req, resp) -> Dict[str, Any]:
    """
    Create a subcorpus in a low-level way.
    The action writes a list of 64-bit signed integers
    to a file (just like Manatee does).
    The current version does not optimize the
    write by merging adjacent position intervals
    (Manatee does this).
    """
    if not req.form.get('subcname'):
        amodel.add_system_message('error', 'Missing subcorpus name')
        return {}
    else:
        publish = bool(int(req.form.get('publish')))
        subc_path = amodel.prepare_subc_path(
            req.form.get('corpname'), req.form.get('subcname'), publish=False)
        struct_indices = sorted([int(x) for x in req.form.get('ids').split(',')])
        id_attr = req.form.get('idAttr').split('.')
        attr = amodel.corp.get_struct(id_attr[0])
        with open(subc_path, 'wb') as fw:
            for idx in struct_indices:
                fw.write(struct.pack('<q', attr.beg(idx)))
                fw.write(struct.pack('<q', attr.end(idx)))

        pub_path = amodel.prepare_subc_path(
            req.form.get('corpname'), req.form.get('subcname'), publish=publish) if publish else None
        if pub_path:
            corplib.mk_publish_links(subc_path, pub_path, amodel.session_get('user', 'fullname'),
                                     req.form.get('description'))

        return dict(status=True)


class SubcMixer(AbstractSubcMixer[ProcessResponse]):

    CORPUS_MAX_SIZE = 500000000  # TODO

    def __init__(
            self, corparch: AbstractCorporaArchive, integration_db: IntegrationDatabase[Connection, Cursor]):
        self._corparch = corparch
        self._db = integration_db

    async def is_enabled_for(self, plugin_ctx: 'PluginCtx', corpora: List[str]) -> bool:
        if len(corpora) == 0:
            return False
        info = await self._corparch.get_corpus_info(plugin_ctx, corpora[0])
        return bool(info.metadata.id_attr)

    @staticmethod
    def _calculate_real_sizes(cat_tree: CategoryTree, sizes: List[int], total_size: int) -> RealSizes:
        return RealSizes(
            attrs=[
                (str(expression), sizes[i] / float(total_size))
                for i, expression in enumerate(item.expression for item in cat_tree.category_list if item.expression)
            ],
            total=total_size
        )

    @staticmethod
    def _import_task_args(args: List[ExpressionItem]) -> List[TaskArgs]:
        """
        generate IDs and parent IDs for
        passed conditions
        """
        ans: List[List[TaskArgs]] = [[TaskArgs(0, None, 1, None)]]  # root node
        grouped: Dict[str, List[ExpressionItem]] = defaultdict(lambda: [])
        for item in args:
            grouped[item['attrName']].append(item)

        counter = 1
        for attrName, expressions in grouped.items():
            tmp: List[TaskArgs] = []
            for parent in ans[-1]:
                for expr in expressions:
                    tmp.append(TaskArgs(
                        counter,
                        parent.node_id,
                        expr['ratio'] / 100.,
                        CategoryExpression(attrName, '==', expr['attrValue'])
                    ))
                    counter += 1
            ans.append(tmp)
        return [subitem for item in ans for subitem in item]

    async def process(
            self, plugin_ctx: PluginCtx, corpus: KCorpus, corpname: str, aligned_corpora: List[str],
            args: List[ExpressionItem]) -> ProcessResponse:

        used_structs = set(item['attrName'].split('.')[0] for item in args)
        if len(used_structs) > 1:
            raise SubcMixerException(
                'Subcorpora based on more than a single structure are not supported at the moment.')
        corpus_info = await self._corparch.get_corpus_info(plugin_ctx, corpname)
        conditions = self._import_task_args(args)

        cat_tree = CategoryTree(conditions, self._db, corpus_info.id,
                                aligned_corpora, SubcMixer.CORPUS_MAX_SIZE)
        mm = await MetadataModel.create(self._db, cat_tree, corpus_info.metadata.id_attr)
        corpus_items = mm.solve()

        if corpus_items.size_assembled > 0:
            doc_indices = [i for i, variable in enumerate(corpus_items.variables) if variable > 0]
            real_sizes = self._calculate_real_sizes(
                cat_tree, corpus_items.category_sizes, corpus_items.size_assembled)
            return ProcessResponse(
                ids=doc_indices,
                structs=list(used_structs),
                total=real_sizes['total'],
                attrs=real_sizes['attrs'],
            )

        else:
            raise ResultNotFoundException('ucnk_subcm__failed_to_find_suiteable_mix')

    @staticmethod
    def export_actions():
        return bp


@inject(plugins.runtime.CORPARCH, plugins.runtime.INTEGRATION_DB)
def create_instance(
        settings, corparch: AbstractCorporaArchive, integration_db: IntegrationDatabase[Connection, Cursor]):
    return SubcMixer(corparch, integration_db)
