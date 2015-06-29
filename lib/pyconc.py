# Copyright (c) 2003-2014  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright (c) 2014 Institute of the Czech National Corpus
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
from functools import partial
from sys import stderr
import re
import math

import manatee
import l10n
from l10n import import_string, export_string, escape
from kwiclib import lngrp_sortcrit
from translation import ugettext as _


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


def lngrp_sortstr(lab, separator='.'):
    # TODO: purpose not analyzed (command_g?)
    f = {'n': 'n%03g', 'c': 'c%s', 'x': '%s'}
    return '|'.join([f[c] % s for c, s in lngrp_sortcrit(lab, separator)])


class PyConc(manatee.Concordance):
    selected_grps = []

    def __init__(self, corp, action, params, sample_size=0, full_size=-1,
                 orig_corp=None):
        self.pycorp = corp
        self.corpname = corp.get_conffile()
        self.orig_corp = orig_corp or self.pycorp
        self.corpus_encoding = corp.get_conf('ENCODING')
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
        """
        sort according to linegroups
        """
        annot = get_stored_conc(self.pycorp, options, self.pycorp._conc_dir)
        self.set_linegroup_from_conc(annot)
        lmap = annot.labelmap
        lmap[0] = None
        ids = manatee.IntVector(map(int, lmap.keys()))
        strs = manatee.StrVector(map(lngrp_sortstr, lmap.values()))
        self.linegroup_sort(ids, strs)

    def command_s(self, options):
        if options[0] == '*':
            raise NotImplementedError('GDEX related operations are not supported in KonText')
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

        arguments:
        full_attr_name -- fully qualified structural attribute name (e.g. "opus.srclang", "doc.id" etc.).
                          Method allows this name to be suffixed if this suffix starts with at least one whitespace.
                          In such case the suffix is ignored.

        returns:
        a dictionary (key = "structural attribute value" and value = "size in positions")
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
            valid = attr.str2id(value)
            r = self.pycorp.filter_query(struct.attr_val(attr_name, valid))
            cnt = 0
            while not r.end():
                cnt += normvals[r.peek_beg()]
                r.next()
            ans[self.import_string(value)] = cnt
        return ans

    def xfreq_dist(self, crit, limit=1, sortkey='f', normwidth=300, ml='',
                   ftt_include_empty='', rel_mode=0):
        """
        Calculates data (including data for visual output) of a frequency distribution
        specified by the 'crit' parameter

        arguments:
        crit -- specified criteria (CQL)
        limit -- str type!, minimal frequency accepted, this value is exclusive! (i.e. accepted values must be
                greater than the limit)
        sortkey -- a key according to which the distribution will be sorted
        normwidth -- specifies width of the bar representing highest frequency
        ml -- str, if non-empty then multi-level freq. distribution is generated
        ftt_include_empty -- str, TODO
        rel_mode -- {0, 1}, TODO
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
        words = [self.import_string(w) for w in words]
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
                    'Word': [{'n': self.import_string(v)}],
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
            # TODO: version 0.7 solves hardcoded collation locale
            lines = l10n.sort(lines, loc='cs_CZ', key=lambda v: v['Word'][sortkey]['n'])
        else:
            if sortkey not in ('freq', 'rel'):
                sortkey = 'freq'
            lines = sorted(lines, key=lambda v: v[sortkey], reverse=True)

        return {'Head': head,
                'Items': self.add_block_items(lines, block_size=2)}

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
        """
        TODO: no direct call found for this
        """
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
        """
        TODO: no direct call found for this
        """
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
