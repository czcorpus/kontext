# Copyright (c) 2003-2013  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright(c) 2014 Charles University in Prague, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2014 Tomas Machalek <tomas.machalek @ gmail.com>
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

import logging
import os
from array import array
from functools import cmp_to_key
from typing import Any, Dict, List, Optional, Tuple, Union

import aiofiles
import aiofiles.os
import l10n
import manatee
import plugins
from corplib.subcorpus import SubcorpusIdent, SubcorpusRecord
from plugin_types.corparch.corpus import (
    DefaultManateeCorpusInfo, ManateeCorpusInfo)
from plugin_types.subc_storage import AbstractSubcArchive

from .corpus import AbstractKCorpus, KCorpus
from .errors import (
    CorpusInstantiationError, MissingSubCorpFreqFile, VirtualSubcFreqFileError)
from .fallback import EmptyCorpus
from .subcorpus import KSubcorpus

TYPO_CACHE_KEY = 'cached_registry_typos'
TYPO_CACHE_TTL = 3600 * 24 * 7


def _cmp(a, b):
    """Python 3 workaround for in-built python 2 cmp() function"""
    return (a > b) - (a < b)


def manatee_version() -> str:
    """
    Returns Manatee version (as a string)
    """
    return manatee.version()


def manatee_min_version(ver: str) -> bool:
    """
    Tests whether the provided version string represents a newer or
    equal version than the one currently configured.

    arguments:
    ver -- a version signature string 'X.Y.Z' (e.g. '2.130.7')
    """
    ver_parsed = int(''.join('%03d' % int(x) for x in ver.split('.')))
    actual = int(''.join('%03d' % int(x) for x in manatee.version().split('-')[-1].split('.')))
    return ver_parsed <= actual


def create_str_vector() -> manatee.StrVector:
    """
    Creates a new manatee.StrVector instance
    """
    return manatee.StrVector()


def conf_bool(v: str) -> bool:
    """
    Tests whether the provided string
    represents an encoded 'true' value ('1', 't', ...)
    """
    return v in ('y', 'yes', 'true', 't', '1')


class CorpusFactory:

    def __init__(self, subc_root: Optional[str] = None) -> None:
        """
        Args:
            subc_root: an optional path where to look for subcorpora; in case it is omitted the
                factory will be able to provide only full corpora and ra
        """
        self.subcpath = subc_root
        self._cache: Dict[Tuple[str, str], AbstractKCorpus] = {}

    async def get_corpus(
            self,
            corp_ident: Union[str, SubcorpusIdent, SubcorpusRecord],
            corp_variant: str = '',
            no_cache_read: bool = False) -> AbstractKCorpus:
        """
        Args:
            corp_ident: an ID (= registry file name) of a subcorpus or a subcorpus identification record
            corp_variant: a registry file path prefix for (typically) limited variant of a corpus;
                please note that in many cases this can be omitted as only in case user wants to see
                a continuous text (e.g. kwic context) we must make sure they see only a 'legal' chunk.
            no_cache_read: if True then cached corpus will be ignored, new instance
                will be created and cached
        """
        if isinstance(corp_ident, SubcorpusIdent) and self.subcpath is None:
            raise CorpusInstantiationError(
                'CorpusFactory not configured for creating subcorpora instances')
        corpname = corp_ident.corpus_name if isinstance(corp_ident, SubcorpusIdent) else corp_ident
        subc_id = corp_ident.id if isinstance(corp_ident, SubcorpusIdent) else ''
        registry_file = await self._ensure_reg_file(corpname, corp_variant)
        cache_key = (registry_file, subc_id)
        if cache_key in self._cache and not no_cache_read:
            return self._cache[cache_key]

        corp = manatee.Corpus(registry_file)

        # NOTE: line corp.cm = self (as present in NoSke and older KonText versions) has
        # been causing file descriptor leaking for some operations (e.g. corp.get_attr).
        # KonText does not need such an attribute but to keep developers informed we leave
        # the comment here.
        if isinstance(corp_ident, SubcorpusIdent):
            subc = await KSubcorpus.load(corp, corp_ident, self.subcpath)
            self._cache[cache_key] = subc
            return subc
        else:
            kcorp = KCorpus(corp, corpname)
            self._cache[cache_key] = kcorp
        return kcorp

    async def get_info(self, corpus_id: str) -> ManateeCorpusInfo:
        """
        Return a low-level information (provided via Manatee) about a corpus
        Args:
            corpus_id: corpus ID (= registry file name)
        """
        try:
            corp = await self.get_corpus(corpus_id)
        except manatee.CorpInfoNotFound as ex:
            corp = EmptyCorpus(corpus_id)
            logging.getLogger(__name__).warning(ex)
        try:
            info = DefaultManateeCorpusInfo(corp, corpus_id)
        except Exception as ex:
            logging.getLogger(__name__).error(
                f'Manatee failed to fetch info about {corpus_id}: {ex}')
            info = ManateeCorpusInfo(name=corpus_id, encoding='utf-8')
        return info

    @staticmethod
    async def _ensure_reg_file(corpname: str, variant: Optional[str]) -> str:
        corp_relative_dir = os.path.join(variant, corpname) if variant else corpname
        reg_root = os.environ['MANATEE_REGISTRY']
        fullpath = os.path.join(reg_root, corp_relative_dir)
        with plugins.runtime.DB as db, plugins.runtime.AUTH as auth:
            if not await aiofiles.os.path.isfile(fullpath) and auth.ignores_corpora_names_case():
                cached = await db.hash_get(TYPO_CACHE_KEY, corp_relative_dir)
                if cached:
                    return cached
                for item in os.listdir(reg_root):
                    fp = os.path.join(reg_root, item)
                    if await aiofiles.os.path.isfile(fp) and item.lower() == corpname.lower():
                        await db.hash_set(TYPO_CACHE_KEY, corp_relative_dir, fp)
                        await db.set_ttl(TYPO_CACHE_KEY, TYPO_CACHE_TTL)
                        return fp
        return fullpath


