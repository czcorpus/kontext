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

from typing import List, Any, Optional, Tuple, Dict, Union, Set
from manatee import Corpus, SubCorpus, Concordance, StrVector, PosAttr
from array import array
import logging
from .corpus import KCorpus, KSubcorpus
from .fallback import EmptyCorpus

import os
import glob

import l10n
import manatee
from translation import ugettext as _
import plugins
from plugins.abstract.corparch import DefaultManateeCorpusInfo
from functools import cmp_to_key
from .corpus import _PublishedSubcMetadata
from .errors import MissingSubCorpFreqFile


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


def create_subcorpus(path: str, corpus: KCorpus, structname: str, subquery: str) -> SubCorpus:
    """
    Creates a subcorpus

    arguments:
    path -- path of the new subcorpus file
    corpus -- parent corpus (a manatee.Corpus instance)
    structname -- a structure used to specify subcorpus content (only one structure name can be used)
    subquery -- a within query specifying attribute values (attributes must be ones from the 'structname' structure)
    """
    if os.path.exists(path):
        raise RuntimeError(_('Subcorpus already exists'))
    return manatee.create_subcorpus(path, corpus.unwrap(), structname, subquery)


def subcorpus_from_conc(path: str, conc: Concordance, struct: Optional[str] = None) -> SubCorpus:
    """
    Creates a subcorpus from provided concordance. In case
    a struct is provided then only positions located wihtin
    the provided structure are included.

    arguments:
    path -- path to the subcorpus we want to create
    conc -- a manatee.Concordance instance
    struct -- an optional structure to restrict the result to

    returns:
    True in case of success else False (= empty subcorpus)
    """
    return manatee.create_subcorpus(path, conc.RS(), struct)


def create_str_vector() -> StrVector:
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


def mk_publish_links(subcpath: str, publicpath: str, author: str, desc: str):

    def rm_silent(p):
        try:
            os.unlink(p)
        except Exception:
            pass

    orig_cwd = os.getcwd()
    symlink_path = None
    namefile_path = None
    try:
        os.chdir(os.path.dirname(subcpath))
        os.link(subcpath, publicpath)

        rest, tmp = os.path.split(publicpath)
        link_elms = [tmp]
        while link_elms[0] != 'published' and rest != '' and rest != os.path.sep:
            rest, tmp = os.path.split(rest)
            link_elms = [tmp] + link_elms
        link_elms = (['..'] * (len(link_elms) - 1)) + link_elms
        symlink_path = os.path.splitext(subcpath)[0] + '.pub'
        os.symlink(os.path.join(*link_elms), symlink_path)
        namefile_path = os.path.splitext(publicpath)[0] + '.name'
        with open(namefile_path, 'w') as namefile:
            # TODO what if the path struct changes?
            author_id = os.path.basename(os.path.dirname(os.path.dirname(subcpath)))
            meta = _PublishedSubcMetadata(
                subcpath=subcpath, author_id=int(author_id) if author_id else None, author_name=author)
            namefile.write(meta.to_json())
            namefile.write('\n\n')
            namefile.write(desc)
    except Exception as ex:
        rm_silent(symlink_path)
        rm_silent(namefile_path)
        rm_silent(publicpath)
        raise ex
    finally:
        os.chdir(orig_cwd)


