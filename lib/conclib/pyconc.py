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

import logging
import os
import re
from sys import stderr
from typing import Any, Callable, Dict, List, Tuple

import l10n
import manatee
from conclib.freq import FreqData, FreqItem
from corplib.corpus import AbstractKCorpus
from kwiclib.common import lngrp_sortcrit
from strings import escape_attr_val

from .errors import (ConcordanceException, EmptyParallelCorporaIntersection,
                     UnknownConcordanceAction)


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


def get_stored_conc(corp, concname, conc_dir, translate):
    conc_dir = os.path.join(conc_dir, corp.corpname)
    if not os.path.isdir(conc_dir):
        os.makedirs(conc_dir)
    cpath = os.path.join(conc_dir, concname)
    conc = PyConc(corp, 'l', cpath + '.conc', translate=translate)
    conc.labelmap = get_conc_labelmap(cpath + '.info')
    return conc


def lngrp_sortstr(lab, separator='.'):
    # TODO: purpose not analyzed (command_g?)
    f = {'n': 'n%03g', 'c': 'c%s', 'x': '%s'}
    return '|'.join([f[c] % s for c, s in lngrp_sortcrit(lab, separator)])


class PyConc(manatee.Concordance):
    selected_grps: List[int] = []

    def __init__(self, corp: AbstractKCorpus, action, params, sample_size=0, full_size=-1, orig_corp=None, translate: Callable[[str], str] = lambda x: x):
        self.pycorp = corp
        self.corpname = corp.get_conffile()
        self.orig_corp = orig_corp or self.pycorp
        self.corpus_encoding = corp.get_conf('ENCODING')
        self._conc_file = None
        self._translate = translate
        try:
            if action == 'q':
                manatee.Concordance.__init__(
                    self, corp.unwrap(), params, sample_size, full_size)
            elif action == 'a':
                # query with a default attribute
                default_attr, query = params.split(',', 1)
                corp.set_default_attr(default_attr)
                manatee.Concordance.__init__(
                    self, corp.unwrap(), query, sample_size, full_size)
            elif action == 'l':
                # load from a file
                self._conc_file = params
                manatee.Concordance.__init__(self, corp.unwrap(), self._conc_file)
            elif action == 's':
                # stored in _conc_dir
                self._conc_file = os.path.join(
                    self.pycorp._conc_dir, corp.corpname, params + '.conc')
                manatee.Concordance.__init__(self, corp, self._conc_file)
            else:
                raise UnknownConcordanceAction(translate('Unknown concordance action: %s') % action)
        except UnicodeEncodeError:
            raise ConcordanceException(
                'Character encoding of this corpus ({0}) does not support one or more characters in the query.'
                .format(self.corpus_encoding))

    def get_conc_file(self):
        return self._conc_file

    def size(self) -> int:
        return super().size()

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
        annot = get_stored_conc(self.pycorp, options, self.pycorp._conc_dir, self._translate)
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
        annot = get_stored_conc(self.pycorp, annotname, self.pycorp._conc_dir, self._translate)
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
        if options[0] == '-':
            self.switch_aligned(self.orig_corp.get_conffile())
            try:
                self.add_aligned(options[1:])
            except RuntimeError as e:
                logging.getLogger(__name__).warning('Failed to add aligned corpus: %s' % e)
                raise EmptyParallelCorporaIntersection(
                    self._translate('No alignment available for the selected languages'))
            self.switch_aligned(options[1:])
            self.corpname = options[1:]
        else:
            self.swap_kwic_coll(int(options))

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

    def xfreq_dist(
            self, crit: str, limit: int = 1, sortkey: str = 'f', ftt_include_empty: int = 0, rel_mode: int = 0,
            collator_locale: str = 'en_US', remove_empty_items: int = 1) -> FreqData:
        """
        Calculates data (including data for visual output) of a frequency distribution
        specified by the 'crit' parameter

        arguments:
        crit -- specified criteria (CQL)
        limit -- str type!, minimal frequency accepted, this value is exclusive! (i.e. accepted
                 values must be greater than the limit)
        sortkey -- a key according to which the distribution will be sorted
        ftt_include_empty -- str, TODO
        rel_mode -- {0, 1} (0 for structural attrs. , 1 for positional ones ??)
        """

        def label(attr):
            if '/' in attr:
                attr = attr[:attr.index('/')]
            lab = self.pycorp.get_conf(attr + '.LABEL')
            return lab if lab else attr

        def export_word(wrd):
            return [{'n': '  '.join(n.split('\v'))} for n in wrd.split('\t')]

        def test_word_empty(wrd):
            return len(wrd) == 1 and (wrd[0]['n'] == '' or wrd[0]['n'] == '===NONE===')

        words = manatee.StrVector()
        freqs = manatee.NumVector()
        norms = manatee.NumVector()
        self.pycorp.freq_dist(self.RS(), crit, limit, words, freqs, norms)
        if len(freqs) == 0:
            return dict(Head=[], Items=[], SkippedEmpty=False, NoRelSorting=True)

        # for structural attrs, we intentionally rewrite norms as filled in by Corpus.freq_dist()
        # because of "hard to explain" metrics they lead to
        if rel_mode == 0:
            norms2_dict = self.get_attr_values_sizes(crit)
            norms = [norms2_dict.get(x, 0) for x in words]
        # For positional attrs, the norm is the size of the actual corpus/subcorpus. Please note that
        # for an "ad hoc" (or unnamed) subcorpus, this may be misleading as we still calculate against orig. corpus
        else:
            norms = [self.pycorp.search_size for _ in words]

        attrs = crit.split()
        head: List[Dict[str, Any]] = [dict(n=label(attrs[x]), s=x / 2)
                                      for x in range(0, len(attrs), 2)]
        head.append(dict(n=self._translate('Freq'), s='freq', title=self._translate('Frequency')))
        has_empty_item = False
        head.append(dict(
            n='i.p.m.',
            title=self._translate(
                'instances per million positions (refers to the respective category)'),
            s='rel'))

        lines: List[FreqItem] = []
        for w, f, nf in zip(words, freqs, norms):
            word = export_word(w)
            if test_word_empty(word):
                has_empty_item = True
                if remove_empty_items:
                    continue
            if nf == 0:
                logging.getLogger(__name__).warning(
                    f'ipm calculation problem: zero base set size (corpus: {self.corpname}, word: {w}, f: {f})')
                continue
            lines.append(FreqItem(
                Word=word,
                freq=f,
                norm=nf,
                rel=round(f / nf * 1e6, 3)))
        if ftt_include_empty and limit == 0 and '.' in attrs[0]:
            attr = self.pycorp.get_attr(attrs[0])
            all_vals = [attr.id2str(i) for i in range(attr.id_range())]
            used_vals = [line.Word[0]['n'] for line in lines]
            for v in all_vals:
                if v in used_vals:
                    continue
                lines.append(FreqItem(
                    Word=[{'n': v}],
                    freq=0,
                    rel=0,
                    norm=0
                ))
        if (sortkey in ('0', '1', '2')) and (int(sortkey) < len(lines[0].Word)):
            sortkey = int(sortkey)
            lines = l10n.sort(lines, loc=collator_locale, key=lambda v: v.Word[sortkey]['n'])
        else:
            if sortkey not in ('freq', 'rel'):
                sortkey = 'freq'
            lines = sorted(lines, key=lambda v: getattr(v, sortkey), reverse=True)
        return FreqData(Head=head, Items=lines, SkippedEmpty=has_empty_item, NoRelSorting=bool(rel_mode))

    def xdistribution(self, xrange: List[int], amplitude: int) -> Tuple[List[int], List[int]]:
        begs = manatee.IntVector(xrange)
        values = manatee.IntVector(xrange)
        self.distribution(values, begs, amplitude)
        return begs, values

    def collocs(self, cattr='-', csortfn='m', cbgrfns='mt', cfromw=-5, ctow=5, cminfreq=5, cminbgr=3, max_lines=0):
        statdesc = {'t': self._translate('T-score'),
                    'm': self._translate('MI'),
                    '3': self._translate('MI3'),
                    'l': self._translate('log likelihood'),
                    's': self._translate('min. sensitivity'),
                    'p': self._translate('MI.log_f'),
                    'r': self._translate('relative freq. [%]'),
                    'f': self._translate('absolute freq.'),
                    'd': self._translate('logDice')
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
                pfilter=qfilter % ('P', escape_attr_val(colls.get_item())),
                nfilter=qfilter % ('N', escape_attr_val(colls.get_item()))
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