def texttype_values(
        corp: AbstractKCorpus,
        subcorpattrs: str,
        maxlistsize: int,
        shrink_list: Union[Tuple[str, ...], List[str]] = (),
        collator_locale: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    arguments:
    corp --
    subcorpattrs -- structures and attributes to be processed (see Manatee's SUBCORPATTRS)
    maxlistsize -- in case there is more that this number of items, empty list will be returned
    shrink_list -- list/tuple of attributes we want to return empty lists for (False can be used
                   to specify an empty value)
    collator_locale -- a collator used to sort attribute values (en_US is the default)

    returns:
    a list containing following dictionaries
    { 'Line' : [
        { 'attr_doc_label' : '', 'Values' : [ {'v', 'item name'}, ... ], 'name' : '', 'attr_doc' : '', 'label' : '' },
        { 'attr_doc_label' : '', 'Values' : [ {'v', 'item name'}, ... ], 'name' : '', 'attr_doc' : '', 'label' : '' },
        ...
    ]}

    !!!!!!
    NOTE: avoid calling this method repeatedly for the same corpus as the
    attr = corp.get_attr(n) line is probably leaking file descriptors of corpora indexes which
    leads to exhausted limit for opened files for Gunicorn/Celery after some time.
    KonText caches the value returned by this function to prevent this.

    !!! TODO !!!

    """
    if subcorpattrs == '#':
        return []
    attrlines = []

    if not shrink_list:
        shrink_list = ()

    for subcorpline in subcorpattrs.split(','):
        attrvals = []
        for n in subcorpline.split('|'):
            if n in ('', '#'):
                continue
            attr = corp.get_attr(n)
            attrval = {
                'name': n,
                'label': corp.get_conf(f'{n}.LABEL') or n,
                'attr_doc': corp.get_conf(f'{n}.ATTRDOC'),
                'attr_doc_label': corp.get_conf(f'{n}.ATTRDOCLABEL'),
                'numeric': conf_bool(corp.get_conf(f'{n}.NUMERIC'))
            }
            hsep = corp.get_conf(f'{n}.HIERARCHICAL')
            multisep = corp.get_conf(f'{n}.MULTISEP')
            is_multival = corp.get_conf(f'{n}.MULTIVAL') in ('y', 'yes')
            if (not hsep and (corp.get_conf(f'{n}.TEXTBOXLENGTH')
                              or attr.id_range() > maxlistsize or n in shrink_list)):
                attrval['textboxlength'] = (corp.get_conf(f'{n}.TEXTBOXLENGTH') or 24)
            else:  # list of values
                if conf_bool(corp.get_conf(f'{n}.NUMERIC')):
                    vals = []
                    for i in range(attr.id_range()):
                        try:
                            vals.append({'v': int(attr.id2str(i))})
                        except ValueError:
                            vals.append({'v': attr.id2str(i)})
                elif hsep:  # hierarchical
                    vals = [{'v': attr.id2str(i)}
                            for i in range(attr.id_range())
                            if multisep not in attr.id2str(i)]
                else:
                    if is_multival:
                        raw_vals = [attr.id2str(i).split(multisep) for i in range(attr.id_range())]
                        vals = [{'v': x}
                                for x in sorted(set([s for subl in raw_vals for s in subl]))]
                    else:

                        vals = [{'v': attr.id2str(i)} for i in range(attr.id_range())]

                if hsep:  # hierarchical
                    attrval['hierarchical'] = hsep
                    attrval['Values'] = _get_attr_hierarchy(vals, hsep)
                elif conf_bool(corp.get_conf(f'{n}.NUMERIC')):
                    attrval['Values'] = sorted(vals, key=lambda item: item['v'])
                elif collator_locale:
                    attrval['Values'] = l10n.sort(vals, collator_locale, key=lambda item: item['v'])
                else:
                    attrval['Values'] = sorted(vals, key=cmp_to_key(lambda x1, x2: _cmp(
                        x1['v'].lower(), x2['v'].lower())))
            attrvals.append(attrval)
        attrlines.append({'Line': attrvals})
    return attrlines


def _get_attr_hierarchy(vals, hsep):
    result = {}
    values = set()
    for v in vals:
        values.add(v['v'])
    for value in sorted(values):
        level = result
        while hsep in value:
            key, value = value.split(hsep, 1)
            level = level[key]
        level[value] = {}
    return _print_attr_hierarchy(result, hsep=hsep)


def _print_attr_hierarchy(layer, level=0, label='', hsep='::'):
    if not layer:
        return []
    result = []
    if level > 0:
        startdiv = True
    else:
        startdiv = False
    for item in sorted(layer):
        sub = _print_attr_hierarchy(layer[item], level + 1, label + hsep + item, hsep)
        if sub:
            display_plus = True
        else:
            display_plus = False
        if label:
            full_value = label[len(hsep):] + hsep + item
        else:
            full_value = item
        result.append({
            'v': full_value,
            'key': label,
            'label': item,
            'shift': level * 16,
            'startdiv': startdiv,
            'enddiv': 0,
            'display_plus': display_plus})
        startdiv = False
        result.extend(sub)
    if level > 0:
        result[-1]['enddiv'] += 1
    return result


def _frq_from_file(data, path, id_range):
    if not os.path.isfile(path):
        raise IOError(f'frq file does not exist: {path}')
    data.fromfile(open(path, 'rb'), id_range)


async def frq_db(corp: AbstractKCorpus, attrname: str, nums: str = 'frq', id_range: int = 0) -> array:
    import array
    filename = corp.freq_precalc_file(attrname, nums)
    if not id_range:
        id_range = corp.get_attr(attrname).id_range()
    if nums == 'arf':
        frq = array.array('f')
        try:
            _frq_from_file(frq, filename, id_range)  # type: ignore
        except IOError as ex:
            raise MissingSubCorpFreqFile(ex)
        except EOFError as ex:
            await aiofiles.os.remove(corp.freq_precalc_file(attrname, 'docf'))
            raise MissingSubCorpFreqFile(ex)
    else:
        try:
            if corp.get_conf('VIRTUAL') and not corp.subcorpus_id and nums == 'frq':
                raise VirtualSubcFreqFileError()
            frq = array.array('i')
            _frq_from_file(frq, filename, id_range)  # type: ignore
        except EOFError as ex:
            try:
                await aiofiles.os.remove(filename)
            except:
                pass
            raise MissingSubCorpFreqFile(ex)
        except (VirtualSubcFreqFileError, IOError):
            frq = array.array('l')
            try:
                _frq_from_file(frq, filename + '64', id_range)  # type: ignore
            except IOError as ex:
                if not corp.subcorpus_id and nums == 'frq':
                    a = corp.get_attr(attrname)
                    frq.fromlist([a.freq(i) for i in range(a.id_range())])
                else:
                    raise MissingSubCorpFreqFile(ex)
    return frq


def matching_structattr(
        corp: AbstractKCorpus, struct: str, attr: str, val: str, search_attr: str) -> Tuple[List[str], int, int]:
    """
    Return a value of search_attr matching provided structural attribute
    [struct].[attr] = [val]
    """
    try:
        size_limit = 1000000
        ans = set()
        query = '<{struct} {attr}="{attr_val}">[]'.format(struct=struct, attr=attr, attr_val=val)
        conc = manatee.Concordance(corp.unwrap(), query, 0, -1)
        conc.sync()
        size = conc.size()

        kw = manatee.KWICLines(
            corp.unwrap(), conc.RS(True, 0, size_limit),
            '-1', '1', 'word', '', '', '={}.{}'.format(struct, search_attr))
        while kw.nextline():
            refs = kw.get_ref_list()
            if len(refs) > 0:
                ans.add(refs[0])
        return sorted(ans), size,  min(size, size_limit)
    except RuntimeError as ex:
        if 'AttrNotFound' in str(ex):
            return [], 0, 0
        raise ex
