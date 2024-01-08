# Copyright (c) 2015 Institute of the Czech National Corpus
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

import os
import struct
from collections import defaultdict
from typing import Any, Dict, List

import aiofiles
import plugins
import ujson as json
from action.control import http_action
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse
from corplib.abstract import create_new_subc_ident
from plugin_types.subcmixer import AbstractSubcMixer
from plugin_types.subcmixer.error import (
    ResultNotFoundException, SubcMixerException)
from plugins import inject
from sanic.blueprints import Blueprint
from util import AsyncBatchWriter

from .category_tree import CategoryExpression, CategoryTree
from .database import Database
from .metadata_model import MetadataModel

bp = Blueprint('default_subcmixer')


@bp.route('/subcmixer_run_calc', methods=['POST'])
@http_action(return_type='json', access_level=2, action_model=CorpusActionModel)
def subcmixer_run_calc(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    try:
        with plugins.runtime.SUBCMIXER as sm:
            return sm.process(plugin_ctx=amodel.plugin_ctx, corpus=amodel.corp,
                              corpname=req.form.get('corpname'),
                              aligned_corpora=req.form_getlist('aligned_corpora'),
                              args=json.loads(req.form.get('expression')))
    except ResultNotFoundException as err:
        resp.add_system_message('error', str(err))
        return {}


@bp.route('/subcmixer_create_subcorpus', methods=['POST'])
@http_action(return_type='json', access_level=2, action_model=CorpusActionModel)
async def subcmixer_create_subcorpus(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    """
    Create a subcorpus in a low-level way.
    The action writes a list of 64-bit signed integers
    to a file (just like Manatee does).
    The current version does not optimize the
    write by merging adjacent position intervals
    (Manatee does this).
    """
    if not req.form.get('subcname'):
        resp.add_system_message('error', 'Missing subcorpus name')
        return {}
    else:
        subc_id = await create_new_subc_ident(amodel.subcpath, amodel.corp.corpname)
        struct_indices = sorted([int(x) for x in req.form.get('ids').split(',')])
        id_attr = req.form.get('idAttr').split('.')
        attr = amodel.corp.get_struct(id_attr[0])
        async with aiofiles.open(os.path.join(amodel.subcpath, subc_id.data_path), 'wb') as fw, AsyncBatchWriter(fw, 100) as bw:
            for idx in struct_indices:
                await bw.write(struct.pack('<q', attr.beg(idx)))
                await bw.write(struct.pack('<q', attr.end(idx)))
        return dict(status=True)


class SubcMixer(AbstractSubcMixer[Dict[str, Any]]):

    CORPUS_MAX_SIZE = 500000000  # TODO

    def __init__(self, corparch):
        self._corparch = corparch

    async def is_enabled_for(self, plugin_ctx: 'PluginCtx', corpora: List[str]) -> bool:
        if len(corpora) == 0:
            return False
        info = await self._corparch.get_corpus_info(plugin_ctx, corpora[0])
        return bool(info.metadata.id_attr)

    @staticmethod
    def _calculate_real_sizes(cat_tree, sizes, total_size):
        expressions = [item[3] for item in cat_tree.category_list if item[3]]
        ans = dict(attrs=[], total=total_size)
        for i, expression in enumerate(expressions):
            ans['attrs'].append((str(expression), float(sizes[i]) / float(total_size),))
        return ans

    @staticmethod
    def _import_task_args(args):
        """
        generate IDs and parent IDs for
        passed conditions
        """
        ans = [[[0, None, 1, None]]]
        grouped = defaultdict(lambda: [])
        for item in args:
            grouped[item['attrName']].append(item)

        counter = 1
        for expressions in list(grouped.values()):
            tmp = []
            for pg in ans[-1]:
                for item in expressions:
                    tmp.append([
                        counter,
                        pg[0],
                        float(item['ratio']) / 100.,
                        CategoryExpression(item['attrName'], '==', item['attrValue'])])
                    counter += 1
            ans.append(tmp)
        ret = []
        for item in ans:
            for subitem in item:
                ret.append(subitem)
        return ret

    async def process(self, plugin_ctx, corpus, corpname, aligned_corpora, args):
        used_structs = set(item['attrName'].split('.')[0] for item in args)
        if len(used_structs) > 1:
            raise SubcMixerException(
                'Subcorpora based on more than a single structure are not supported at the moment.')
        corpus_info = await self._corparch.get_corpus_info(plugin_ctx, corpname)
        db = Database(db_path=corpus_info.metadata.database, table_name='item', corpus_id=corpus_info.id,
                      id_attr=corpus_info.metadata.id_attr, aligned_corpora=aligned_corpora)

        conditions = self._import_task_args(args)
        cat_tree = CategoryTree(conditions, db, 'item', SubcMixer.CORPUS_MAX_SIZE)
        mm = await MetadataModel.create(
            meta_db=db, category_tree=cat_tree, id_attr=corpus_info.metadata.id_attr.replace('.', '_'))
        corpus_items = mm.solve()

        if corpus_items.size_assembled > 0:
            ans = {}
            ans.update(self._calculate_real_sizes(
                cat_tree, corpus_items.category_sizes, corpus_items.size_assembled))
            doc_indices = [i for i, variable in enumerate(corpus_items.variables) if variable > 0]
            ans['ids'] = doc_indices,
            ans['structs'] = list(used_structs)
            return ans

        else:
            raise ResultNotFoundException('subcmixer__failed_to_find_suiteable_mix')

    @staticmethod
    def export_actions():
        return bp


@inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    return SubcMixer(corparch)
