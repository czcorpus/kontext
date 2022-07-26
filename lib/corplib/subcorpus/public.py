# Copyright (c) 2022 Charles University, Faculty of Arts,
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-13

import os
import glob
import logging
from typing import Optional, Tuple, List, Dict, Any
import ujson
import aiofiles

from . import k_markdown


class _PublishedSubcMetadata(object):
    """
    PublishedSubcMetadata is a helper class for storing published
    subcorpus information. It is used internally by the module.
    """

    def __init__(self, **kw):
        self.author_id: Optional[int] = kw.get('author_id', None)
        self.author_name: Optional[str] = kw.get('author_name', None)
        self.subcpath: Optional[str] = kw.get('subcpath', None)

    def to_json(self):
        return ujson.dumps(self.__dict__)

    @staticmethod
    def from_json(data):
        return _PublishedSubcMetadata(**ujson.loads(data))


async def _get_subcorp_pub_info(spath: str) -> Tuple[_PublishedSubcMetadata, Optional[str]]:
    """
    Obtain publishing information stored in a dedicated file.
    """
    desc = None
    namepath = os.path.splitext(spath)[0] + '.name'
    metadata = _PublishedSubcMetadata()

    if await aiofiles.os.path.isfile(namepath):
        async with aiofiles.open(namepath, 'r') as nf:
            desc = ''
            i = 0
            async for line in nf:
                if i == 0:
                    try:
                        metadata = _PublishedSubcMetadata.from_json(line)
                    except Exception as ex:
                        logging.getLogger(__name__).error(
                            f'Failed to read published subcorpus data. File {namepath}, error: {ex}')
                elif i > 1:
                    desc += line
                i += 1
    return metadata, desc


async def _list_public_corp_dir(corpname: str, path: str, value_prefix: Optional[str]) -> List[Dict[str, Any]]:
    ans: List[Dict[str, Any]] = []
    subc_root = os.path.dirname(os.path.dirname(path))
    for item in glob.glob(f'{path}/*.subc'):
        full_path = os.path.join(path, item)
        meta, desc = await _get_subcorp_pub_info(full_path)
        if meta.subcpath is None or meta.author_name is None or not desc:
            logging.getLogger(__name__).warning(
                f'Missing metainformation for published subcorpus {item}')
        else:
            try:
                ident = os.path.splitext(os.path.basename(item))[0]
                author_rev = ' '.join(reversed(meta.author_name.split(' '))
                                      ).lower() if meta.author_name else ''
                if ident.startswith(value_prefix) or author_rev.startswith(value_prefix.lower()):
                    ans.append(dict(
                        ident=ident,
                        origName=os.path.splitext(os.path.basename(meta.subcpath))[0],
                        corpname=corpname,
                        author=meta.author_name,
                        description=k_markdown(desc),
                        created=int(await aiofiles.os.path.getctime(full_path)),
                        userId=int(meta.subcpath.lstrip(subc_root).split(os.path.sep, 1)[0])
                    ))
            except Exception as ex:
                logging.getLogger(__name__).warning(f'Broken published subcorpus {full_path}: {ex}')
    return ans
