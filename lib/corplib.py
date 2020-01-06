# -*- coding: utf-8 -*-
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

import os
import glob
from hashlib import md5
from datetime import datetime
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
    import cgi

    def k_markdown(s): return cgi.escape(s)

import l10n
from l10n import import_string, export_string
import manatee
from functools import partial
from translation import ugettext as _
import plugins


def manatee_version():
    """
    Returns Manatee version (as a string)
    """
    return manatee.version()


def manatee_min_version(ver):
    """
    Tests whether the provided version string represents a newer or
    equal version than the one currently configured.

    arguments:
    ver -- a version signature string 'X.Y.Z' (e.g. '2.130.7')
    """
    ver = int(''.join(['%03d' % int(x) for x in ver.split('.')]))
    actual = int(''.join(['%03d' %
                          int(x) for x in manatee.version().split('-')[-1].split('.')]))
    return ver <= actual


def corp_mtime(corpus):
    reg_mtime = os.path.getmtime(corpus.get_confpath())
    data_path = corpus.get_conf('PATH')
    data_dir = os.path.dirname(data_path) if data_path.endswith('/') else data_path
    data_mtime = os.path.getmtime(data_dir)
    return max(reg_mtime, data_mtime)


class PublishedSubcMetadata(object):

    def __init__(self, **kw):
        self.author_id = kw.get('author_id', None)
        self.author_name = kw.get('author_name', None)
        self.subcpath = kw.get('subcpath', None)

    def to_json(self):
        return json.dumps(self.__dict__)

    @staticmethod
    def from_json(data):
        return PublishedSubcMetadata(**json.loads(data))


def _list_public_corp_dir(corpname, path, code_prefix, author_prefix):
    ans = []
    subc_root = os.path.dirname(os.path.dirname(path))
    for item in glob.glob(path + '/*.subc'):
        full_path = os.path.join(path, item)
        meta, desc = get_subcorp_pub_info(full_path)
        if meta.subcpath is None or meta.author_name is None or not desc:
            logging.getLogger(__name__).warning(
                'Missing metainformation for published subcorpus {0}'.format(item))
        else:
            try:
                ident = os.path.splitext(os.path.basename(item))[0]
                author_rev = ' '.join(reversed(meta.author_name.split(' ')
                                               if meta.author_name else [])).lower()
                author_prefix = author_prefix.lower() if author_prefix else None
                if (code_prefix and ident.startswith(code_prefix) or author_prefix and
                        author_rev.startswith(author_prefix)):
                    ans.append(dict(
                        ident=ident,
                        origName=os.path.splitext(os.path.basename(meta.subcpath))[0],
                        corpname=corpname,
                        author=meta.author_name,
                        description=k_markdown(desc),
                        userId=int(meta.subcpath.lstrip(subc_root).split(os.path.sep, 1)[0])
                    ))
            except Exception as ex:
                logging.getLogger(__name__).warning(
                    'Broken published subcorpus {0}: {1}'.format(full_path, ex))
    return ans


def list_public_subcorpora(subcpath, author_prefix=None, code_prefix=None, offset=0, limit=20):
    data = []
    for corp in os.listdir(subcpath):
        try:
            data += _list_public_corp_dir(corp, os.path.join(subcpath, corp), code_prefix=code_prefix,
                                          author_prefix=author_prefix)
            if len(data) >= offset + limit:
                break
        except Exception as ex:
            logging.getLogger(__name__).warning(ex)
    return data[offset:limit]


def open_corpus(*args, **kwargs):
    """
    Creates a manatee.Corpus instance
    """
    return manatee.Corpus(*args, **kwargs)


def create_subcorpus(path, corpus, structname, subquery):
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
    return manatee.create_subcorpus(path, corpus, structname, subquery)


def subcorpus_from_conc(path, conc, struct=None):
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


def is_subcorpus(corp_obj):
    return isinstance(corp_obj, manatee.SubCorpus)


def create_str_vector():
    """
    Creates a new manatee.StrVector instance
    """
    return manatee.StrVector()


def conf_bool(v):
    """
    Tests whether the provided string
    represents an encoded 'true' value ('1', 't', ...)
    """
    return v in ('y', 'yes', 'true', 't', '1')


