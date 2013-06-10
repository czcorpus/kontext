#!/usr/bin/python
# -*- coding: utf-8 -*-
# Copyright (c) 2003-2010  Pavel Rychly
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

import locale
import os.path
import sys
import glob
from types import UnicodeType
from hashlib import md5

import manatee


class CorpusManager:
    def __init__(self, corplist=['susanne'], subcpath=[], gdexpath=[]):
        self.corplist = corplist
        self.subcpath = subcpath
        self.gdexdict = dict(gdexpath)

    def default_subcpath(self, corp):
        if type(corp) is not manatee.Corpus:
            corp = self.get_Corpus(corp)
        if corp.get_conf('SUBCBASE'):
            return corp.get_conf('SUBCBASE')
        cpath = corp.get_conf('PATH')
        return os.path.join(cpath, 'subcorp')

    def get_Corpus(self, corpname, subcname=''):
        if ':' in corpname:
            corpname, subcname = corpname.split(':', 1)
        corp = manatee.Corpus(corpname)
        manatee.setEncoding(corp.get_conf('ENCODING'))
        corp.corpname = str(corpname) # never unicode (paths)
        corp.cm = self
        dsubcpath = self.default_subcpath(corp)
        if subcname:
            for sp in self.subcpath + [dsubcpath]:
                if sp == dsubcpath:
                    spath = os.path.join(sp, subcname + '.subc')
                else:
                    spath = os.path.join(sp, corpname, subcname + '.subc')
                if type(spath) == unicode:
                    spath = spath.encode("utf-8")
                if os.path.isfile(spath):
                    subc = manatee.SubCorpus(corp, spath)
                    subc.corp = corp
                    subc.spath = spath
                    try:
                        open(spath[:-4] + 'used', 'w')
                    except:
                        pass
                    subc.corpname = str(corpname) # never unicode (paths)
                    subc.subcname = subcname
                    subc.cm = self
                    subc.subchash = md5(open(spath).read()).digest()
                    return subc
            raise RuntimeError(_('Subcorpus "%s" not found') % subcname)
        else:
            return corp

    def findPosAttr(self, corpname, attrname):
        return manatee.findPosAttr(corpname.split(':', 1)[0], attrname)

    def corpconf_pairs(self, corp, label):
        if type(corp) is UnicodeType:
            corp = self.get_Corpus(corp)
        val = corp.get_conf(label)
        if len(val) > 2:
            val = val[1:].split(val[0])
        else:
            val = ''
        return [val[i:i + 2] for i in range(0, len(val), 2)]

    def corplist_with_names(self, paths, use_db_whitelist=True):
        """
        Parameters
        ----------
        paths : list of dicts ('id' -> ?, 'path' -> ?, 'sentence_struct' -> ?)
            data from corpora hierarchy XML

        current_corp_encoding : str
            text encoding used in currently selected corpus

        use_db_witelist : bool
            if True then access is limited according to the data (specified per user)
            found in the database
        """
        simple_names = []
        subdir_map = {}

        for c in self.corplist:
            tmp = c.rsplit('/', 1)
            if len(tmp) == 2:
                simple_names.append(tmp[1])
                subdir_map[tmp[1]] = '%s/' % tmp[0]
            else:
                simple_names.append(tmp[0])
                subdir_map[tmp[0]] = ''
        cl = []
        # we have to store current encoding because each instantiated
        # corpus requires that the encoding is set via the manatee module
        # function setEncoding() which messes up all currently instantiated
        # corpora with different encodings...
        orig_encoding = manatee.getEncoding()
        for item in paths:
            c, path, web = item['id'], item['path'], item['sentence_struct']
            if c in simple_names or not use_db_whitelist:
                id_prefix = subdir_map[c] if c in subdir_map else ''
                corp_name = '?'
                try:
                    corp = manatee.Corpus(c)
                    manatee.setEncoding(corp.get_conf('ENCODING'))
                    corp_name = corp.get_conf('NAME') or c
                    size = _('%s positions') % locale.format('%d', corp.size(), grouping=True).decode('utf-8')
                    corp_info = corp.get_info()


                    cl.append({'id': '%s%s' % (id_prefix, c),
                               'name': corp_name,
                               'desc': corp_info,
                               'size': size,
                               'path': path
                    })
                except Exception, e:
                    manatee.setEncoding(orig_encoding)
                    import logging
                    logging.getLogger(__name__).warn('Failed to fetch info about %s with error %s (%s)'
                                                     % (corp_name, type(e).__name__, e))
                    cl.append({'id': '%s%s' % (id_prefix, c), 'name': c, 'path': path, 'desc': '', 'size': ''})
        manatee.setEncoding(orig_encoding)
        return cl

    def subcorpora(self, corpname):
        # we must encode for glob.glob otherwise it fails for non-ascii files
        enc_corpname = corpname.encode("utf-8")
        subc = []
        for sp in self.subcpath:
            subc += glob.glob(os.path.join(sp, enc_corpname, '*.subc'))
        subc += glob.glob(os.path.join(self.default_subcpath(corpname).encode("utf-8"), '*.subc'))
        return sorted(subc)

    def subcorp_names(self, corpname):
        return [{'n': os.path.splitext(os.path.basename(s))[0]}
                for s in self.subcorpora(corpname)]

    def last_subcorp_names(self, corpname, maxitems=25):

        subc = [os.path.isfile(c[:-4] + 'used') and c[:-4] + 'used' or c
                for c in self.subcorpora(corpname)]
        subc = [(os.stat(c).st_ctime, c) for c in subc]
        subc.sort(reverse=True)
        return [{'n': os.path.splitext(os.path.basename(s))[0]}
                for t, s in subc[:maxitems]]

    def find_same_subcorp_file(self, subcorp, wanted_infix,
                               wanted_suff=('arf', 'frq', 'docf')):
        basedir = os.path.dirname(self.subcpath[0].rstrip('/'))
        scpath = subcorp.spath
        scsize = os.path.getsize(scpath)
        scdata = open(scpath).read()

        subc_dir = '%s/*/%s/*.subc' % (basedir, subcorp.corpname)
        if type(subc_dir) == unicode:
            subc_dir = subc_dir.encode('utf-8')
        if type(scpath) == unicode:
            scpath = scpath.encode('utf-8')
        if type(wanted_infix) == unicode:
            wanted_infix = wanted_infix.encode('utf-8')

        for f in glob.glob(subc_dir):
            if f == scpath:
                continue
            if os.path.getsize(f) != scsize:
                continue
            f_no_suff = (f.decode('utf-8')[:-4]).encode('utf-8')

            if [s for s in wanted_suff if not os.path.isfile(f_no_suff + wanted_infix + '.' + s)]:
                continue
                # now, f has same size and all wanted suffixes exist
            if open(f).read() == scdata:
                return f
        return None


