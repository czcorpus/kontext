# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import glob
import logging
import os
import datetime
from datetime import datetime
from hashlib import md5
from typing import Any, Awaitable, Dict, List, Optional, Tuple, Union

import aiofiles
import aiofiles.os
import ujson as json
from corplib.abstract import AbstractKCorpus
from corplib.subcorpus import SubcorpusRecord
from manatee import Corpus, SubCorpus

try:
    from markdown import markdown
    from markdown.extensions import Extension

    class EscapeHtml(Extension):
        def extendMarkdown(self, md, md_globals):
            del md.preprocessors['html_block']
            del md.inlinePatterns['html']

    def k_markdown(s): return markdown(s, extensions=[EscapeHtml()])

except ImportError:
    import html

    def k_markdown(s): return html.escape(s)


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
        return json.dumps(self.__dict__)

    @staticmethod
    def from_json(data):
        return _PublishedSubcMetadata(**json.loads(data))


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


async def list_public_subcorpora(subcpath: str, value_prefix: Optional[str] = None,
                                 offset: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
    """
    List subcorpora stored in a provided subcpath (typically a path dedicated to a specific user)
    """
    data: List[Dict[str, Any]] = []
    for corp in os.listdir(subcpath):
        try:
            data += await _list_public_corp_dir(corp, os.path.join(subcpath, corp), value_prefix)
            if len(data) >= offset + limit:
                break
        except Exception as ex:
            logging.getLogger(__name__).warning(ex)
    return data[offset:limit]


class KCorpus(AbstractKCorpus):
    """
    KCorpus is an abstraction of a corpus/subcorpus used by KonText.

    Due to incomplete abstraction of other involved functions (e.g. creating
    of a concordance), sometimes when the actual internal Corpus instance
    is needed the unwrap() function can be used.
    """

    _corpname: str
    _corp: Union[Corpus, SubCorpus]

    def __init__(self, corp: Union[Corpus, SubCorpus], corpname: str):
        self._corp = corp
        self._corpname = corpname

    def __str__(self):
        return f'KCorpus(ident={self.corpname})'

    @property
    def corp(self):
        return self._corp

    @property
    def corpname(self):
        """
        Return corpus short name (sometimes referred as ID).
        It is basically a name of the configuration "registry" file.
        """
        return self._corpname

    @property
    def human_readable_corpname(self):
        """
        Returns an user-readable name of the current corpus (i.e. it cannot be used
        to identify the corpus in KonText's code as it is only intended to be printed
        somewhere on a page).
        """
        if self.corp.get_conf('NAME'):
            return self.corp.get_conf('NAME')
        return self.corp.get_conffile()

    @property
    def portable_ident(self) -> Union[str, SubcorpusRecord]:
        return self.corpname

    @property
    def cache_key(self):
        """
        Return a cache key for storing concordances (please
        note that the final cache entry key contains also
        a query part)
        """
        return self._corpname

    @property
    def created(self):
        return None

    @property
    def author(self):
        return None

    @property
    def author_id(self):
        return None

    @property
    def description(self):
        return None

    def get_conf(self, key: str) -> Any:
        """
        Get corpus configuration entry from its configuration registry file
        """
        return self._corp.get_conf(key)

    def get_confpath(self):
        return self._corp.get_confpath()

    def get_conffile(self):
        return self._corp.get_conffile()

    def set_default_attr(self, attr: str):
        return self._corp.set_default_attr(attr)

    @property
    def size(self) -> int:
        """
        Return size of the whole corpus
        (even for a subcorpus). For actual
        search size, use search_size().
        """
        return self._corp.size()

    @property
    def search_size(self) -> int:
        return self._corp.search_size()

    def get_struct(self, struct: str):
        return self._corp.get_struct(struct)

    def get_attr(self, attr: str):
        return self._corp.get_attr(attr)

    def get_info(self):
        return self._corp.get_info()

    def unwrap(self) -> Corpus:
        return self._corp

    def freq_dist(self, rs, crit, limit, words, freqs, norms):
        return self._corp.freq_dist(rs, crit, limit, words, freqs, norms)

    def filter_query(self, attr: str):
        return self._corp.filter_query(attr)

    def compile_frq(self, attr):
        return self._corp.compile_frq(attr)

    def compile_arf(self, attr):
        return self._corp.compile_arf(attr)

    def compile_docf(self, attr, doc_attr):
        return self._corp.compile_docf(attr, doc_attr)

    @property
    def subcorpus_id(self):
        return None

    @property
    def subcorpus_name(self):
        return None

    def freq_precalc_file(self, attrname: str) -> str:
        return self._corp.get_conf('PATH') + attrname

    @property
    def corp_mtime(self) -> Awaitable[float]:
        async def awaitable():
            reg_mtime = await aiofiles.os.path.getmtime(self._corp.get_confpath())
            data_path = self._corp.get_conf('PATH')
            data_dir = os.path.dirname(data_path) if data_path.endswith('/') else data_path
            data_mtime = await aiofiles.os.path.getmtime(data_dir)
            return max(reg_mtime, data_mtime)
        return awaitable()

    def get_posattrs(self) -> List[str]:
        items = self._corp.get_conf('ATTRLIST')
        return items.split(',') if items else []

    def get_structattrs(self) -> List[str]:
        items = self._corp.get_conf('STRUCTATTRLIST')
        return items.split(',') if items else []

    def get_structs(self) -> List[str]:
        items = self._corp.get_conf('STRUCTLIST')
        return items.split(',') if items else []


class KSubcorpus(KCorpus):
    """
    KSubcorpus is an abstraction of a subcorpus used by KonText.

    Please note that properties like 'author', 'author_id',
    'description' refer here to the author of the subcorpus.
    To obtain the original author of the main corpus, new properties
    are available in KSubcorpus - orig_author, orig_author_id,
    orig_description.
    """

    def __init__(self, corp: SubCorpus, data_record: SubcorpusRecord):
        super().__init__(corp, data_record.corpname)
        self._corpname = data_record.corpname
        self._data_record = data_record

    def __str__(self):
        return f'KSubcorpus(ident={self.corpname}, subcname={self.subcname})'

    @staticmethod
    async def load(corp: Corpus, data_record: SubcorpusRecord, decode_desc: bool) -> 'KSubcorpus':
        """
        load is a recommended factory function to create a KSubcorpus instance.
        """
        subc = SubCorpus(corp, data_record.data_path)
        kcorp = KSubcorpus(subc, corpname=data_record.corpname)
        kcorp._corp = subc
        return kcorp

    @property
    def portable_ident(self) -> Union[str, SubcorpusRecord]:
        return self._data_record

    @property
    def subcorpus_id(self):
        return self._data_record.id

    @property
    def subcorpus_name(self):
        return self._data_record.name

    @property
    def cache_key(self):
        """
        Return a hashed version of subc. name used mainly
        for caching purposes.
        In case of a regular corpus, the value is None
        """
        return f'{self._corpname}/{self._data_record.id}'

    @property
    def source_description(self):
        """
        Return a description of the source corpus this subc. is derived from
        """
        return self._data_record.description

    def freq_precalc_file(self, attrname: str) -> str:
        return self.spath[:-4] + attrname