def subcorpus_is_published(subcpath):
    stat = os.lstat(subcpath)
    return stat.st_nlink > 1


def get_subcorp_pub_info(spath):
    desc = None
    namepath = os.path.splitext(spath)[0] + '.name'
    metadata = PublishedSubcMetadata()

    if os.path.isfile(namepath):
        with open(namepath, 'r') as nf:
            desc = ''
            for i, line in enumerate(nf):
                if i == 0:
                    metadata = PublishedSubcMetadata.from_json(line.decode('utf-8'))
                elif i > 1:
                    desc += line
    return metadata, desc.decode('utf-8') if desc else None


def rewrite_subc_desc(publicpath, desc):
    meta, _ = get_subcorp_pub_info(publicpath)
    with open(os.path.splitext(publicpath)[0] + '.name', 'w') as fw:
        fw.write(meta.to_json().encode('utf-8') + '\n\n')
        fw.write(desc.encode('utf-8'))


def mk_publish_links(subcpath, publicpath, author, desc):

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
            meta = PublishedSubcMetadata(
                subcpath=subcpath, author_id=int(author_id) if author_id else None, author_name=author)
            namefile.write(meta.to_json().encode('utf-8'))
            namefile.write('\n\n')
            namefile.write(desc.encode('utf-8'))
    except Exception as ex:
        rm_silent(symlink_path)
        rm_silent(namefile_path)
        rm_silent(publicpath)
        raise ex
    finally:
        os.chdir(orig_cwd)


class CorpusManager(object):

    def __init__(self, subcpath=()):
        """
        Args:
            subcpath: a list of paths where user corpora are located
        """
        self.subcpath = list(subcpath)
        self._cache = {}

    def get_subc_public_name(self, corpname, subcname):
        if len(self.subcpath) > 0:
            test = os.path.join(self.subcpath[0], corpname, (subcname if subcname else '') + '.pub')
            if os.path.islink(test):
                return os.path.splitext(os.path.basename(os.path.realpath(test)))[0]
        return None

    def _open_subcorpus(self, corpname, subcname, corp, spath, decode_desc):
        subc = manatee.SubCorpus(corp, spath)
        subc.corp = corp
        subc.spath = spath
        try:
            open(spath[:-4] + 'used', 'w')
        except IOError:
            pass
        subc.corpname = str(corpname)  # never unicode (paths)
        subc.subcname = subcname
        subc.cm = self
        subc.subchash = md5(open(spath).read()).hexdigest()
        subc.created = datetime.fromtimestamp(int(os.path.getctime(spath)))
        subc.is_published = subcorpus_is_published(spath)
        meta, desc = get_subcorp_pub_info(os.path.splitext(spath)[0] + '.name')
        if meta.subcpath:
            subc.orig_spath = meta.subcpath
            subc.orig_subcname = os.path.splitext(os.path.basename(meta.subcpath))[0]
        else:
            subc.orig_spath = None
            subc.orig_subcname = None
        subc.author = meta.author_name
        subc.author_id = meta.author_id
        if desc:
            subc.description = k_markdown(desc) if decode_desc else desc
        else:
            subc.description = None
        return subc

    def get_Corpus(self, corpname, corp_variant='', subcname='', decode_desc=True):
        """
        args:
            corp_variant: a registry file path prefix for (typically) limited variant of a corpus;
                          please note that in many cases this can be omitted as only in case user
                          wants to see a continuous text (e.g. kwic context) we must make sure he
                          sees only a 'legal' chunk.
        """
        if ':' in corpname:
            corpname, subcname = corpname.split(':', 1)

        public_subcname = self.get_subc_public_name(corpname, subcname)
        cache_key = (corpname, corp_variant, subcname, public_subcname)
        if cache_key in self._cache:
            return self._cache[cache_key]
        registry_file = os.path.join(corp_variant, corpname) if corp_variant else corpname
        self._ensure_reg_file(registry_file, corp_variant)
        corp = manatee.Corpus(registry_file)
        corp.corpname = str(corpname)  # never unicode (paths)
        corp.is_published = False
        corp.author = None
        corp.author_id = None

        # NOTE: line corp.cm = self (as present in NoSke and older KonText versions) has
        # been causing file descriptor leaking for some operations (e.g. corp.get_attr).
        # KonText does not need such an attribute but to keep developers informed I leave
        # the comment here.
        if subcname:
            if public_subcname:
                subcname = public_subcname
            for sp in self.subcpath:
                spath = os.path.join(sp, corpname, subcname + '.subc')
                if type(spath) == str:
                    spath = spath.encode('utf-8')
                if os.path.isfile(spath):
                    subc = self._open_subcorpus(corpname, subcname, corp, spath, decode_desc)
                    self._cache[cache_key] = subc
                    return subc
            raise RuntimeError(_('Subcorpus "%s" not found') % subcname)
        else:
            self._cache[cache_key] = corp
        return corp

    def _ensure_reg_file(self, rel_path, variant):
        fullpath = os.path.join(os.environ['MANATEE_REGISTRY'], rel_path)
        if not os.path.isfile(fullpath):
            with plugins.runtime.CORPARCH as ca:
                fn = getattr(ca, 'rebuild_registry', None)
                if callable(fn):
                    fn(fullpath, variant, proc_aligned=True)

    def findPosAttr(self, corpname, attrname):
        return manatee.findPosAttr(corpname.split(':', 1)[0], attrname)

    def corpconf_pairs(self, corp, label):
        """
        Encodes some specific corpus registry file configuration values
        where a list of pairs is actually flattened (k1, v1, k2, v2,..., kN, vN).
        This applies e.g. for WPOSLIST and LPOSLIST.
        Returns:
             a list of pairs
        """
        if type(corp) is str:
            corp = self.get_Corpus(corp)
        val = import_string(corp.get_conf(label), from_encoding=corp.get_conf('ENCODING'))
        if len(val) > 2:
            val = val[1:].split(val[0])
        else:
            val = ''
        return [(val[i], val[i + 1]) for i in range(0, len(val), 2)]

    def subc_files(self, corpname):
        # values for the glob.glob() functions must be encoded properly otherwise it fails for non-ascii files
        sp = self.subcpath[0]
        items = []
        for x in glob.glob(os.path.join(sp, corpname, '*.subc')):
            items.append(x)
        return sorted(items)

    def subcorp_names(self, corpname):
        return [dict(n=os.path.splitext(os.path.basename(s))[0],
                     v=os.path.splitext(os.path.basename(s))[0],
                     pub=self.get_subc_public_name(corpname, os.path.splitext(os.path.basename(s))[0]))
                for s in self.subc_files(corpname)]