def ws_subc_freq(wmap3, corp):
    if hasattr(corp, 'spath'):
        fs = wmap3.poss()
        fs2 = corp.filter_fstream(fs)
        return corp.count_rest(fs2)
    return wmap3.getcnt()


def ws_find_triple(wmap1, id1, id2, id3):
    # WARNING: ids has to be bigger than the current position in wmap
    if not wmap1.findid(id1):
        return None
    wmap2 = wmap1.nextlevel()
    if not wmap2.findid(id2):
        return None
    wmap3 = wmap2.nextlevel()
    if not wmap3.findid(id3):
        return None
    return wmap3


def add_block_items(items, attr='class', val='even', block_size=3):
    for i in [i for i in range(len(items)) if (i / block_size) % 2]:
        items[i][attr] = val
    return items


def wordlist(corp, words=[], wlattr='', wlpat='', wlminfreq=5, wlmaxitems=100,
             wlsort='', blacklist=[], wlnums='frq', include_nonwords=0):
    blacklist = set(blacklist)
    words = set(words)
    attr = corp.get_attr(wlattr)
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
    items = []
    if words and wlpat == '.*':  # word list just for given words
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
            if word and frq >= wlminfreq and (not blacklist
                                              or word not in blacklist):
                if wlnums == 'arf':
                    items.append((round(frq, 1), word))
                else:
                    items.append((frq, word))
    else:  # word list according to pattern
        if not include_nonwords:
            nwre = corp.get_conf('NONWORDRE')
        else:
            nwre = ''
        try:
            gen = attr.regexp2ids(wlpat.strip(), 0, nwre)
        except TypeError:
            gen = attr.regexp2ids(wlpat.strip(), 0)
        while not gen.end():
            if wlsort == 'f':
                if len(items) > 5 * wlmaxitems:
                    items.sort()
                    del items[:-wlmaxitems]
            else:
                if len(items) >= wlmaxitems:
                    break
            id = gen.next()
            frq = attrfreq[id]
            if not frq: continue
            if frq >= wlminfreq and (not words or attr.id2str(id) in words) \
                and (not blacklist or attr.id2str(id) not in blacklist):
                if wlnums == 'arf':
                    items.append((round(frq, 1), id))
                else:
                    items.append((frq, id))
    if wlsort == 'f':
        items.sort()
        del items[:-wlmaxitems]
        items.reverse()
    if not words or wlpat != '.*':
        items = [(f, attr.id2str(i)) for (f, i) in items]
    return add_block_items([{'str': w, 'freq': f}
                            for f, w in items])


