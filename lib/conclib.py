#!/usr/bin/env python
# Copyright (c) 2003-2009  Pavel Rychly
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import os
from sys import stderr
import time
import math
from functools import partial

import manatee
import settings
from butils import *
from strings import import_string, export_string, escape
from kwiclib import tokens2strclass, lngrp_sortstr
from translation import ugettext as _

try:
    import fcntl
except ImportError:
    try:
        import msvcrt
    except ImportError:
        # no locking available, dummy defs
        flck_sh_lock = flck_ex_lock = flck_unlock = lambda f: None
    else:
        # Windows: msvcrt.locking
        def flck_sh_lock(file):
            file.seek(0)
            msvcrt.locking(file.fileno(), msvcrt.LK_LOCK, 1)
        flck_ex_lock = flck_sh_lock

        def flck_unlock(file):
            file.seek(0)
            msvcrt.locking(file.fileno(), msvcrt.LK_UNLCK, 1)
else:
    # UNIX: fcntl.lockf
    def flck_sh_lock(file):
        fcntl.lockf(file, fcntl.LOCK_SH, 1, 0, 0)

    def flck_ex_lock(file):
        fcntl.lockf(file, fcntl.LOCK_EX, 1, 0, 0)

    def flck_unlock(file):
        fcntl.lockf(file, fcntl.LOCK_UN, 1, 0, 0)

try:
    _
except NameError:
    _ = lambda s: s