def add_block_items(items, attr='class', val='even', block_size=3):
    for i in [i for i in range(len(items)) if (i / block_size) % 2]:
        items[i][attr] = val
    return items


def get_wordlist_length(corp, wlattr, wlpat, wlnums, wlminfreq, words, blacklist, include_nonwords):
    enc_string = partial(export_string, to_encoding=corp.get_conf('ENCODING'))
    enc_pattern = enc_string(wlpat.strip())
    attr = corp.get_attr(wlattr)
    attrfreq = _get_attrfreq(corp=corp, attr=attr, wlattr=wlattr, wlnums=wlnums)
    if not include_nonwords:
        nwre = corp.get_conf('NONWORDRE')
    else:
        nwre = ''
    try:
        gen = attr.regexp2ids(enc_pattern, 0, nwre)
    except TypeError:
        gen = attr.regexp2ids(enc_pattern, 0)
    i = 0
    while not gen.end():
        wid = gen.next()
        frq = attrfreq[wid]
        if not frq:
            continue
        id_value = attr.id2str(wid)
        if frq >= wlminfreq and (not words or id_value in words) and (not blacklist or id_value not in blacklist):
            i += 1
    return i


def _wordlist_by_pattern(attr, attrfreq, enc_pattern, excl_pattern, wlminfreq, words, blacklist, wlnums, wlsort,
                         wlmaxitems):
    try:
        gen = attr.regexp2ids(enc_pattern, 0, excl_pattern)
    except TypeError:
        gen = attr.regexp2ids(enc_pattern, 0)
    items = []
    while not gen.end():
        if wlsort == 'f':
            if len(items) > 5 * wlmaxitems:
                items.sort()
                del items[:-wlmaxitems]
        else:
            if len(items) >= wlmaxitems:
                break
        wid = gen.next()
        frq = attrfreq[wid]
        if not frq:
            continue

        id_value = attr.id2str(wid)
        if frq >= wlminfreq and (not words or id_value in words) and (not blacklist or id_value not in blacklist):
            if wlnums == 'arf':
                items.append((round(frq, 1), wid))
            else:
                items.append((frq, wid))
    return items