def doc_sizes(corp, struct, attrname, i, normvals):
    r = corp.filter_query(struct.attr_val(attrname.split('.')[1], i))
    cnt = 0
    while not r.end():
        cnt += normvals[r.peek_beg()]
        r.next()
    return cnt


def attr_vals(corpname, avattr, avpattern, avmaxitems=20):
    attr = manatee.findPosAttr(corpname, avattr)
    gen = attr.regexp2ids('.*%s.*' % avpattern.strip(), True)
    items = []
    while not gen.end() and avmaxitems > 0:
        items.append(attr.id2str(gen.next()))
        avmaxitems -= 1
    if not items:
        return "{query:'%s',suggestions:['%s']}" % (avpattern, '--nothing found--')
    return "{query:'%s',suggestions:[%s]}" % \
           (avpattern, ','.join(["'" + item + "'" for item in items]))


def texttype_values(corp, subcorpattrs, maxlistsize, list_all=False):
    """
    Parameters
    ----------
    corp : manatee.Corpus

    subcorpattrs : ??

    maxlistsize : int
            in case there is more that this number of items, empty list will be returned

    list_all : bool
            if True then non-empty lists are always returned

    Returns
    -------
    a list containing following dictionaries
    { 'Line' : [
        { 'attr_doc_label' : '', 'Values' : [ {'v', 'item name'}, ... ], 'name' : '', 'attr_doc' : '', 'label' : '' },
        { 'attr_doc_label' : '', 'Values' : [ {'v', 'item name'}, ... ], 'name' : '', 'attr_doc' : '', 'label' : '' },
        ...
    ]}
    """
    if subcorpattrs == '#': return []
    attrlines = []
    for subcorpline in subcorpattrs.split(','):
        attrvals = []
        for n in subcorpline.split('|'):
            if n in ('', '#'):
                continue
            attr = corp.get_attr(n)
            attrval = {'name': n,
                       'label': corp.get_conf(n + '.LABEL') or n,
                       'attr_doc': corp.get_conf(n + '.ATTRDOC'),
                       'attr_doc_label': corp.get_conf(n + '.ATTRDOCLABEL'),
            }
            vals = []
            hsep = corp.get_conf(n + '.HIERARCHICAL')
            multisep = corp.get_conf(n + '.MULTISEP')
            if not hsep and not list_all \
                and (corp.get_conf(n + '.TEXTBOXLENGTH')
                     or attr.id_range() > maxlistsize):
                attrval['textboxlength'] = (corp.get_conf(n + '.TEXTBOXLENGTH')
                                            or 24)
            else: # list of values
                if corp.get_conf(n + '.NUMERIC'):
                    vals = []
                    for i in range(attr.id_range()):
                        try:
                            vals.append({'v': int(attr.id2str(i))})
                        except:
                            vals.append({'v': attr.id2str(i)})
                elif hsep: # hierarchical
                    vals = [{'v': attr.id2str(i)}
                            for i in range(attr.id_range())
                            if not multisep in attr.id2str(i)]
                else:
                    vals = [{'v': attr.id2str(i)}
                            for i in range(attr.id_range())]
                if hsep: # hierarchical
                    attrval['hierarchical'] = hsep
                    attrval['Values'] = get_attr_hierarchy(vals, hsep, multisep)
                else:
                    attrval['Values'] = sorted(vals, cmp=lambda x, y: cmp(x['v'].lower(), y['v'].lower()))
            attrvals.append(attrval)
        attrlines.append({'Line': attrvals})
    return attrlines


def get_attr_hierarchy(vals, hsep, multisep):
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
    return print_attr_hierarchy(result, hsep=hsep)


def print_attr_hierarchy(layer, level=0, label='', hsep='::'):
    if not layer: return []
    result = []
    if level > 0:
        startdiv = True
    else:
        startdiv = False
    for item in sorted(layer):
        sub = print_attr_hierarchy(layer[item], level + 1, label + hsep + item, hsep)
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
    if level > 0: result[-1]['enddiv'] += 1
    return result


def subc_freqs(subcorp, attr, minfreq=50, maxfreq=10000, last_id=None):
    return [(i, subcorp.count_rest(attr.id2poss(i)))
            for i in xrange(last_id or attr.id_range())
            if maxfreq > attr.freq(i) > minfreq]