class PyConc(manatee.Concordance):
    selected_grps = []

    def __init__(self, corp, action, params, sample_size=0, full_size=-1,
                 orig_corp=None, corpus_encoding='iso-8859-2'):
        self.pycorp = corp
        self.corpname = corp.get_conffile()
        self.orig_corp = orig_corp or self.pycorp
        self.corpus_encoding = corpus_encoding
        self.import_string = partial(import_string, from_encoding=self.corpus_encoding)
        self.export_string = partial(export_string, to_encoding=self.corpus_encoding)

        if action == 'q':
            params = self.export_string(params)
            manatee.Concordance.__init__(
                self, corp, params, sample_size, full_size)
        elif action == 'a':
            # query with a default attribute
            default_attr, query = params.split(',', 1)
            corp.set_default_attr(default_attr)
            manatee.Concordance.__init__(
                self, corp, self.export_string(query), sample_size, full_size)
        elif action == 'l':
            # load from a file
            manatee.Concordance.__init__(self, corp, params)
        elif action == 's':
            # stored in _conc_dir
            manatee.Concordance.__init__(self, corp,
                                         os.path.join(self.pycorp._conc_dir,
                                                      corp.corpname,
                                                      params + '.conc'))
        else:
            raise RuntimeError(_('Unknown action: %s') % action)

    def command_g(self, options):
        # sort according to linegroups
        annot = get_stored_conc(self.pycorp, options, self.pycorp._conc_dir)
        self.set_linegroup_from_conc(annot)
        lmap = annot.labelmap
        lmap[0] = None
        ids = manatee.IntVector(map(int, lmap.keys()))
        strs = manatee.StrVector(map(lngrp_sortstr, lmap.values()))
        self.linegroup_sort(ids, strs)

    def command_e(self, options):
        # sort first k lines using GDEX
        try:
            import gdex
        except ImportError:
            import gdex_old as gdex
        args = options.split(' ', 1)
        if len(args) == 2:
            conf = args[1]
        else:
            conf = ''
        cnt = int(args[0]) or 100
        best = gdex.GDEX(self.pycorp, conf)
        best.entryConc(self)
        best_lines = manatee.IntVector([i for s, i
                                        in best.best_k(cnt, cnt)])
        self.set_sorted_view(best_lines)

    def command_s(self, options):
        if options[0] == '*':
            # old GDEX, used command_e, should be deleted in mid 2011
            self.command_e(options[1:])
        else:
            self.sort(options)

    def command_a(self, options):
        annotname, options = options.split(' ', 1)
        annot = get_stored_conc(self.pycorp, annotname, self.pycorp._conc_dir)
        self.set_linegroup_from_conc(annot)
        if options[0] == '-':
            self.delete_linegroups(options[1:], True)
        else:
            self.delete_linegroups(options, False)

    def command_d(self, options):
        self.delete_lines(options)

    def command_f(self, options):
        self.shuffle()

    def command_r(self, options):
        self.reduce_lines(options)

    def command_x(self, options):
        if options[0] == '-':
            self.switch_aligned(self.orig_corp.get_conffile())
            self.add_aligned(options[1:])
            self.switch_aligned(options[1:])
            self.corpname = options[1:]
        else:
            self.swap_kwic_coll(int(options))

    def command_n(self, options):
        self.pn_filter(options, 0)

    def command_p(self, options):
        self.pn_filter(options, 1)

    def command_N(self, options):
        self.pn_filter(options, 0, True)

    def command_P(self, options):
        self.pn_filter(options, 1, True)

    def pn_filter(self, options, ispositive, excludekwic=False):
        lctx, rctx, rank, query = options.split(None, 3)
        collnum = self.numofcolls() + 1
        self.set_collocation(collnum, self.export_string(query) + ';', lctx, rctx, int(rank),
                             excludekwic)
        self.delete_pnfilter(collnum, ispositive)

    @staticmethod
    def add_block_items(items, attr='class', val='even', block_size=3):
        for i in [i for i in range(len(items)) if (i / block_size) % 2]:
            items[i][attr] = val
        return items

    def get_attr_values_sizes(self, full_attr_name):
        """
        Returns all values of provided structural attribute and their corresponding sizes in positions.

        Parameters
        ----------
        full_attr_name : str
           Fully qualified structural attribute name (e.g. "opus.srclang", "doc.id" etc.). Method allows
           this name to be suffixed if this suffix starts with at least one whitespace. In such case
           the suffix is ignored.

        Returns
        -------
        dictionary (key = "structural attribute value" and value = "size in positions")
        """
        full_attr_name = re.split(r'\s+', full_attr_name)[0]
        struct_name, attr_name = full_attr_name.split('.')
        struct = self.pycorp.get_struct(struct_name)
        attr = struct.get_attr(attr_name)
        normvals = dict([(struct.beg(
            i), struct.end(i) - struct.beg(i)) for i in range(struct.size())])
        ans = {}
        for i in range(attr.id_range()):
            value = attr.id2str(i)
            valid = attr.str2id(self.import_string(value))
            r = self.pycorp.filter_query(struct.attr_val(attr_name, valid))
            cnt = 0
            while not r.end():
                cnt += normvals[r.peek_beg()]
                r.next()
            ans[value] = cnt
        return ans

    def xfreq_dist(self, crit, limit=1, sortkey='f', normwidth=300, ml='',
                   ftt_include_empty='', rel_mode=0):
        """
        Calculates data (including data for visual output) of a frequency distribution
        specified by the 'crit' parameter

        Parameters
        ----------
        crit : str
            CQL specified criteria
        limit : str
            minimal frequency accepted, this value is exclusive! (i.e. accepted values must be
            greater than the limit)
        sortkey : str
            a key according to which the distribution will be sorted
        normwidth : int
            specifies width of the bar representing highest frequency
        ml : str
            if non-empty then multi-level freq. distribution is generated
        ftt_include_empty : str
            TODO
        rel_mode : {0, 1}
            TODO
        """

        # ml = determines how the bar appears (multilevel x text type)
        # import math
        normheight = 15

        def compute_corrections(freqs, norms):
            from operator import add
            sumn = float(reduce(add, norms))
            if sumn == 0:
                return float(normwidth) / max(freqs), 0
            else:
                sumf = float(reduce(add, freqs))
                corr = min(sumf / max(freqs), sumn / max(norms))
                return normwidth / sumf * corr, normwidth / sumn * corr

        words = manatee.StrVector()
        freqs = manatee.NumVector()
        norms = manatee.NumVector()
        self.pycorp.freq_dist(self.RS(), crit, limit, words, freqs, norms)
        if not len(freqs):
            return {}
        # now we intentionally rewrite norms as filled in by freq_dist()
        # because of "hard to explain" metrics they lead to
        if rel_mode == 0:
            norms2_dict = self.get_attr_values_sizes(crit)
            norms = [norms2_dict[x] for x in words]
            sumn = float(self.pycorp.size())
        elif rel_mode == 1:
            sumn = float(sum([x for x in norms]))
        sumf = float(sum([x for x in freqs]))
        attrs = crit.split()

        def label(attr):
            if '/' in attr:
                attr = attr[:attr.index('/')]
            return self.pycorp.get_conf(attr + '.LABEL') or attr
        head = [{'n': label(attrs[x]), 's': x / 2}
                for x in range(0, len(attrs), 2)]
        head.append({'n': _('Freq'), 's': 'freq'})

        tofbar, tonbar = compute_corrections(freqs, norms)
        if tonbar and not ml:
            maxf = max(freqs)  # because of bar height
            minf = min(freqs)
            maxrel = 0
            # because of bar width
            for index, (f, nf) in enumerate(zip(freqs, norms)):
                if nf == 0:
                    nf = 100000
                    norms[index] = 100000
                newrel = (f * tofbar / (nf * tonbar))
                if maxrel < newrel:
                    maxrel = newrel
            if rel_mode == 0:
                head.append({'n': 'i.p.m.', 'title': _(
                    'instances per million (refers to the respective category)'), 's': 'rel'})
            else:
                head.append({'n': 'Freq [%]', 'title': '', 's': 'rel'})

            lines = []
            for w, f, nf in zip(words, freqs, norms):
                w = self.import_string(w)
                rel_norm_freq = {
                    0: round(f * 1e6 / nf, 1),
                    1: round(f / sumf * 100, 1)
                }[rel_mode]

                rel_bar = {
                    0: 1 + int(f * tofbar * normwidth / (nf * tonbar * maxrel)),
                    1: 1 + int(float(f) / maxf * normwidth)
                }[rel_mode]

                freq_bar = {
                    0: int(normheight * (f - minf + 1) / (maxf - minf + 1) + 1),
                    1: 10
                }[rel_mode]

                lines.append({
                    'Word': [{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                    'freq': f,
                    'fbar': int(f * tofbar) + 1,
                    'norm': nf,
                    'nbar': int(nf * tonbar),
                    'relbar': rel_bar,
                    'norel': ml,
                    'freqbar': freq_bar,
                    'rel': rel_norm_freq
                })
        else:
            lines = []
            for w, f, nf in zip(words, freqs, norms):
                w = self.import_string(w)
                lines.append({
                    'Word': [{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                    'freq': f, 'fbar': int(f * tofbar) + 1,
                    'norel': 1
                })

        if ftt_include_empty and limit == 0 and '.' in attrs[0]:
            attr = self.pycorp.get_attr(attrs[0])
            all_vals = [attr.id2str(i) for i in range(attr.id_range())]
            used_vals = [line['Word'][0]['n'] for line in lines]
            for v in all_vals:
                if v in used_vals:
                    continue
                lines.append({
                    'Word': [{'n': v}],
                    'freq': 0,
                    'rel': 0,
                    'norm': 0,
                    'nbar': 0,
                    'relbar': 0,
                    'norel': ml,
                    'freq': 0,
                    'freqbar': 0,
                    'fbar': 0,
                })

        if (sortkey in ('0', '1', '2')) and (int(sortkey) < len(lines[0]['Word'])):
            sortkey = int(sortkey)
            lines = [(x['Word'][sortkey]['n'], x) for x in lines]
            lines.sort()
        else:
            if sortkey not in ('freq', 'rel'):
                sortkey = 'freq'
            lines = [(x[sortkey], x) for x in lines]
            lines.sort()
            lines.reverse()

        return {'Head': head,
                'Items': self.add_block_items([x[1] for x in lines], block_size=2)}

    def xdistribution(self, xrange, yrange):
        """
        TODO: no direct call found for this
        """
        begs = manatee.IntVector(xrange)
        vals = manatee.IntVector(xrange)
        self.distribution(vals, begs, yrange)
        return zip(vals, begs)

    def collocs(self, cattr='-', csortfn='m', cbgrfns='mt',
                cfromw=-5, ctow=5, cminfreq=5, cminbgr=3, from_idx=0, max_lines=50):
        statdesc = {'t': 'T-score',
                    'm': 'MI',
                    '3': 'MI3',
                    'l': 'log likelihood',
                    's': 'min. sensitivity',
                    'p': 'MI.log_f',
                    'r': 'relative freq. [%]',
                    'f': 'absolute freq.',
                    'd': 'logDice',
                    }

        items = []
        colls = manatee.CollocItems(self, cattr, csortfn, cminfreq, cminbgr,
                                    cfromw, ctow, 2 ** 29)
        qfilter = '%%s%i %i 1 [%s="%%s"]' % (cfromw, ctow, cattr)
        i = 0
        while not colls.eos():
            if from_idx <= i < from_idx + max_lines:
                items.append(
                    {'str': colls.get_item(), 'freq': colls.get_cnt(),
                     'Stats': [{'s': '%.3f' % colls.get_bgr(s)}
                               for s in cbgrfns],
                     'pfilter': qfilter % ('P', escape(self.import_string(colls.get_item()))),
                     'nfilter': qfilter % ('N', escape(self.import_string(colls.get_item())))
                     })
            colls.next()
            i += 1

        head = [{'n': ''}, {'n': 'Freq', 's': 'f'}] \
            + [{'n': statdesc.get(s, s), 's': s} for s in cbgrfns]
        return {
            'Head': head,
            'Items': self.add_block_items(items),
            'Total': i,
            'TotalPages': int(math.ceil(i / float(max_lines)))
        }

    def linegroup_info_select(self, selected_count=5):
        ids = manatee.IntVector()
        freqs = manatee.IntVector()
        self.get_linegroup_stat(ids, freqs)
        grps = [(f, i) for f, i in zip(freqs, ids) if i]
        grps.sort()
        grps = [i for f, i in grps[-5:]]
        grps.sort()
        self.selected_grps = [0] + grps
        return self.selected_grps

    def linegroup_info_subset(self, conc):
        # conc = manatee.Concordance (fstream)
        conc.sync()
        conc.set_linegroup_from_conc(self)
        if not conc.size():
            return 0, 0, [0] * (len(self.selected_grps) + 1)
        ids = manatee.IntVector()
        freqs = manatee.IntVector()
        conc.get_linegroup_stat(ids, freqs)
        info = dict(zip(ids, freqs))
        if not info:
            # no annotation
            return 0, 0, [0] * (len(self.selected_grps) + 1)
        hist = [info.get(i, 0) for i in self.selected_grps]
        hist.append(conc.size() - sum(hist))
        cnt, maxid = max(zip(freqs, ids))
        return maxid, (cnt / float(conc.size())), hist


def pos_ctxs(min_hitlen, max_hitlen, max_ctx=3):
    ctxs = [{'n': _('%iL') % -c, 'ctx': '%i<0' % c} for c in range(-
                                                                   max_ctx, 0)]
    if max_hitlen == 1:
        ctxs.append({'n': _('Node'), 'ctx': '0~0>0'})
    else:
        ctxs.extend([{'n': 'Node %i' % c, 'ctx': '%i<0' % c}
                    for c in range(1, max_hitlen + 1)])
    ctxs.extend([{'n': _('%iR') % c, 'ctx': '%i>0' % c}
                for c in range(1, max_ctx + 1)])
    return ctxs


def load_map(cache_dir):
    import cPickle
    try:
        f = open(cache_dir + '00CONCS.map', 'rb')
    except IOError:
        return {}
    try:
        flck_sh_lock(f)
        ret = cPickle.load(f)
        flck_unlock(f)
    except cPickle.UnpicklingError:
        os.rename(cache_dir + '00CONCS.map',
                  cache_dir + '00CONCS-broken-%d.map' % os.getpid())
        return {}
    return ret


def get_cached_conc_sizes(corp, q=[], cache_dir='cache', cachefile=None):
    import struct

    ans = {'finished': None, 'concsize': None, 'fullsize': None, 'relconcsize': None}

    if not cachefile:  # AJAX call
        q = tuple(q)
        subchash = getattr(corp, 'subchash', None)
        cache_dir = cache_dir + '/' + corp.corpname + '/'
        saved = load_map(cache_dir)
        cache_val = saved.get((subchash, q))
        if cache_val:
            cachefile = os.path.join(cache_dir, cache_val[0] + '.conc')

    if cachefile:
        cache = open(cachefile, 'rb')
        flck_sh_lock(cache)
        cache.seek(15)
        finished = str(ord(cache.read(1)))
        (fullsize,) = struct.unpack('q', cache.read(8))
        cache.seek(32)
        (concsize,) = struct.unpack('i', cache.read(4))
        flck_unlock(cache)

        if fullsize > 0:
            relconcsize = 1000000.0 * fullsize / corp.search_size()
        else:
            relconcsize = 1000000.0 * concsize / corp.search_size()

        ans['finished'] = finished
        ans['concsize'] = concsize
        ans['fullsize'] = fullsize
        ans['relconcsize'] = relconcsize

    return ans


def uniqname(key, used):
    name = '#'.join([''.join([c for c in w if c.isalnum()]) for w in key])
    name = name[1:15].encode("UTF-8")  # UTF-8 because os.path manipulations
    if not name:
        name = 'noalnums'
    if name in used:
        used = [w[len(name):] for w in used if w.startswith(name)]
        i = 0
        while str(i) in used:
            i += 1
        name += str(i)
    return name


def add_to_map(cache_dir, pid_dir, subchash, key, size):
    import cPickle
    kmap = pidfile = None
    try:
        f = open(cache_dir + '00CONCS.map', 'r+b')
    except IOError:
        f = open(cache_dir + '00CONCS.map', 'wb')
        kmap = {}
    flck_ex_lock(f)
    if kmap is None:
        kmap = cPickle.load(f)
    if (subchash, key) in kmap:
        ret, storedsize = kmap[subchash, key]
        if storedsize < size:
            kmap[subchash, key] = (ret, size)
            f.seek(0)
            cPickle.dump(kmap, f)
    else:
        ret = uniqname(key, [r for (r, s) in kmap.values()])
        kmap[subchash, key] = (ret, size)
        f.seek(0)
        cPickle.dump(kmap, f)
        pidfile = open(pid_dir + ret + ".pid", "w")
        pidfile.write(str(os.getpid()) + "\n")
        pidfile.flush()
    f.close()  # also automatically flck_unlock (f)
    if not pidfile:
        pidfile = pid_dir + ret + ".pid"
    return cache_dir + ret + ".conc", pidfile


def del_from_map(cache_dir, subchash, key):
    import cPickle
    try:
        f = open(cache_dir + '00CONCS.map', 'r+b')
    except IOError:
        return
    flck_ex_lock(f)
    kmap = cPickle.load(f)
    try:
        del kmap[subchash, key]
        f.seek(0)
        cPickle.dump(kmap, f)
    except KeyError:
        pass
    f.close()  # also automatically flck_unlock (f)


def wait_for_conc(corp, q, cachefile, pidfile, minsize):
    pidfile = os.path.realpath(pidfile)
    sleeptime = 1
    while True:
        if sleeptime % 5 == 0 and not is_conc_alive(pidfile):
            return
        try:
            sizes = get_cached_conc_sizes(corp, q, None, cachefile)
            if minsize == -1:
                if sizes["finished"] == 1:  # whole conc
                    return
            elif sizes["concsize"] >= minsize:
                return
        except:
            pass
        time.sleep(sleeptime * 0.1)
        sleeptime += 1


def is_conc_alive(pidfile):
    try:
        pid = open(pidfile).readline()[:-1]
        link = os.readlink("/proc/%s/fd/1" % pid)
        if link != pidfile:
            return False
    except:
        return False
    return True


def contains_shuffle_seq(q_ops):
    """
    Tests whether the provided query sequence contains a subsequence
    of 'shuffle' operation (e.g. on ['foo', 'bar', 'f', 'f', 'something'] returns True)
    """
    prev_shuffle = False
    for item in q_ops:
        if item == 'f':
            if prev_shuffle:
                return True
            else:
                prev_shuffle = True
        else:
            prev_shuffle = False
    return False


def get_cached_conc(corp, subchash, q, cache_dir, pid_dir, minsize):
    q = tuple(q)
    try:
        if not os.path.isdir(pid_dir):
            os.makedirs(pid_dir)
        if not os.path.isdir(cache_dir):
            os.makedirs(cache_dir)
        elif (os.stat(cache_dir + '00CONCS.map').st_mtime
              < os.stat(corp.get_conf('PATH') + 'word.text').st_mtime):
            os.remove(cache_dir + '00CONCS.map')
            for f in os.listdir(cache_dir):
                os.remove(cache_dir + f)
    except OSError:
        pass

    saved = load_map(cache_dir)
    if contains_shuffle_seq(q):
        srch_from = 1
    else:
        srch_from = len(q)

    for i in range(srch_from, 0, -1):
        cache_val = saved.get((subchash, q[:i]))
        if cache_val:
            cachefile = os.path.join(cache_dir, cache_val[0] + '.conc')
            pidfile = os.path.realpath(pid_dir + cache_val[0] + ".pid")
            wait_for_conc(corp, q, cachefile, pidfile, minsize)
            if not os.path.exists(cachefile):  # broken cache
                del_from_map(cache_dir, subchash, q)
                try:
                    os.remove(pidfile)
                except OSError:
                    pass
                continue
            conccorp = corp
            for qq in reversed(q[:i]):  # find the right main corp, if aligned
                if qq.startswith('x-'):
                    conccorp = manatee.Corpus(qq[2:])
                    break
            conc = PyConc(conccorp, 'l', cachefile, orig_corp=corp)
            if not is_conc_alive(pidfile) and not conc.finished():
                # unfinished and dead concordance
                del_from_map(cache_dir, subchash, q)
                try:
                    os.remove(cachefile)
                except OSError:
                    pass
                try:
                    os.remove(pidfile)
                except OSError:
                    pass
                continue
            return i, conc
    return 0, None


def compute_conc(corp, q, cache_dir, subchash, samplesize, fullsize, pid_dir):
    q = tuple(q)
    if q[0][0] == "R":  # online sample
        if fullsize == -1:  # need to compute original conc first
            q_copy = list(q)
            q_copy[0] = q[0][1:]
            q_copy = tuple(q_copy)
            conc = None
            cachefile, pidfile = add_to_map(cache_dir, pid_dir, subchash,
                                            q_copy, 0)
            if type(pidfile) != file:  # computation got started meanwhile
                wait_for_conc(corp, q, cachefile, pidfile, -1)
                fullsize = PyConc(corp, 'l', cachefile).fullsize()
            else:
                conc = PyConc(corp, q[0][1], q[0][2:], samplesize)
                conc.sync()
                conc.save(cachefile)
                # update size in map file
                add_to_map(cache_dir, pid_dir, subchash, q_copy, conc.size())
                fullsize = conc.fullsize()
                os.remove(pidfile.name)
                pidfile.close()
        return PyConc(corp, q[0][1], q[0][2:], samplesize, fullsize)
    else:
        return PyConc(corp, q[0][0], q[0][1:], samplesize)


def get_conc(corp, minsize=None, q=[], fromp=0, pagesize=0, async=0, save=0,
            cache_dir='cache', samplesize=0, debug=False):
    if not q:
        return None
    q = tuple(q)
    if not minsize:
        if len(q) > 1:  # subsequent concordance processing by its methods
                       # needs whole concordance
            minsize = -1
        else:
            minsize = fromp * pagesize
    cache_dir = cache_dir + '/' + corp.corpname + '/'
    pid_dir = cache_dir + "run/"
    subchash = getattr(corp, 'subchash', None)
    conc = None
    fullsize = -1
    # try to locate concordance in cache
    if save:
        toprocess, conc = get_cached_conc(
            corp, subchash, q, cache_dir, pid_dir,
                                          minsize)
        if toprocess == len(q):
            save = 0
        if not conc and q[0][0] == "R":  # online sample
            q_copy = list(q)
            q_copy[0] = q[0][1:]
            q_copy = tuple(q_copy)
            t, c = get_cached_conc(corp, subchash, q_copy, cache_dir,
                                    pid_dir, -1)
            if c:
                fullsize = c.fullsize()
    else:
        async = 0
    # cache miss or not used
    if not conc:
        toprocess = 1

        if async and len(q) == 1:  # asynchronous processing

            r, w = os.pipe()
            r, w = os.fdopen(r, 'r'), os.fdopen(w, 'w')
            if os.fork() == 0:  # child
                r.close()  # child writes
                title = "bonito concordance;corp:%s;action:%s;params:%s;" \
                        % (corp.get_conffile(), q[0][0], q[0][1:])
                setproctitle(title.encode("utf-8"))
                # close stdin/stdout/stderr so that the webserver closes
                # connection to client when parent ends
                os.close(0)
                os.close(1)
                os.close(2)
                # PID file will have fd 1
                pidfile = None
                try:
                    cachefile, pidfile = add_to_map(cache_dir, pid_dir,
                                                     subchash, q, 0)
                    if type(pidfile) != file:
                        # conc got started meanwhile by another process
                        w.write(cachefile + "\n" + pidfile)
                        w.close()
                        os._exit(0)
                    w.write(cachefile + "\n" + pidfile.name)
                    w.close()
                    conc = compute_conc(corp, q, cache_dir, subchash, samplesize,
                                        fullsize, pid_dir)
                    sleeptime = 0.1
                    time.sleep(sleeptime)
                    conc.save(cachefile, False, True)  # partial
                    while not conc.finished():
                        conc.save(
                            cachefile, False, True, True)  # partial + append
                        time.sleep(sleeptime)
                        sleeptime += 0.1
                    tmp_cachefile = cachefile + ".tmp"
                    conc.save(tmp_cachefile)  # whole
                    os.rename(tmp_cachefile, cachefile)
                    # update size in map file
                    add_to_map(cache_dir, pid_dir, subchash, q, conc.size())
                    os.remove(pidfile.name)
                    pidfile.close()
                    os._exit(0)
                except:
                    if not w.closed:
                        w.write("error\nerror")
                        w.close()
                    import traceback
                    if type(pidfile) == file:
                        traceback.print_exc(None, pidfile)
                        pidfile.close()
                    if debug:
                        err_log = open(pid_dir + "/debug.log", "a")
                        err_log.write(time.strftime("%x %X\n"))
                        traceback.print_exc(None, err_log)
                        err_log.close()
                    os._exit(0)
            else:  # parent
                w.close()  # parent reads
                cachefile, pidfile = r.read().split("\n")
                r.close()
                wait_for_conc(corp, q, cachefile, pidfile, minsize)
                if not os.path.exists(cachefile):
                    try:
                        msg = open(pidfile).read().split("\n")[-2]
                    except:
                        msg = "Failed to process request."
                    raise RuntimeError(unicode(msg, "utf-8"))
                conc = PyConc(corp, 'l', cachefile)
        else:  # synchronous processing
            conc = compute_conc(corp, q, cache_dir, subchash, samplesize,
                                fullsize, pid_dir)
            conc.sync()  # wait for the computation to finish
            if save:
                os.close(0)  # PID file will have fd 1
                cachefile, pidfile = add_to_map(cache_dir, pid_dir, subchash,
                                                 q[:1], conc.size())
                conc.save(cachefile)
                # update size in map file
                add_to_map(cache_dir, pid_dir, subchash, q[:1], conc.size())
                os.remove(pidfile.name)
                pidfile.close()
    # process subsequent concordance actions (e.g. sample)
    for act in range(toprocess, len(q)):
        command = q[act][0]
        getattr(conc, 'command_' + command)(q[act][1:])
        if command in 'gae':  # user specific/volatile actions, cannot save
            save = 0
        if save:
            cachefile, pidfile = add_to_map(cache_dir, pid_dir, subchash,
                                             q[:act + 1], conc.size())
            if type(pidfile) != file:
                wait_for_conc(corp, q[:act + 1], cachefile, pidfile, -1)
            else:
                conc.save(cachefile)
                os.remove(pidfile.name)
                pidfile.close()
    return conc


def conc_is_sorted(q):
    """
    """
    ans = True
    for item in q:
        if item[0] in ('r', 'f'):
            ans = False
        elif item[0] in ('s', ):
            ans = True
    return ans


def get_conc_desc(q=[], cache_dir='cache', corpname='', subchash=None, translate=True):
    if translate:
        _t = lambda s: _(s)
    else:
        _t = lambda s: s
    desctext = {'q': _t('Query'),
                'a': _t('Query'),
                'r': _t('Random sample'),
                's': _t('Sort'),
                'f': _t('Shuffle'),
                'n': _t('Negative filter'),
                'N': _t('Negative filter (excluding KWIC)'),
                'p': _t('Positive filter'),
                'P': _t('Positive filter (excluding KWIC)'),
                'w': _t('Word sketch item'),
                't': _t('Word sketch texttype item'),
                'e': _t('GDEX'),
                'x': _t('Switch KWIC'),
                }
    forms = {'q': ('first_form', 'cql'),
             'a': ('first_form', 'cql'),
             'r': ('reduce_form', 'rlines'),
             's': ('sort', ''),
             'n': ('first_form', ''),
             'p': ('first_form', ''),
             'f': ('', ''),
             'w': ('', ''),
             't': ('', ''),
             }
    desc = []
    saved = load_map(cache_dir + '/' + corpname + '/')
    q = tuple(q)

    for i in range(len(q)):
        size = saved.get((subchash, q[:i + 1]), ('', ''))[1]
        opid = q[i][0]
        args = q[i][1:]
        url1p = [('q', qi) for qi in q[:i]]
        url2 = [('q', qi) for qi in q[:i + 1]]
        op = desctext.get(opid)
        formname = forms.get(opid, ('', ''))
        if formname[1]:
            url1p.append((formname[1], args))

        if opid == 's' and args[0] != '*' and i > 0:
            sortopt = {'-1<0': 'left context',
                       '0<0~': 'node',
                       '1>0~': 'right context'}
            sortattrs = args.split()
            if len(sortattrs) > 2:
                op = 'Multilevel Sort'
            args = '%s in %s' % (sortattrs[0].split('/')[0],
                                 sortopt.get(sortattrs[1][:4], sortattrs[1]))
            url1p.append(('skey', {'-1': 'lc', '0<': 'kw', '1>': 'rc'}
                           .get(sortattrs[1][:2], '')))
        elif opid == 'f':
            size = ''
            args = _('enabled')
        if op:
            if formname[0]:
                url1 = '%s?%s' % (formname[0], url1p)
            else:
                url1 = ''
            desc.append((op, args, url1, url2, size))
    return desc


def get_conc_labelmap(infopath):
    labels = {}
    try:
        from xml.etree.ElementTree import parse
        annoti = parse(infopath)
        for e in annoti.find('labels'):
            labels[e.find('n').text] = e.find('lab').text
    except IOError, err:
        print >>stderr, 'get_conc_labelmap: %s' % err
        pass
    return labels


def get_stored_conc(corp, concname, conc_dir):
    basecorpname = corp.corpname.split(':')[0]
    conc_dir = os.path.join(conc_dir, basecorpname)
    if not os.path.isdir(conc_dir):
        os.makedirs(conc_dir)
    cpath = os.path.join(conc_dir, concname)
    conc = PyConc(corp, 'l', cpath + '.conc')
    conc.labelmap = get_conc_labelmap(cpath + '.info')
    return conc


def get_full_ref(corp, pos):
    data = {}
    refs = [(n == '#' and ('#', str(pos)) or
             (n, corp.get_attr(n).pos2str(pos)))
            for n in corp.get_conf('FULLREF').split(',') if n != settings.get('corpora', 'speech_segment_struct_attr')]
    data['Refs'] = [{'name': n == '#' and _('Token number')
                             or corp.get_conf(n + '.LABEL') or n,
                     'val': v}
                    for n, v in refs]
    for n, v in refs:
        data[n.replace('.', '_')] = v
    return data


def get_detail_context(corp, pos, hitlen=1,
                        detail_left_ctx=40, detail_right_ctx=40,
                        addattrs=[], structs='', detail_ctx_incr=60):
    data = {}
    corpus_encoding = corp.get_conf('ENCODING')
    wrapdetail = corp.get_conf('WRAPDETAIL')
    if wrapdetail:
        data['wrapdetail'] = '<%s>' % wrapdetail
        if not wrapdetail in structs.split(','):
            data['deletewrap'] = True
        structs = wrapdetail + ',' + structs
    else:
        data['wrapdetail'] = ''
    try:
        maxdetail = int(corp.get_conf('MAXDETAIL'))
    except:
        maxdetail = 0
    if maxdetail:
        if detail_left_ctx > maxdetail:
            detail_left_ctx = maxdetail
        if detail_right_ctx > maxdetail:
            detail_right_ctx = maxdetail
    if detail_left_ctx > pos:
        detail_left_ctx = pos
    attrs = ','.join(['word'] + addattrs)
    cr = manatee.CorpRegion(corp, attrs, structs)
    region_left = tokens2strclass(cr.region(pos - detail_left_ctx, pos))
    region_kwic = tokens2strclass(cr.region(pos, pos + hitlen))
    region_right = tokens2strclass(cr.region(pos + hitlen,
                                              pos + hitlen + detail_right_ctx))
    for seg in region_left + region_kwic + region_right:
        seg['str'] = import_string(seg['str'].replace('===NONE===', ''), from_encoding=corpus_encoding)
    for seg in region_kwic:
        if not seg['class']:
            seg['class'] = 'coll'
    data['content'] = region_left + region_kwic + region_right
    refbase = 'pos=%i;' % pos
    if hitlen != 1:
        refbase += 'hitlen=%i;' % hitlen
    data['leftlink'] = refbase + ('detail_left_ctx=%i;detail_right_ctx=%i'
                                  % (detail_left_ctx + detail_ctx_incr,
                                     detail_right_ctx))
    data['rightlink'] = refbase + ('detail_left_ctx=%i;detail_right_ctx=%i'
                                   % (detail_left_ctx,
                                      detail_right_ctx + detail_ctx_incr))
    data['righttoleft'] = corp.get_conf('RIGHTTOLEFT')
    data['pos'] = pos
    data['maxdetail'] = maxdetail
    return data


def fcs_scan(corpname, scan_query, max_ter, start):
    """
    aux function for federated content search: operation=scan
    """
    if not scan_query:
        raise Exception(7, '', 'Mandatory parameter not supplied')
    query = scan_query.replace('+', ' ')  # convert URL spaces
    exact_match = False
    if 'exact' in query.lower() and not '=' in query:  # lemma ExacT "dog"
        pos = query.lower().index('exact')  # first occurence of EXACT
        query = query[:pos] + '=' + query[pos+5:]  # 1st exact > =
        exact_match = True
    corp = manatee.Corpus(corpname)
    attrs = corp.get_conf('ATTRLIST').split(',')  # list of available attrs
    try:
        if '=' in query:
            attr, value = query.split('=')
            attr = attr.strip()
            value = value.strip()
        else:  # must be in format attr = value
            raise Exception
        if '"' in attr:
            raise Exception
        if '"' in value:
            if value[0] == '"' and value[-1] == '"':
                value = value[1:-1].strip()
            else:
                raise Exception
    except Exception, e:
        raise Exception(10, scan_query, 'Query syntax error')
    if not attr in attrs:
        raise Exception(16, attr, 'Unsupported index')
    import corplib
    if exact_match:
        wlpattern = '^' + value + '$'
    else:
        wlpattern = '.*' + value + '.*'
    wl = corplib.wordlist(corp, wlattr=attr, wlpat=wlpattern, wlsort='f')
    return [(d['str'], d['freq']) for d in wl][start:][:max_ter]