def _wordlist_from_list(attr, attrfreq, words, blacklist, wlsort, wlminfreq, wlmaxitems, wlnums, str_dec_fn):
    items = []
    for word in words:
        if wlsort == 'f':
            if len(items) > 5 * wlmaxitems:
                items.sort()
                del items[:-wlmaxitems]
        else:
            if len(items) >= wlmaxitems:
                break
        id = attr.str2id(word)
        if id == -1:
            frq = 0
        else:
            frq = attrfreq[id]
        if word and frq >= wlminfreq and (not blacklist or word not in blacklist):
            if wlnums == 'arf':
                items.append((round(frq, 1), str_dec_fn(word)))
            else:
                items.append((frq, str_dec_fn(word)))
    return items


def _get_attrfreq(corp, attr, wlattr, wlnums):
    if '.' in wlattr:  # attribute of a structure
        struct = corp.get_struct(wlattr.split('.')[0])
        if wlnums == 'doc sizes':
            normvals = dict([(struct.beg(i), struct.end(i) - struct.beg(i))
                             for i in range(struct.size())])
        else:
            normvals = dict([(struct.beg(i), 1) for i in range(struct.size())])
        attrfreq = dict([(i, doc_sizes(corp, struct, wlattr, i, normvals))
                         for i in range(attr.id_range())])
    else:  # positional attribute
        attrfreq = frq_db(corp, wlattr, wlnums)
    return attrfreq


def wordlist(corp, words=None, wlattr='', wlpat='', wlminfreq=5, wlmaxitems=100,
             wlsort='', blacklist=None, wlnums='frq', include_nonwords=0):
    """
    Note: 'words' and 'blacklist' are expected to contain utf-8-encoded strings.
    """
    dec_string = partial(import_string, from_encoding=corp.get_conf('ENCODING'))
    enc_string = partial(export_string, to_encoding=corp.get_conf('ENCODING'))

    blacklist = set(enc_string(w) for w in blacklist) if blacklist else set()
    words = set(enc_string(w) for w in words) if words else set()
    attr = corp.get_attr(wlattr)
    attrfreq = _get_attrfreq(corp=corp, attr=attr, wlattr=wlattr, wlnums=wlnums)
    if words and wlpat == '.*':  # word list just for given words
        items = _wordlist_from_list(attr=attr, attrfreq=attrfreq, words=words, blacklist=blacklist, wlsort=wlsort,
                                    wlminfreq=wlminfreq, wlmaxitems=wlmaxitems, wlnums=wlnums, str_dec_fn=dec_string)
    else:  # word list according to pattern
        if not include_nonwords:
            nwre = corp.get_conf('NONWORDRE')
        else:
            nwre = ''
        items = _wordlist_by_pattern(attr=attr, enc_pattern=enc_string(wlpat.strip()), excl_pattern=nwre,
                                     wlminfreq=wlminfreq, words=words, blacklist=blacklist, wlnums=wlnums,
                                     wlsort=wlsort, wlmaxitems=wlmaxitems, attrfreq=attrfreq)

    if not words or wlpat != '.*':
        items = [(f, dec_string(attr.id2str(i))) for (f, i) in items]
    if wlsort == 'f':
        items = sorted(items, key=lambda x: x[0], reverse=True)
    else:
        items = sorted(items, key=lambda x: x[1])
    del items[wlmaxitems:]
    return add_block_items([{'str': w, 'freq': f}
                            for f, w in items])


def doc_sizes(corp, struct, attrname, i, normvals):
    r = corp.filter_query(struct.attr_val(attrname.split('.')[1], i))
    cnt = 0
    while not r.end():
        cnt += normvals[r.peek_beg()]
        r.next()
    return cnt


