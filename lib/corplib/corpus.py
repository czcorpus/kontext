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

from manatee import Corpus, SubCorpus
from typing import Union, Optional, Tuple, List, Dict, Any
from hashlib import md5
from datetime import datetime
import os
import glob
import json
import logging

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


def _get_subcorp_pub_info(spath: str) -> Tuple[_PublishedSubcMetadata, Optional[str]]:
    """
    Obtain publishing information stored in a dedicated file.
    """
    desc = None
    namepath = os.path.splitext(spath)[0] + '.name'
    metadata = _PublishedSubcMetadata()

    if os.path.isfile(namepath):
        with open(namepath, 'r') as nf:
            desc = ''
            for i, line in enumerate(nf):
                if i == 0:
                    try:
                        metadata = _PublishedSubcMetadata.from_json(line)
                    except Exception as ex:
                        logging.getLogger(__name__).error(
                            f'Failed to read published subcorpus data. File {namepath}, error: {ex}')
                elif i > 1:
                    desc += line
    return metadata, desc


def _list_public_corp_dir(corpname: str, path: str, value_prefix: Optional[str]) -> List[Dict[str, Any]]:
    ans: List[Dict[str, Any]] = []
    subc_root = os.path.dirname(os.path.dirname(path))
    for item in glob.glob(f'{path}/*.subc'):
        full_path = os.path.join(path, item)
        meta, desc = _get_subcorp_pub_info(full_path)
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
                        created=int(os.path.getctime(full_path)),
                        userId=int(meta.subcpath.lstrip(subc_root).split(os.path.sep, 1)[0])
                    ))
            except Exception as ex:
                logging.getLogger(__name__).warning(f'Broken published subcorpus {full_path}: {ex}')
    return ans


def list_public_subcorpora(subcpath: str, value_prefix: Optional[str] = None,
                           offset: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
    """
    List subcorpora stored in a provided subcpath (typically a path dedicated to a specific user)
    """
    data: List[Dict[str, Any]] = []
    for corp in os.listdir(subcpath):
        try:
            data += _list_public_corp_dir(corp, os.path.join(subcpath, corp), value_prefix)
            if len(data) >= offset + limit:
                break
        except Exception as ex:
            logging.getLogger(__name__).warning(ex)
    return data[offset:limit]


class KCorpus:
    """
    KCorpus is an abstraction of a corpus/subcorpus used by KonText.

    Due to incomplete abstraction of other involved functions (e.g. creating
    of a concordance), sometimes when the actual internal Corpus instance
    is needed the unwrap() function can be used.
    """

    _corpname: str
    _corp: Union[Corpus, SubCorpus]
    _spath: Union[str, None] = None
    _subcname: Union[str, None] = None
    _subchash: Union[str, None] = None
    _created: Union[str, None] = None
    _is_published: bool = False
    _orig_spath: Union[str, None] = None
    _orig_subcname: Union[str, None] = None
    _author: Union[str, None] = None
    _author_id: Union[int, None] = None
    _description: Union[str, None] = None

    def __init__(self, corp: Union[Corpus, SubCorpus], corpname: str):
        self._corp = corp
        self._corpname = corpname

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
    def spath(self):
        """
        Return a path of subcorpus data file.
        In case of a regular corpus, the value is None
        """
        return self._spath

    @property
    def subcname(self):
        """
        Return a private name of subcorpus.
        In case of a regular corpus, the value is None
        """
        return self._subcname

    @property
    def subchash(self):
        """
        Return a hashed version of subc. name used mainly
        for caching purposes.
        In case of a regular corpus, the value is None
        """
        return self._subchash

    @property
    def created(self):
        return self._created

    @property
    def is_published(self):
        return self._is_published

    @property
    def orig_spath(self):
        return self._orig_spath

    @property
    def orig_subcname(self):
        return self._orig_subcname if self.is_published else self.subcname

    @property
    def author(self):
        return self._author

    @property
    def author_id(self):
        return self._author_id

    @property
    def description(self):
        return self._description

    def get_conf(self, key):
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
    def size(self):
        """
        Return size of the whole corpus
        (even for a subcorpus). For actual
        search size, use search_size().
        """
        return self._corp.size()

    @property
    def search_size(self):
        """
        Return actual size we search in. This applies
        mainly for sub-corpora where it equals to
        a respective subcorpus size while 'size' returns
        the original corpus size.
        """
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

    @property
    def is_subcorpus(self):
        return False

    def save_subc_description(self, desc: str):
        meta, _ = _get_subcorp_pub_info(self._spath)
        with open(os.path.splitext(self._spath)[0] + '.name', 'wb') as fw:
            fw.write(meta.to_json().encode('utf-8') + '\n\n')
            fw.write(desc.encode('utf-8'))

    def freq_precalc_file(self, attrname: str) -> str:
        return self._corp.get_conf('PATH') + attrname

    @property
    def corp_mtime(self) -> float:
        reg_mtime = os.path.getmtime(self._corp.get_confpath())
        data_path = self._corp.get_conf('PATH')
        data_dir = os.path.dirname(data_path) if data_path.endswith('/') else data_path
        data_mtime = os.path.getmtime(data_dir)
        return max(reg_mtime, data_mtime)


class KSubcorpus(KCorpus):
    """
    KSubcorpus is an abstraction of a subcorpus used by KonText.

    Please note that properties like 'author', 'author_id',
    'description' refer here to the author of the subcorpus.
    To obtain the original author of the main corpus, new properties
    are available in KSubcorpus - orig_author, orig_author_id,
    orig_description.
    """

    def __init__(self, corp: SubCorpus, corpname: str):
        super().__init__(corp, corpname)
        self._corpname = corpname

    @staticmethod
    def load(corp: Corpus, corpname: str, subcname: str, spath: str, decode_desc: bool) -> 'KCorpus':
        """
        load is a recommended factory function to create a KSubcorpus instance.
        """
        subc = SubCorpus(corp, spath)
        kcorp = KSubcorpus(subc, corpname=corpname)
        kcorp._corp = subc
        kcorp._spath = spath
        try:
            open(spath[:-4] + 'used', 'w')
        except IOError:
            pass
        kcorp._subcname = subcname
        with open(spath, 'rb') as subcinfo:
            kcorp._subchash = md5(subcinfo.read()).hexdigest()
        kcorp._created = datetime.fromtimestamp(int(os.path.getctime(spath)))
        stat = os.lstat(spath)
        kcorp._is_published = stat.st_nlink > 1
        meta, desc = _get_subcorp_pub_info(os.path.splitext(spath)[0] + '.name')
        if meta.subcpath:
            kcorp._orig_spath = meta.subcpath
            kcorp._orig_subcname = os.path.splitext(os.path.basename(meta.subcpath))[0]
        else:
            kcorp._orig_spath = None
            kcorp._orig_subcname = None
        kcorp._author = meta.author_name
        kcorp._author_id = meta.author_id
        if desc:
            kcorp._description = k_markdown(desc) if decode_desc else desc
        else:
            kcorp._description = None
        return kcorp

    @property
    def is_subcorpus(self):
        return True

    @property
    def source_author(self):
        """
        Return an author of the source corpus this subc. is derived from
        """
        return super().author

    @property
    def source_author_id(self):
        """
        Return an author ID of the source corpus this subc. is derived from
        """
        return super().author_id

    @property
    def source_description(self):
        """
        Return a description of the source corpus this subc. is derived from
        """
        return super().description

    def freq_precalc_file(self, attrname: str) -> str:
        return self._corp.spath[:-4] + attrname