class CorpusManager(object):

    def __init__(self, subcpath: Union[List[str], Tuple[str, ...]] = ()) -> None:
        """
        Args:
            subcpath: a list of paths where user corpora are located
        """
        self.subcpath: List[str] = list(subcpath)
        self._cache: Dict[Tuple[str, str, str, Optional[str]], KCorpus] = {}

    def get_subc_public_name(self, corpname: str, subcname: str) -> Optional[str]:
        if len(self.subcpath) > 0:
            test = os.path.join(self.subcpath[0], corpname, (subcname if subcname else '') + '.pub')
            if os.path.islink(test):
                return os.path.splitext(os.path.basename(os.path.realpath(test)))[0]
        return None

    def get_corpus(self, corpname: str, corp_variant: str = '', subcname: str = '', decode_desc: bool = True) -> KCorpus:
        """
        args:
            corp_variant: a registry file path prefix for (typically) limited variant of a corpus;
                          please note that in many cases this can be omitted as only in case user
                          wants to see a continuous text (e.g. kwic context) we must make sure he
                          sees only a 'legal' chunk.
        """
        public_subcname = self.get_subc_public_name(corpname, subcname)
        cache_key = (corpname, corp_variant, subcname, public_subcname)
        if cache_key in self._cache:
            return self._cache[cache_key]
        registry_file = os.path.join(corp_variant, corpname) if corp_variant else corpname
        self._ensure_reg_file(registry_file, corp_variant)
        corp = manatee.Corpus(registry_file)

        # NOTE: line corp.cm = self (as present in NoSke and older KonText versions) has
        # been causing file descriptor leaking for some operations (e.g. corp.get_attr).
        # KonText does not need such an attribute but to keep developers informed I leave
        # the comment here.
        if subcname:
            if public_subcname:
                subcname = public_subcname
            for sp in self.subcpath:
                spath = os.path.join(sp, corpname, subcname + '.subc')
                if os.path.isfile(spath):
                    subc = KSubcorpus.load(corp, corpname, subcname, spath, decode_desc)
                    self._cache[cache_key] = subc
                    return subc
            raise RuntimeError(_('Subcorpus "{}" not found').format(subcname))
        else:
            kcorp = KCorpus(corp, corpname)
            self._cache[cache_key] = kcorp
        return kcorp

    def get_info(self, corpus_id: str) -> DefaultManateeCorpusInfo:
        try:
            corp = self.get_corpus(corpus_id, '', '', True)
        except manatee.CorpInfoNotFound as ex:
            corp = EmptyCorpus(corpus_id)
            logging.getLogger(__name__).warning(ex)
        return DefaultManateeCorpusInfo(corp, corpus_id)

    def _ensure_reg_file(self, rel_path: str, variant: str):
        fullpath = os.path.join(os.environ['MANATEE_REGISTRY'], rel_path)
        if not os.path.isfile(fullpath):
            with plugins.runtime.CORPARCH as ca:
                fn = getattr(ca, 'rebuild_registry', None)
                if callable(fn):
                    fn(fullpath, variant, proc_aligned=True)

    def findPosAttr(self, corpname: str, attrname: str) -> PosAttr:
        return manatee.findPosAttr(corpname.split(':', 1)[0], attrname)

    def corpconf_pairs(self, corp: Corpus, label: str) -> List[Tuple[str, str]]:
        """
        Encodes some specific corpus registry file configuration values
        where a list of pairs is actually flattened (k1, v1, k2, v2,..., kN, vN).
        This applies e.g. for WPOSLIST and LPOSLIST.
        Returns:
             a list of pairs
        """
        if type(corp) is str:
            corp = self.get_corpus(corp)
        val = corp.get_conf(label)
        if len(val) > 2:
            val = val[1:].split(val[0])
        else:
            val = ''
        return [(val[i], val[i + 1]) for i in range(0, len(val), 2)]

    def subc_files(self, corpname: str) -> List[str]:
        # values for the glob.glob() functions must be encoded properly otherwise it fails for non-ascii files
        sp = self.subcpath[0]
        items = []
        for x in glob.glob(os.path.join(sp, corpname, '*.subc')):
            items.append(x)
        return sorted(items)

    def subcorp_names(self, corpname: str) -> List[Dict[str, Optional[str]]]:
        return [dict(n=os.path.splitext(os.path.basename(s))[0],
                     v=os.path.splitext(os.path.basename(s))[0],
                     pub=self.get_subc_public_name(corpname, os.path.splitext(os.path.basename(s))[0]))
                for s in self.subc_files(corpname)]


def texttype_values(corp: KCorpus, subcorpattrs: str, maxlistsize: int,
                    shrink_list: Union[Tuple[str, ...], List[str]] = (),
                    collator_locale: Optional[str] = None) -> List[Dict[str, Any]]:
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
    attr = corp.get_attr(n) line is leaking opened files of corpora indexes which
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
        result.append({'v': full_value,
                       'key': label,
                       'label': item,
                       'shift': level * 16,
                       'startdiv': startdiv,
                       'enddiv': 0,
                       'display_plus': display_plus,
                       })
        startdiv = False
        result.extend(sub)
    if level > 0:
        result[-1]['enddiv'] += 1
    return result


def frq_db(corp: KCorpus, attrname: str, nums: str = 'frq', id_range: int = 0) -> array:
    import array
    filename = (corp.freq_precalc_file(attrname) + '.' + nums)
    if not id_range:
        id_range = corp.get_attr(attrname).id_range()
    if nums == 'arf':
        frq = array.array('f')
        try:
            frq.fromfile(open(filename, 'rb'), id_range)  # type: ignore
        except IOError as ex:
            raise MissingSubCorpFreqFile(ex)
        except EOFError as ex:
            os.remove(filename.rsplit('.', 1)[0] + '.docf')
            raise MissingSubCorpFreqFile(ex)
    else:
        try:
            if corp.get_conf('VIRTUAL') and not corp.is_subcorpus and nums == 'frq':
                raise IOError
            frq = array.array('i')
            frq.fromfile(open(filename, 'rb'), id_range)  # type: ignore
        except EOFError as ex:
            os.remove(filename.rsplit('.', 1)[0] + '.docf')
            os.remove(filename.rsplit('.', 1)[0] + '.arf')
            os.remove(filename.rsplit('.', 1)[0] + '.frq')
            raise MissingSubCorpFreqFile(ex)
        except IOError:
            try:
                frq = array.array('l')
                frq.fromfile(open(filename + '64', 'rb'), id_range)  # type: ignore
            except IOError as ex:
                if not corp.is_subcorpus and nums == 'frq':
                    a = corp.get_attr(attrname)
                    frq.fromlist([a.freq(i) for i in range(a.id_range())])
                else:
                    raise MissingSubCorpFreqFile(ex)
    return frq


def matching_structattr(corp: KCorpus, struct: str, attr: str, val: str, search_attr: str
                        ) -> Tuple[List[str], int, int]:
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
