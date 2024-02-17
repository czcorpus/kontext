# Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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
from dataclasses import dataclass
from typing import List, Optional
from urllib.parse import urljoin

import plugins
import ujson as json
from action.argmapping.subcorpus import CreateSubcorpusArgs
from action.control import http_action
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse
from corplib.abstract import create_new_subc_ident
from dataclasses_json import LetterCase, dataclass_json
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.subcmixer import AbstractSubcMixer
from plugin_types.subcmixer.error import (
    ResultNotFoundException, SubcMixerException)
from sanic.blueprints import Blueprint
from util import AsyncBatchWriter

bp = Blueprint('masm_subcmixer', url_prefix='subcorpus')


@bp.route('/subcmixer_run_calc', methods=['POST'])
@http_action(return_type='json', access_level=2, action_model=CorpusActionModel)
def subcmixer_run_calc(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    try:
        with plugins.runtime.SUBCMIXER as sm:
            return sm.process(
                plugin_ctx=amodel.plugin_ctx, corpus=amodel.corp,
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
        struct_ids = [x for x in req.form.get('ids').split(',')]
        id_attr = req.form.get('idAttr')
        mstruct = amodel.corp.get_struct(id_attr.split('.')[0])
        attr = amodel.corp.get_attr(req.form.get('idAttr'))
        struct_idxs = sorted(attr.str2id(sid) for sid in struct_ids)

        subc_id = await create_new_subc_ident(amodel.subcpath, amodel.corp.corpname)
        async with AsyncBatchWriter(os.path.join(amodel.subcpath, subc_id.data_path), 'wb', 100) as bw:
            for idx in struct_idxs:
                await bw.write(struct.pack('<q', mstruct.beg(idx)))
                await bw.write(struct.pack('<q', mstruct.end(idx)))
        subc = await amodel.cf.get_corpus(subc_id)
        author = amodel.plugin_ctx.user_dict
        specification = CreateSubcorpusArgs(
            corpname=amodel.args.corpname,
            subcname=req.form.get('subcname'),
            description=req.form.get('description'),
            aligned_corpora=amodel.args.align,
            form_type='tt-sel',
            text_types={id_attr: struct_ids}
        )
        with plugins.runtime.SUBC_STORAGE as sr:
            await sr.create(
                ident=subc_id.id,
                author=author,
                size=subc.search_size,
                public_description=req.form.get('description'),
                data=specification)
        return dict(status=True)


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class CategorySize:
    total: int
    ratio: float
    expression: str


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class MasmResponse:
    doc_ids: List[str]
    size_assembled: int
    category_sizes: List[CategorySize]
    error: Optional[str] = None


async def proc_masm_response(resp) -> MasmResponse:
    data = await resp.json()
    if 400 <= resp.status <= 500:
        raise SubcMixerException(data.get('error', 'unspecified error'))
    return MasmResponse.from_dict(data)


class MasmSubcmixer(AbstractSubcMixer):

    def __init__(self, corparch: AbstractCorporaArchive, service_url: str):
        self._service_url = service_url
        self._corparch = corparch
        self._session = None

    async def is_enabled_for(self, plugin_ctx, corpora):
        if len(corpora) == 0:
            return False
        info = await self._corparch.get_corpus_info(plugin_ctx, corpora[0])
        return bool(info.metadata.id_attr)

    async def process(self, plugin_ctx, corpus, corpname, aligned_corpora, args):
        used_structs = set(item['attrName'].split('.')[0] for item in args)
        if len(used_structs) > 1:
            raise SubcMixerException(
                'Subcorpora based on more than a single structure are not supported at the moment.')
        async with plugin_ctx.request.ctx.http_client.post(
                urljoin(self._service_url, f'/liveAttributes/{corpname}/mixSubcorpus'),
                json={
                    'corpora': [corpname] + aligned_corpora,
                    'textTypes': args
                }) as resp:
            data = await proc_masm_response(resp)
        if data.error:
            raise SubcMixerException(data.error)
        if data.size_assembled > 0:
            return {
                'attrs':  [(cs.expression, cs.ratio) for cs in data.category_sizes],
                'ids': data.doc_ids,
                'structs': list(used_structs),
                'total': data.size_assembled
            }

        else:
            raise ResultNotFoundException('subcmixer__failed_to_find_suiteable_mix')

    @staticmethod
    def export_actions():
        return bp


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch: AbstractCorporaArchive) -> MasmSubcmixer:
    plg_conf = settings.get('plugins')['subcmixer']
    return MasmSubcmixer(corparch, plg_conf['service_url'])
