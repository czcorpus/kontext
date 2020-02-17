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

from typing import List

import os
from functools import partial
from sys import stderr
import re
import logging

import manatee
import l10n
from l10n import escape
from kwiclib import lngrp_sortcrit
from translation import ugettext as translate
from functools import reduce


def get_conc_labelmap(infopath):
    labels = {}
    try:
        from xml.etree.ElementTree import parse
        annoti = parse(infopath)
        for e in annoti.find('labels'):
            labels[e.find('n').text] = e.find('lab').text
    except IOError as err:
        print('get_conc_labelmap: %s' % err, file=stderr)
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


class EmptyParallelCorporaIntersection(Exception):
    pass


class PyConc(manatee.Concordance):
    selected_grps: List[int] = []

    def __init__(self, corp, action, params, sample_size=0, full_size=-1, orig_corp=None):
        self.pycorp = corp
        self.corpname = corp.get_conffile()
        self.orig_corp = orig_corp or self.pycorp
        self.corpus_encoding = corp.get_conf('ENCODING')
        self._conc_file = None

        try:
            if action == 'q':
                manatee.Concordance.__init__(
                    self, corp, params, sample_size, full_size)
            elif action == 'a':
                # query with a default attribute
                default_attr, query = params.split(',', 1)
                corp.set_default_attr(default_attr)
                manatee.Concordance.__init__(
                    self, corp, query, sample_size, full_size)
            elif action == 'l':
                # load from a file
                self._conc_file = params
                manatee.Concordance.__init__(self, corp, self._conc_file)
            elif action == 's':
                # stored in _conc_dir
                self._conc_file = os.path.join(
                    self.pycorp._conc_dir, corp.corpname, params + '.conc')
                manatee.Concordance.__init__(self, corp, self._conc_file)
            else:
                raise RuntimeError(translate('Unknown concordance action: %s') % action)
        except UnicodeEncodeError:
            raise RuntimeError('Character encoding of this corpus ({0}) does not support one or more characters in the query.'
                               .format(self.corpus_encoding))

    def get_conc_file(self):
        return self._conc_file

    def exec_command(self, name, options):
        fn = getattr(self, 'command_{0}'.format(name), None)
        if fn is not None:
            try:
                return fn(options)
            except ValueError as ex:
                raise ValueError('Invalid arguments for PyConc command {0}: {1} (original error: {2})'
                                 .format(name, options, ex))
        else:
            raise ValueError('Unknown PyConc command: {0}'.format(name))

    def command_g(self, options):
        """
        sort according to linegroups
        """
        annot = get_stored_conc(self.pycorp, options, self.pycorp._conc_dir)
        self.set_linegroup_from_conc(annot)
        lmap = annot.labelmap
        lmap[0] = None
        ids = manatee.IntVector(list(map(int, list(lmap.keys()))))
        strs = manatee.StrVector(list(map(lngrp_sortstr, list(lmap.values()))))
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

    def command_D(self, options):
        self.delete_subparts()

    def command_F(self, options):
        self.delete_struct_repeats(options)

    def command_f(self, options):
        self.shuffle()

    def command_r(self, options):
        self.reduce_lines(options)

    def command_x(self, options):
        raise NotImplementedError('Command "x" not supported any more')

    def command_X(self, options):
        self.add_aligned(options)
        self.filter_aligned(options)

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
        self.set_collocation(collnum, query + ';', lctx, rctx, int(rank),
                             excludekwic)
        self.delete_pnfilter(collnum, ispositive)

    def get_attr_values_sizes(self, full_attr_name):
        """
        Returns all values of provided structural attribute and their corresponding
        sizes in positions.

        arguments:
        full_attr_name -- fully qualified structural attribute name (e.g. "opus.srclang",
                          "doc.id" etc.). Method allows this name to be suffixed if this
                          suffix starts with at least one whitespace. In such case the suffix
                          is ignored.

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
            ans[value] = cnt
        return ans

    def xfreq_dist(self, crit, limit=1, sortkey='f', ml='', ftt_include_empty='', rel_mode=0,
                   collator_locale='en_US'):
        """
        Calculates data (including data for visual output) of a frequency distribution
        specified by the 'crit' parameter

        arguments:
        crit -- specified criteria (CQL)
        limit -- str type!, minimal frequency accepted, this value is exclusive! (i.e. accepted
                 values must be greater than the limit)
        sortkey -- a key according to which the distribution will be sorted
        ml -- str, if non-empty then multi-level freq. distribution is generated
        ftt_include_empty -- str, TODO
        rel_mode -- {0, 1}, TODO
        """

        # ml = determines how the bar appears (multilevel x text type)
        # import math
        normwidth_freq = 100
        normwidth_rel = 100

        def calc_scale(freqs, norms):
            """
            Create proper scaling coefficients for freqs and norms
            to match a 100 units length bar.
            """
            from operator import add
            sumn = float(reduce(add, norms))
            if sumn == 0:
                return float(normwidth_rel) / max(freqs), 0
            else:
                sumf = float(reduce(add, freqs))
                corr = min(sumf / max(freqs), sumn / max(norms))
                return normwidth_rel / sumf * corr, normwidth_rel / sumn * corr

        def label(attr):
            if '/' in attr:
                attr = attr[:attr.index('/')]
            lab = self.pycorp.get_conf(attr + '.LABEL')
            return lab if lab else attr

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
            norms = [norms2_dict.get(x, 0) for x in words]
        sumf = float(sum([x for x in freqs]))
        attrs = crit.split()
        head = [dict(n=label(attrs[x]), s=x / 2)
                for x in range(0, len(attrs), 2)]
        head.append(dict(n=translate('Freq'), s='freq', title=translate('Frequency')))

        tofbar, tonbar = calc_scale(freqs, norms)
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
                head.append(dict(
                    n='i.p.m.',
                    title=translate(
                        'instances per million positions (refers to the respective category)'),
                    s='rel'
                ))
            else:
                head.append(dict(n='Freq [%]', title='', s='rel'))

            lines = []
            for w, f, nf in zip(words, freqs, norms):
                rel_norm_freq = {
                    0: round(f * 1e6 / nf, 2),
                    1: round(f / sumf * 100, 2)
                }[rel_mode]

                rel_bar = {
                    0: 1 + int(f * tofbar * normwidth_rel / (nf * tonbar * maxrel)),
                    1: 1 + int(float(f) / maxf * normwidth_rel)
                }[rel_mode]

                freq_bar = {
                    0: int(normwidth_freq * float(f) / (maxf - minf + 1) + 1),
                    1: 10
                }[rel_mode]
                lines.append(dict(
                    Word=[{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                    freq=f,
                    fbar=int(f * tofbar) + 1,
                    norm=nf,
                    nbar=int(nf * tonbar),
                    relbar=rel_bar,
                    norel=ml,
                    freqbar=freq_bar,
                    rel=rel_norm_freq
                ))
        else:
            lines = []
            for w, f, nf in zip(words, freqs, norms):
                lines.append(dict(
                    Word=[{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                    freq=f,
                    fbar=int(f * tofbar) + 1,
                    norel=1,
                    relbar=None
                ))

        if ftt_include_empty and limit == 0 and '.' in attrs[0]:
            attr = self.pycorp.get_attr(attrs[0])
            all_vals = [attr.id2str(i) for i in range(attr.id_range())]
            used_vals = [line['Word'][0]['n'] for line in lines]
            for v in all_vals:
                if v in used_vals:
                    continue
                lines.append(dict(
                    Word=[{'n': v}],
                    freq=0,
                    rel=0,
                    norm=0,
                    nbar=0,
                    relbar=0,
                    norel=ml,
                    freqbar=0,
                    fbar=0
                ))
        if (sortkey in ('0', '1', '2')) and (int(sortkey) < len(lines[0]['Word'])):
            sortkey = int(sortkey)
            lines = l10n.sort(lines, loc=collator_locale, key=lambda v: v['Word'][sortkey]['n'])
        else:
            if sortkey not in ('freq', 'rel'):
                sortkey = 'freq'
            lines = sorted(lines, key=lambda v: v[sortkey], reverse=True)
        return dict(Head=head, Items=lines)

    def xdistribution(self, xrange, yrange):
        """
        TODO: no direct call found for this
        """
        begs = manatee.IntVector(xrange)
        vals = manatee.IntVector(xrange)
        self.distribution(vals, begs, yrange)
        return list(zip(vals, begs))

    def collocs(self, cattr='-', csortfn='m', cbgrfns='mt', cfromw=-5, ctow=5, cminfreq=5, cminbgr=3, max_lines=0):
        statdesc = {'t': translate('T-score'),
                    'm': translate('MI'),
                    '3': translate('MI3'),
                    'l': translate('log likelihood'),
                    's': translate('min. sensitivity'),
                    'p': translate('MI.log_f'),
                    'r': translate('relative freq. [%]'),
                    'f': translate('absolute freq.'),
                    'd': translate('logDice')
                    }
        items = []
        colls = manatee.CollocItems(self, cattr, csortfn, cminfreq, cminbgr,
                                    cfromw, ctow, max_lines)
        qfilter = '%%s%i %i 1 [%s="%%s"]' % (cfromw, ctow, cattr)
        i = 0
        while not colls.eos():
            if 0 < max_lines < i:
                break
            items.append(dict(
                str=colls.get_item(),
                freq=colls.get_cnt(),
                Stats=[{'s': '%.3f' % colls.get_bgr(s)} for s in cbgrfns],
                pfilter=qfilter % ('P', escape(colls.get_item())),
                nfilter=qfilter % ('N', escape(colls.get_item()))
            ))
            colls.next()
            i += 1

        head = [{'n': ''}, {'n': 'Freq', 's': 'f'}] + \
            [{'n': statdesc.get(s, s), 's': s} for s in cbgrfns]
        return dict(Head=head, Items=items)

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
        info = dict(list(zip(ids, freqs)))
        if not info:
            # no annotation
            return 0, 0, [0] * (len(self.selected_grps) + 1)
        hist = [info.get(i, 0) for i in self.selected_grps]
        hist.append(conc.size() - sum(hist))
        cnt, maxid = max(list(zip(freqs, ids)))
        return maxid, (cnt / float(conc.size())), hist