def subc_keywords1(subcorp, attr, minfreq=50, maxfreq=10000):
    p = (subcorp.size() - subcorp.search_size()) / float(subcorp.search_size())
    freqs = [(float(f) / (attr.freq(i) - f + 1) * p, f, i)
             for (i, f) in subc_freqs(subcorp, attr, minfreq, maxfreq,
                                      attr.id_range() / 1000)]
    #freqs.sort()
    #del freqs[:-maxitems]
    return freqs


def subc_keywords(subcorp, attr, minfreq=50, maxfreq=10000, last_id=10000,
                  maxitems=100):
    p = (subcorp.size() - subcorp.search_size()) / float(subcorp.search_size())
    candidates = []
    for i in xrange(last_id or attr.id_range()):
        if not (maxfreq > attr.freq(i) > minfreq):
            continue
        freq = subcorp.count_rest(attr.id2poss(i))
        if freq < 3:
            continue
        arf = subcorp.count_ARF(attr.id2poss(i), freq)
        score = arf / (attr.freq(i) - arf + 1) * p
        #if score < 2.0:
        #    continue
        candidates.append((score, arf, freq, i))
    candidates.sort()
    del candidates[:-maxitems]
    return candidates


def subcorp_base_file(corp, attrname):
    """
    Returns
    -------
    path : str
        subcorpus path as a 8-bit string (i.e. unicode paths are encoded)
    """
    if hasattr(corp, 'spath'):
        ans = corp.spath.decode('utf-8')[:-4] + attrname
    else:
        ans = corp.get_conf('PATH') + attrname
    return ans.encode('utf-8')


class MissingSubCorpFreqFile(Exception):
    pass


def frq_db(corp, attrname, nums='frq'):
    import array

    filename = (subcorp_base_file(corp, attrname).decode('utf-8') + '.' + nums).encode('utf-8')
    if nums == 'arf':
        frq = array.array('f')
        try:
            frq.fromfile(open(filename), corp.get_attr(attrname).id_range())
        except IOError:
            raise MissingSubCorpFreqFile(corp)
    else:
        try:
            frq = array.array('i')
            frq.fromfile(open(filename), corp.get_attr(attrname).id_range())
        except IOError:
            try:
                frq = array.array('l')
                frq.fromfile(open(filename + '64'), corp.get_attr(attrname).id_range())
            except IOError:
                if not hasattr(corp, 'spath') and nums == 'frq':
                    a = corp.get_attr(attrname)
                    frq.fromlist([a.freq(i) for i in xrange(a.id_range())])
                else:
                    raise MissingSubCorpFreqFile(corp)
    return frq


def subc_keywords3(sc, scref, attrname, minarf=10, maxitems=100):
    f = frq_db(sc, attrname)
    fref = frq_db(scref, attrname)
    p = sum(fref) / sum(f)
    attr = sc.get_attr(attrname)
    items = [(p * (f[i] + 1) / (fref[i] + 1), i)
             for i in xrange(attr.id_range())
             if f[i] >= minarf and (fref[i] == 0 or p * f[i] / fref[i] > 2.0)
    ]
    items.sort(reverse=True)
    del items[maxitems:]
    fsf = frq_db(sc, attrname)
    fcf = frq_db(scref, attrname)
    return [(s, attr.id2str(i), f[i], fref[i], fsf[i], fcf[i], i)
            for s, i in items]


def subc_keywords_onstr(sc, scref, attrname='word', wlminfreq=5, wlpat='.*',
                        wlmaxitems=100, simple_n=100, wlwords=[],
                        blacklist=[], include_nonwords=0, wlnums='frq'):
    f = frq_db(sc, attrname, wlnums)
    fref = frq_db(scref, attrname, wlnums)
    size = sum(f)
    size_ref = sum(fref)
    p = size_ref / size
    attr = sc.get_attr(attrname)
    attrref = scref.get_attr(attrname)
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


def create_ws_db(corp, logfilename):
    import subprocess

    basewsbase = os.path.basename(corp.get_conf('WSBASE'))
    freqs_file = subcorp_base_file(corp, basewsbase + '.hfrq')
    lex_file = subcorp_base_file(corp, basewsbase + '.hlex')
    logfile = open(logfilename, 'w')
    hashws_args = ['hashws', corp.get_conffile(), freqs_file, lex_file]
    if hasattr(corp, 'spath'):
        hashws_args.append(corp.spath)
    ret = subprocess.call(hashws_args, stdout=logfile)
    if ret:
        open(logfilename + '.error', 'w').write(str(ret))
    logfile.close()
    os.rename(logfilename, logfilename + '.old')