def texttype_values(corp, subcorpattrs, maxlistsize, shrink_list=False, collator_locale=None):
    """
    arguments:
    corp -- manatee.Corpus
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

    if shrink_list is False:
        shrink_list = ()

    for subcorpline in subcorpattrs.split(','):
        attrvals = []
        for n in subcorpline.split('|'):
            if n in ('', '#'):
                continue
            attr = corp.get_attr(n)
            attrval = {
                'name': n,
                'label': corp.get_conf(n + '.LABEL') or n,
                'attr_doc': corp.get_conf(n + '.ATTRDOC'),
                'attr_doc_label': corp.get_conf(n + '.ATTRDOCLABEL'),
                'numeric': conf_bool(corp.get_conf(n + '.NUMERIC'))
            }
            hsep = corp.get_conf(n + '.HIERARCHICAL')
            multisep = corp.get_conf(n + '.MULTISEP')
            is_multival = corp.get_conf(n + '.MULTIVAL') in ('y', 'yes')
            if (not hsep and (corp.get_conf(n + '.TEXTBOXLENGTH')
                              or attr.id_range() > maxlistsize or n in shrink_list)):
                attrval['textboxlength'] = (corp.get_conf(n + '.TEXTBOXLENGTH') or 24)
            else:  # list of values
                if conf_bool(corp.get_conf(n + '.NUMERIC')):
                    vals = []
                    for i in range(attr.id_range()):
                        try:
                            vals.append({'v': int(attr.id2str(i))})
                        except:
                            vals.append({'v': attr.id2str(i)})
                elif hsep:  # hierarchical
                    vals = [{'v': attr.id2str(i)}
                            for i in range(attr.id_range())
                            if not multisep in attr.id2str(i)]
                else:
                    if is_multival:
                        raw_vals = [import_string(attr.id2str(i), from_encoding=corp.get_conf('ENCODING'))
                                    .split(multisep) for i in range(attr.id_range())]
                        vals = [{'v': x}
                                for x in sorted(set([s for subl in raw_vals for s in subl]))]
                    else:

                        vals = [{'v': import_string(attr.id2str(i), from_encoding=corp.get_conf('ENCODING'))}
                                for i in range(attr.id_range())]

                if hsep:  # hierarchical
                    attrval['hierarchical'] = hsep
                    attrval['Values'] = _get_attr_hierarchy(vals, hsep)
                elif conf_bool(corp.get_conf(n + '.NUMERIC')):
                    attrval['Values'] = sorted(vals, key=lambda item: item['v'])
                elif collator_locale:
                    attrval['Values'] = l10n.sort(vals, collator_locale, key=lambda item: item['v'])
                else:
                    attrval['Values'] = sorted(vals, cmp=lambda x1, x2: cmp(
                        x1['v'].lower(), x2['v'].lower()))
            attrvals.append(attrval)
        attrlines.append({'Line': attrvals})
    return attrlines


def _get_attr_hierarchy(vals, hsep):
    result = {}
    values = set([])
    for v in vals:
        values.add(v)
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


def subc_freqs(subcorp, attr, minfreq=50, maxfreq=10000, last_id=None):
    return [(i, subcorp.count_rest(attr.id2poss(i)))
            for i in range(last_id or attr.id_range())
            if maxfreq > attr.freq(i) > minfreq]


def subc_keywords1(subcorp, attr, minfreq=50, maxfreq=10000):
    p = (subcorp.size() - subcorp.search_size()) / float(subcorp.search_size())
    freqs = [(float(f) / (attr.freq(i) - f + 1) * p, f, i)
             for (i, f) in subc_freqs(subcorp, attr, minfreq, maxfreq,
                                      attr.id_range() / 1000)]
    # freqs.sort()
    #del freqs[:-maxitems]
    return freqs


def subc_keywords(subcorp, attr, minfreq=50, maxfreq=10000, last_id=10000,
                  maxitems=100):
    p = (subcorp.size() - subcorp.search_size()) / float(subcorp.search_size())
    candidates = []
    for i in range(last_id or attr.id_range()):
        if not (maxfreq > attr.freq(i) > minfreq):
            continue
        freq = subcorp.count_rest(attr.id2poss(i))
        if freq < 3:
            continue
        arf = subcorp.count_ARF(attr.id2poss(i), freq)
        score = arf / (attr.freq(i) - arf + 1) * p
        # if score < 2.0:
        #    continue
        candidates.append((score, arf, freq, i))
    candidates.sort()
    del candidates[:-maxitems]
    return candidates


def subcorp_base_file(corp, attrname):
    if hasattr(corp, 'spath'):
        return corp.spath[:-4].decode('utf-8') + attrname
    else:
        return corp.get_conf('PATH').decode('utf-8') + attrname


class MissingSubCorpFreqFile(Exception):

    def __init__(self, corpus, orig_error):
        self._corpus = corpus
        self._orig_error = orig_error

    def __unicode__(self):
        return 'Missing subcorp freq file for {0} (orig error: {1})'.format(self._corpus, self._orig_error)

    def __repr__(self):
        return self.__unicode__().encode('utf-8')

    @property
    def corpus(self):
        return self._corpus


def frq_db(corp, attrname, nums='frq', id_range=0):
    import array
    import exceptions
    filename = (subcorp_base_file(corp, attrname) + '.' + nums).encode('utf-8')
    if not id_range:
        id_range = corp.get_attr(attrname).id_range()
    if nums == 'arf':
        frq = array.array('f')
        try:
            frq.fromfile(open(filename), id_range)
        except IOError as ex:
            raise MissingSubCorpFreqFile(corp, ex)
        except exceptions.EOFError as ex:
            os.remove(filename.rsplit('.', 1)[0] + '.docf')
            raise MissingSubCorpFreqFile(corp, ex)
    else:
        try:
            if corp.get_conf('VIRTUAL') and not hasattr(corp, 'spath') and nums == 'frq':
                raise IOError
            frq = array.array('i')
            frq.fromfile(open(filename), id_range)
        except exceptions.EOFError as ex:
            os.remove(filename.rsplit('.', 1)[0] + '.docf')
            os.remove(filename.rsplit('.', 1)[0] + '.arf')
            os.remove(filename.rsplit('.', 1)[0] + '.frq')
            raise MissingSubCorpFreqFile(corp, ex)
        except IOError:
            try:
                frq = array.array('l')
                frq.fromfile(open(filename + '64'), id_range)
            except IOError as ex:
                if not hasattr(corp, 'spath') and nums == 'frq':
                    a = corp.get_attr(attrname)
                    frq.fromlist([a.freq(i) for i in range(a.id_range())])
                else:
                    raise MissingSubCorpFreqFile(corp, ex)
    return frq


def subc_keywords_onstr(sc, scref, attrname='word', wlminfreq=5, wlpat='.*',
                        wlmaxitems=100, simple_n=100, wlwords=None,
                        blacklist=None, include_nonwords=0, wlnums='frq'):
    f = frq_db(sc, attrname, wlnums)
    fref = frq_db(scref, attrname, wlnums)
    size = sum(f)
    size_ref = sum(fref)
    p = size_ref / size
    attr = sc.get_attr(attrname)
    attrref = scref.get_attr(attrname)
    if wlwords is None:
        wlwords = []
    if blacklist is None:
        blacklist = []

    items = []
    if not include_nonwords:
        nwre = sc.get_conf('NONWORDRE')
    else:
        nwre = ''
    try:
        gen = attr.regexp2ids(wlpat.strip(), 0, nwre)
    except TypeError:
        gen = attr.regexp2ids(wlpat.strip(), 0)
    while not gen.end():
        i = gen.next()
        w = attr.id2str(i)
        if f[i] < wlminfreq or (wlwords and w not in wlwords) \
                or (blacklist and w in blacklist):
            continue
        iref = attrref.str2id(w)
        fref_iref = (iref != -1 and fref[iref]) or 0
        if fref_iref == 0 or p * f[i] / fref[iref] > 1.0:
            rel = (f[i] * 1000000.0) / size
            relref = (fref_iref * 1000000.0) / size_ref
            score = (rel + simple_n) / (relref + simple_n)
            items.append((score, rel, relref, i, iref, f[i], fref_iref, w))
    items.sort(reverse=True)
    return items[:wlmaxitems]
