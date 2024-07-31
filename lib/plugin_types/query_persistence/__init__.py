# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

import abc
import logging
import re
from typing import (
    Any, Awaitable, Callable, Coroutine, Dict, List, Optional, Tuple, TypeVar,
    Union)

import settings
from action.argmapping.conc import decode_raw_query

if settings.get_bool('global', 'legacy_support', False):
    from legacy.concordance import upgrade_stored_record
else:
    from legacy.concordance import nop_upgrade_stored_record as upgrade_stored_record

from action.argmapping.conc.base import ConcFormArgs
from action.plugin.ctx import PluginCtx
from plugins.common.sqldb import DatabaseAdapter
from plugin_types.query_persistence.error import QueryPersistenceRecNotFound

ConcFormArgsFactory = Callable[
    #   plugin_ctx, corpora,   data,         op_key, author_id
    [PluginCtx, List[str], Dict[str, Any], str, int],
    Coroutine[Any, Any, ConcFormArgs]
]


class AbstractQueryPersistence(abc.ABC):
    """
    Custom query_persistence plug-in implementations should inherit from this class.

    Concordance persistence plug-in is expected to store current query and provide
    access to it via a string identifier.

    Please note that by 'query' we actually mean two representations:
    1) data entered by user via query form (query, additional options,
       checked checkboxes of text types,...)
    2) encoded version of (1) (controller's self.args.q attribute)

    The essential part is to store values from (2) but for a more convenient
    user experience (1) should be stored too as it allows easy restoring
    of a state of respective forms.
    """

    def __init__(self, settings):
        self._id_reserved_patterns = []
        plugin_conf = settings.get('plugins', 'query_persistence')
        path = plugin_conf.get('reserved_ids_path', '')
        if path:
            with open(path) as f:
                for line in f:
                    patt = line.strip()
                    if patt:
                        self._id_reserved_patterns.append(patt)

    @abc.abstractmethod
    def is_valid_id(self, data_id: str) -> bool:
        """
        Return True if data_id is a valid data identifier else False

        arguments:
        data_id -- identifier to be tested
        """

    @abc.abstractmethod
    def get_conc_ttl_days(self, user_id: int) -> int:
        """
        Returns how many days a concordance link persist for
        a specified user (typically it is a registered vs. public user).
        """

    @abc.abstractmethod
    async def open(self, data_id: str) -> Dict:
        """
        Load operation data according to the passed data_id argument.
        The data are assumed to be public (as are URL parameters of a query).

        arguments:
        data_id -- an unique ID of operation data

        returns:
        a dictionary containing operation data or None if nothing is found
        """

    @abc.abstractmethod
    async def store(self, user_id: int, curr_data: Dict, prev_data: Optional[Dict] = None) -> str:
        """
        Store a current operation (defined in curr_data) into the database. If also prev_date argument is
        provided then a comparison is performed and based on the result, new record is created and new
        ID is returned. In case there is no reason to store anything (e.g. curr and prev data are the same)
        it is valid to do nothing and return the previous operation ID.

        arguments:
        user_id -- database ID of the current user
        curr_data -- a dictionary containing operation data to be stored; currently at least 'q' entry must be present
        prev_data -- optional dictionary with previous operation data; again, 'q' entry must be there

        returns:
        new operation ID if a new record is created or current ID if no new operation is defined
        """

    @abc.abstractmethod
    async def update(self, data: Dict):
        """
        Update data stored in key-value database with id `data['id']`. If applicable,
        it should also try to update an archive item to prevent possible inconsistencies.
        """

    @abc.abstractmethod
    async def archive(self, conc_id: str, explicit: bool) -> Dict[str, Any]:
        """
        Make the concordance record persistent.

        Important requirements:

        1) It should be OK to call the function multiple times without any
        side effects.

        2) It is expected the concordance parameters are available via
        key-value (Redis) storage already (this should be ensured by KonText)

        arguments:
        conc_id -- an identifier of the concordance

        returns:
        archive data row
        """

    @staticmethod
    def stored_form_type(data: Dict[str, Any]) -> Union[None, str]:
        """
        Determine a form type of serialized query/filter/pquery/etc. from data
        """
        if data is None:
            return None
        if data.get('form', {}).get('form_type') == 'pquery':
            return 'pquery'
        elif 'lastop_form' in data:
            return data['lastop_form'].get('form_type')
        return None

    @staticmethod
    def stored_query_supertype(data: Dict[str, Any]) -> str:
        """
        Determine a query supertype of serialized conc/wlist/pquery from data
        """
        if data.get('form', {}).get('form_type') == 'pquery':
            return 'pquery'
        elif data.get('form', {}).get('form_type') == 'wlist':
            return 'wlist'
        elif data.get('form', {}).get('form_type') == 'kwords':
            return 'kwords'
        elif 'lastop_form' in data:
            form_type = data['lastop_form'].get('form_type')
            if form_type in ('query', 'filter', 'sort', 'sample', 'shuffle', 'switchmc', 'lgroup', 'locked', 'subhits', 'firsthits'):
                return 'conc'

            raise ValueError(f'Cannot determine query supertype from type {form_type}')
        raise ValueError(f'Cannot determine query supertype from data {data}')

    @abc.abstractmethod
    async def clone_with_id(self, old_id: str, new_id: str):
        """
        Duplicate entry with new id
        """

    @abc.abstractmethod
    async def id_exists(self, id: str) -> bool:
        """
        Check if ID already exists
        """

    MapRes = TypeVar('MapRes')

    async def _fix_forms(
            self,
            plugin_ctx: PluginCtx,
            last_data: Dict[str, Any],
            ans: List[Dict[str, Any]],
            fn: Callable[[str, Dict], Awaitable[MapRes]]):
        """
        generate missing operations chain and store in db
        """
        op_forms = await decode_raw_query(plugin_ctx, last_data['corpora'], last_data['q'][:-1])
        last_new_entry = None
        for i, (q, form) in enumerate(op_forms):
            new_entry = {
                'q': [q] if last_new_entry is None else [*last_new_entry['q'], q],
                'corpora': last_data['corpora'],
                'usesubcorp': last_data['usesubcorp'],
                'lines_groups': last_data['lines_groups'],
                'lastop_form': form.to_dict(),
            }
            await self.store(last_data['user_id'], new_entry, last_new_entry)
            ans.insert(i, await fn(new_entry['id'], new_entry))
            last_new_entry = new_entry

        # update last_data to connect the chain
        last_data['prev_id'] = last_new_entry['id']
        await self.update(last_data)
        logging.getLogger(__name__).info(f"Query persistence chain reconstruction result: {ans}")

    async def map_pipeline_ops(
            self,
            plugin_ctx: PluginCtx,
            last_id: str,
            fn: Callable[[str, Dict], Awaitable[MapRes]]) -> List[MapRes]:
        """
        Go back to the first operation of a query chain starting from 'last_id' and apply
        a provided map function to the value
        """
        ans = []
        data = await self.open(last_id)
        if data is None:
            raise QueryPersistenceRecNotFound(f'no data found for query "{last_id}"')

        else:
            ans.append(await fn(data['id'], data))

        limit = 100
        prev_id = data.get('prev_id')
        while data is not None and prev_id is not None and limit > 0:
            last_data = data
            data = await self.open(prev_id)
            if data is None:
                if limit <= len(last_data['q'][:-1]):
                    limit = 0
                    break
                logging.getLogger(__name__).error(
                    f'Query persistence data {prev_id} not found, attempting reconstruction from CQL')
                await self._fix_forms(plugin_ctx, last_data, ans, fn)
            else:
                ans.insert(0, await fn(data['id'], data))
                prev_id = data.get('prev_id')
            limit -= 1

        if limit == 0:
            logging.getLogger(__name__).warning(
                'Reached hard limit when loading query pipeline {0}'.format(last_id))
        return ans

    async def load_pipeline_ops(
            self, plugin_ctx: PluginCtx, last_id: str,
            conc_form_args_factory: ConcFormArgsFactory) -> List[ConcFormArgs]:
        """
        Load all the operations which make up the current concordance
        (identified by 'last_id' argument) and restore the data into
        respective classes (using provided 'conc_form_args_factory').

        Please note that the 'last_id' must match with the currently used
        corpus - so it is not possible to load an operation pipeline
        form a corpus Foo while using corpus Bar.
        """
        async def map_fn(op_id: str, data: Dict) -> ConcFormArgs:
            form_data = upgrade_stored_record(data.get('lastop_form', {}), attr_list)
            author_id = data.get('user_id')
            return await conc_form_args_factory(plugin_ctx, data.get('corpora', []), form_data, op_id, author_id)

        attr_list = plugin_ctx.current_corpus.get_posattrs()
        ans = await self.map_pipeline_ops(plugin_ctx, last_id, map_fn)
        logging.getLogger(__name__).debug('load pipeline ops: {}'.format(ans))
        return ans

    async def id_reserved(self, id: str) -> bool:
        """
        Compare id with blacklist, used to limit user query id
        """
        for pattern in self._id_reserved_patterns:
            if re.match(pattern, id):
                return True
        return False