def create_arf_db(corp, attrname, logfile=None, logstep=0.02):
    outfilename = subcorp_base_file(corp, attrname)
    if os.path.isfile(outfilename + '.arf') and os.path.isfile(outfilename
            + '.docf'):
        return
    if hasattr(corp, 'spath'):
        sys.stderr.write('trying find_same_subcorp_file: %s\n' % outfilename)
        same = corp.cm.find_same_subcorp_file(corp, attrname,
                                              ('arf', 'frq', 'docf', 'build.old'))
        sys.stderr.write('find_same_subcorp_file: %s\n' % same)
        if same:
            same = same[:-4] + attrname
            from shutil import copyfile

            for suff in ('.arf', '.frq', '.frq64', '.docf'):
                copyfile(same + suff, outfilename + suff)
            return

    import array

    outarf = array.array('f')
    outfrq = array.array('i')
    outdocf = array.array('i')
    frqsize = {'i': "", 'l': "64"}
    attr = corp.get_attr(attrname)
    doc = corp.get_struct(corp.get_conf('DOCSTRUCTURE'))
    if logfile:
        toprocessids = float(attr.id_range())
        nextidslog = logstep * toprocessids
        open(logfile, 'w').write('%d\n%s\n0%%' %
                                 (os.getpid(), corp.search_size()))
    for i in xrange(attr.id_range()):
        rs = corp.filter_query(doc.whole())
        freq = corp.count_rest(attr.id2poss(i))
        arf = corp.count_ARF(attr.id2poss(i), freq)
        docf = corp.compute_docf(attr.id2poss(i), rs)
        try:
            outfrq.append(freq)
        except OverflowError:
            outfrq = array.array('l', outfrq)
            outfrq.append(freq)
        outarf.append(arf)
        outdocf.append(docf)
        if logfile:
            if i >= nextidslog:
                open(logfile, 'a').write('\n%s%%' %
                                         round((i / toprocessids) * 100))
                nextidslog += logstep * toprocessids
    if logfile:
        open(logfile, 'a').write('\n100%')
    outarf.tofile(open(outfilename + '.arf.tmp', 'wb'))
    outfrq.tofile(open(outfilename + '.frq.tmp', 'wb'))
    outdocf.tofile(open(outfilename + '.docf.tmp', 'wb'))
    os.rename(outfilename + '.arf.tmp', outfilename + '.arf')
    os.rename(outfilename + '.frq.tmp', outfilename + '.frq' +
                                        frqsize[outfrq.typecode])
    os.rename(outfilename + '.docf.tmp', outfilename + '.docf')
    if logfile:
        open(logfile, 'a').write('\nfreq:%s\narf:%s\ndocf:%s' %
                                 (sum(outfrq), sum(outarf), sum(outdocf)))
        os.rename(logfile, logfile + '.old')


def build_arf_db(corp, attrname):
    logfilename = subcorp_base_file(corp, attrname) + '.build'
    if os.path.isfile(logfilename):
        log = open(logfilename).read().split('\n')
        return log[0], log[-1].split('\r')[-1]

    tmp = 'build_arf_db:%s:%s (%s)\n' % (corp, attrname, logfilename.decode('utf-8'))
    sys.stderr.write(tmp.encode('utf-8'))

    pid = os.fork()
    if pid == 0:
        import daemonize
        # close only std{in,out,err}
        daemonize.createDaemon(maxfd=3)
        if hasattr(os, 'nice'):
            os.nice(10)
        if attrname == 'hashws':
            create_ws_db(corp, logfilename)
        else:
            create_arf_db(corp, attrname, logfilename)
        os._exit(0)
    else:
        return None


def build_arf_db_status(corp, attrname):
    logfilename = subcorp_base_file(corp, attrname) + '.build'
    if os.path.isfile(logfilename):
        log = open(logfilename).read().split('\n')
        return log[0], log[-1].split('\r')[-1]
    else:
        return 0, '100%'


if __name__ == '__main__':
    import manatee

    if sys.argv[2:] and sys.argv[1] == '--create-arf-db':
        # ./corplib.py --create-arf-db CORPNAME [ATTRNAME]
        corp = manatee.Corpus(sys.argv[2])
        if sys.argv[3:]:
            attrnames = [sys.argv[3]]
        else:
            attrnames = corp.get_conf('ATTRLIST').split(',')
        for attrn in attrnames:
            print 'Creating ARF database:', sys.argv[2], attrn
            create_arf_db(corp, attrn)
    else:
        cm = CorpusManager(subcpath=['/home/pary/corp/run/subcorp/GLOBAL'])
        os.environ['MANATEE_REGISTRY'] = '/home/pary/corp/registry'
        c = cm.get_Corpus('bnc:written')
        sc = cm.get_Corpus('bnc:academic')
