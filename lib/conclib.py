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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

from urllib import urlencode
import os, re
from sys import stderr
from datetime import datetime
import logging
import math

import manatee
import settings

try:
    import fcntl
except ImportError:
    try:
        import msvcrt
    except ImportError:
        # no locking available, dummy defs
        def flck_no_op (file):
            pass
        flck_sh_lock = flck_ex_lock = flck_unlock = flck_no_op
    else:
        # Windows: msvcrt.locking
        def flck_sh_lock (file):
            file.seek (0)
            msvcrt.locking (file.fileno(), msvcrt.LK_LOCK, 1)
        flck_ex_lock = flck_sh_lock
        def flck_unlock (file):
            file.seek (0)
            msvcrt.locking (file.fileno(), msvcrt.LK_UNLCK, 1)
else:
    # UNIX: fcntl.lockf
    def flck_sh_lock (file):
        fcntl.lockf (file, fcntl.LOCK_SH, 1, 0, 0)
    def flck_ex_lock (file):
        fcntl.lockf (file, fcntl.LOCK_EX, 1, 0, 0)
    def flck_unlock (file):
        fcntl.lockf (file, fcntl.LOCK_UN, 1, 0, 0)


def printkwic (conc, froml=0, tol=5, leftctx='15#', rightctx='15#',
               attrs='word', refs='#', maxcontext=0):
    def strip_tags (tokens):
        return ''.join ([tokens[i] for i in range(0, len(tokens), 2)])
    kl = manatee.KWICLines (conc, leftctx, rightctx, attrs, 'word', 'p', refs, maxcontext)
    for line in range (froml, tol):
        kl.nextline (line)
        print '%s %s <%s> %s' % (kl.get_refs(), strip_tags (kl.get_left()),
                                 strip_tags (kl.get_kwic()),
                                 strip_tags (kl.get_right()))


def pos_ctxs (min_hitlen, max_hitlen, max_ctx=3):
    ctxs = [{'n':'%iL' % -c, 'ctx':'%i<0' % c} for c in range (-max_ctx, 0)]
    if max_hitlen == 1:
        ctxs.append ({'n':'Node', 'ctx': '0~0>0'})
    else:
        ctxs.extend ([{'n':'Node %i' % c, 'ctx':'%i<0' % c}
                      for c in range (1,max_hitlen+1)])
    ctxs.extend ([{'n':'%iR' % c, 'ctx':'%i>0' % c}
                  for c in range (1, max_ctx+1)])
    return ctxs


def add_block_items (items, attr='class', val='even', block_size=3):
    for i in [i for i in range (len (items)) if (i / block_size) % 2]:
        items[i][attr] = val
    return items
        
def kwicpage (corpus, conc, has_speech=False, fromp=1, leftctx='-5', rightctx='5', attrs='word',
              ctxattrs='word', refs='#', structs='p', pagesize=20,
              labelmap={}, righttoleft=False, alignlist=[], copy_icon=0,
              tbl_template='none'):
    """
    Generates template data for page displaying provided concordance

    Parameters
    ----------
    corpus : manatee.Corpus
      corpus we are working with
    conc : manatee.Concordance
      a concordance object
    has_speech : bool
      sets whether the corpus concordance is derived from contains speech files
    fromp : int
      page number
    leftctx : str, optional (default is '-5')
      how many characters/positions/whatever_struct_attrs display on the left side
    rightctx : str, optional (default is '5')
      how many characters/positions/whatever_struct_attrs display on the right side
    attrs : str, optional (default is 'word')
      TODO
    ctxattrs : str, optional (default is 'word')
      TODO
    refs : str, optional (default is '#')
      TODO
    structs : str, optional (default is 'p')
      TODO
    pagesize : int, optional (default is 20)
      number of lines per page
    labelmap : dict, optional (default is {})
      TODO
    righttoleft : bool, optional (default is False)
      TODO
    alignlist : list, optional (default is [])
      TODO
    copy_icon : int, optional (default is 0)
      TODO
    tbl_template : str, optional (default is 'none')
      TODO

    Returns
    -------
    custom dict containing data as required by related HTML template
    """
    refs = refs.replace('.MAP_OUP', '') # to be removed ...
    try:
        fromp = int(fromp)
        if fromp < 1:
            fromp = 1
    except:
        fromp = 1
    out = {'Lines': 
           kwiclines(corpus, conc, has_speech, (fromp -1) * pagesize, fromp * pagesize,
                      leftctx, rightctx, attrs, ctxattrs, refs, structs,
                      labelmap, righttoleft, alignlist)}
    if copy_icon:
        from tbl_settings import tbl_refs, tbl_structs
        sen_refs = tbl_refs.get(tbl_template, '') + ',#'
        sen_refs = sen_refs.replace('.MAP_OUP', '') # to be removed ...
        sen_structs = tbl_structs.get(tbl_template, '') or 'g'
        sen_lines = kwiclines(corpus, conc, has_speech, (fromp -1) * pagesize, fromp * pagesize,
                             '-1:s', '1:s', refs=sen_refs, user_structs=sen_structs)
        for old, new in zip(out['Lines'], sen_lines):
            old['Sen_Left'] = new['Left']
            old['Sen_Right'] = new['Right']
            old['Tbl_refs'] = new['Tbl_refs']
    if labelmap:
        out['GroupNumbers'] = format_labelmap (labelmap)
    if fromp > 1:
        out['prevlink'] = 'fromp=%i' % (fromp - 1)
        out['firstlink'] = 'fromp=1'
    if conc.size() > pagesize:
        out['fromp'] = fromp
        out['numofpages'] = numofpages = (conc.size()-1)/pagesize + 1
        if numofpages < 30:
            out['Page'] = [{'page':x} for x in range (1, numofpages+1)]
        if fromp < numofpages:
            out['nextlink'] = 'fromp=%i' % (fromp +1)
            out['lastlink'] = 'fromp=%i' % numofpages
    out['concsize'] = conc.size()

    if type(corpus) == manatee.SubCorpus:
        out['result_arf'] = ''
    else:
        out['result_arf'] = round(conc.compute_ARF(), 2)

    if type(corpus) is manatee.SubCorpus:
        corpsize = corpus.search_size() # TODO this is unverified solution trying to bypass possible manatee bug
    else:
        corpsize = corpus.size()
    out['result_relative_freq'] = round(conc.size() / (float(corpsize) / 1e6), 2)
    out['result_relative_freq_rel_to'] = _('related to the selected subcorpus') if hasattr(corpus, 'subcname') \
                    else _('related to the whole corpus')
    return out

def separate_speech_struct_from_tag(text):
    """
    Removes structural attribute related to speech file identification.
    E.g. getting input "<seg foo=bar speechfile=1234.wav time=1234>lorem ipsum</seg>" and
    having configuration directive "speech_segment_struct_attr = seg.speechfile" the function
    returns "<seg foo=bar time=1234>lorem ipsum</seg>"

    Parameters
    ----------
    text : str
      string to be processed

    Returns
    -------
    str
      modified string
    str
      structural attribute value
    """
    import re

    struct_attr = settings.get('corpora', 'speech_segment_struct_attr')
    speech_struct, speech_struct_attr = struct_attr.split('.')
    pattern = r"^(<%s\s+.*)%s=([^\s>]+)(\s.+|>)$" % (speech_struct, speech_struct_attr)
    srch = re.search(pattern, text)
    if srch is not None:
        return srch.group(1).rstrip() + srch.group(3), srch.group(2)
    return text, ''

def remove_tag_from_line(line, tag_name):
    """
    Parameters
    ----------
    line : list of dicts containing at least the key 'str'
      line as used in postproc_kwicline
    tag_name : str

    Returns
    -------
    the same object as the 'line' parameter
    """
    import re

    for item in line:
        item['str'] = re.sub('<%s[^>]*>' % tag_name, '', re.sub('</%s>' % tag_name, '', item['str']))
    return line

def line_parts_contain_speech(line_left, line_right):
    """
    Tests whether the line's left and right parts contain speech information
    """
    for fragment in line_left + line_right:
        if 'open_link' in fragment or 'close_link' in fragment:
            return True
    return False

def postproc_kwicline_part(corpus_name, line, side, filter_speech_tag, prev_speech_id = None):
    """
    Parameters
    ----------
    corpus_name : str
      name of the corpus
    line : list of dicts
      contains keys 'str', 'class'
    side : str
      one of {'left', 'right'}; specifies position according to KWIC
    filter_speech_tag : bool
      if True then whole speech tag is removed else only its 'speech attribute'
    prev_speech_id : str
      identifier of the previously processed speech segment

    Returns
    -------
    str
      modified line
    str
      last speech id (which is necessary to obtain proper speech ID in case
      of partial segment on the "left" left side of a KWIC line and similarly
      in case of a partial segment on the "right" side of a KWIC line - because
      the KWIC word itself separates left and right side).
    """
    import re

    newline = []
    speech_struct = settings.get_speech_structure()
    fragment_separator = '<%s' % speech_struct
    last_fragment = None
    last_speech_id = prev_speech_id
    for item in line:
        fragments = [x for x in re.split('(<%s[^>]*>|</%s>)' % (speech_struct, speech_struct), item['str']) if x <> '']
        for fragment in fragments:
            frag_ext, speech_id = separate_speech_struct_from_tag(fragment)
            if not speech_id:
                speech_id = last_speech_id
            else:
                last_speech_id = speech_id
            newline_item = {
                'str' : frag_ext,
                'class' : item['class']
            }
            if frag_ext.startswith(fragment_separator):
                newline_item['open_link'] = { 'speech_url' : settings.create_speech_url(corpus_name, speech_id) }
            elif frag_ext.endswith('</%s>' % speech_struct):
                newline_item['close_link'] = { 'speech_url' : settings.create_speech_url(corpus_name, speech_id) }
            newline.append(newline_item)
            last_fragment = newline_item
    # we have to treat specific situations related to the end of the concordance line
    if last_fragment is not None \
            and re.search('^<%s(>|[^>]+>)$' % speech_struct, last_fragment['str'])\
            and side == 'right':
        del(last_fragment['open_link'])
    if filter_speech_tag:
        remove_tag_from_line(newline, speech_struct)
    return newline, last_speech_id


def kwiclines (corpus, conc, has_speech, fromline, toline, leftctx='-5', rightctx='5',
               attrs='word', ctxattrs='word', refs='#', user_structs='p',
               labelmap={}, righttoleft=False, alignlist=[],
               align_attrname='align', aattrs='word', astructs=''):
    """
    Generates list of 'kwic' (= keyword in context) lines according to
    the provided Concordance object and additional parameters (like
    page number, width of the left and right context etc.).

    Parameters
    ----------
    corpus : manatee.Corpus
      corpus we are working with
    conc : manatee.Concordance
      concordance we are working with
    has_speech : bool
      if true then rendering procedures expect to find speech related structural attribute in the corpus
    TODO

    Returns
    -------
    TODO
    """
    def non1hitlen (hitlen):
        if hitlen == 1:
            return ''
        else:
            return ';hitlen=%i' % hitlen

    def tokens2strclass (tokens):
        return [{'str': tokens[i], 'class': tokens[i+1].strip ('{}')}
                for i in range(0, len(tokens), 2)]

    # structs represent which structures are requested by user
    # all_structs contain also internal structures needed to render
    # additional information (like the speech links)
    all_structs = user_structs
    if has_speech:
        speech_struct_attr_name = settings.get('corpora', 'speech_segment_struct_attr')
        speech_struct_attr = corpus.get_attr(speech_struct_attr_name)
        if not speech_struct_attr_name in user_structs:
            all_structs += ',' + speech_struct_attr_name
    else:
        speech_struct_attr_name = None
        speech_struct_attr = None
    lines = []
    if righttoleft:
        rightlabel, leftlabel = 'Left', 'Right'
        user_structs += ',ltr'
        #from unicodedata import bidirectional
        def isengword (strclass):
            #return bidirectional(word[0]) in ('L', 'LRE', 'LRO')
            return 'ltr' in strclass['class'].split()
    else:
        leftlabel, rightlabel = 'Left', 'Right'

    if alignlist:
        alignlist = [(c, c.get_struct(align_attrname),
                  manatee.CorpRegion (c, aattrs, astructs)) for c in alignlist]
        align_struct = conc.corp.get_struct(align_attrname)

    if corpus.get_conf('MAXDETAIL'):
        kl = manatee.KWICLines (conc, leftctx, rightctx, attrs, ctxattrs,
            all_structs, refs)
    else:
        max_ctx = int(settings.get('corpora', 'kwicline_max_context'))
        kl = manatee.KWICLines (conc, leftctx, rightctx, attrs, ctxattrs,
            all_structs, refs, max_ctx)

    labelmap = labelmap.copy()
    labelmap['_'] = '_'
    maxleftsize = 0
    filter_out_speech_tag = has_speech and settings.get_speech_structure() not in user_structs and speech_struct_attr_name in all_structs
    for line in range (fromline, toline):
        if not kl.nextline (line):
            break
        linegroup = str (kl.get_linegroup() or '_')
        linegroup = labelmap.get (linegroup, '#' + linegroup)
        if has_speech:
            leftmost_speech_id = speech_struct_attr.pos2str(kl.get_ctxbeg())
        else:
            leftmost_speech_id = None
        leftwords, last_left_speech_id = postproc_kwicline_part(corpus.get_conf('NAME'), tokens2strclass(kl.get_left()), 'left', filter_out_speech_tag, leftmost_speech_id)
        rightwords = postproc_kwicline_part(corpus.get_conf('NAME'), tokens2strclass(kl.get_right()), 'right', filter_out_speech_tag, last_left_speech_id)[0]

        kwicwords = tokens2strclass (kl.get_kwic())
        if alignlist:
            n = align_struct.num_at_pos (kl.get_pos())
            if n < 0:
                aligned_texts = []
            else:
                aligned_texts = [
                    {'name': c.corpname,
                     'Words': tokens2strclass (cr.region (a.beg(n), a.end(n)))}
                    for (c, a, cr) in alignlist]
        else:
            aligned_texts = []

        if righttoleft:
            # change order for "English" context of "English" keywords
            if isengword(kwicwords[0]):
                # preceding words
                nprev = len(leftwords) -1
                while nprev >= 0 and isengword (leftwords[nprev]):
                    nprev -= 1
                if nprev == -1:
                    # move whole context
                    moveleft = leftwords
                    leftwords = []
                else:
                    moveleft = leftwords[nprev+1:]
                    del leftwords[nprev+1:]

                # following words
                nfollow = 0
                while (nfollow < len(rightwords)
                       and isengword (rightwords[nfollow])):
                    nfollow += 1
                moveright = rightwords[:nfollow]
                del rightwords[:nfollow]

                leftwords = leftwords + moveright
                rightwords = moveleft + rightwords

        leftsize = 0
        for w in leftwords:
            if not w['class'] == 'strc':
                leftsize += len(w['str']) + 1
        if leftsize > maxleftsize:
            maxleftsize = leftsize

        lines.append ({'toknum': kl.get_pos(),
                       'hitlen': non1hitlen (kl.get_kwiclen()),
                       'ref': kl.get_refs(),
                       'Tbl_refs': list(kl.get_ref_list()),
                       leftlabel: leftwords,
                       'Kwic': kwicwords,
                       rightlabel: rightwords,
                       'linegroup': linegroup,
                       'leftspace': ' ' * (maxleftsize - leftsize),
                       'Align': aligned_texts,
                       })
    return lines


def strkwiclines (conc, fromline, toline=None, leftctx='-5', rightctx='5'):
    """
    TODO: no direct call found for this method
    """
    def tokens2str (tokens):
        return ''.join ([tokens[i] for i in range(0, len(tokens), 2)])
    toline = toline or fromline +1
    kl = manatee.KWICLines (conc, leftctx, rightctx, 'word', 'word','','')
    return [{'left': tokens2str (kl.get_left()),
             'kwic': tokens2str (kl.get_kwic()),
             'right': tokens2str (kl.get_right())}
            for line in range (fromline, toline) if kl.nextline (line)]


class PyConc (manatee.Concordance):
    selected_grps = []

    def __init__ (self, corp, action, params):
        self.corp = corp
        if action == 'q':
            # query
            manatee.Concordance.__init__ (self, corp, params, 0)
        elif action == 'a':
            # query with a default attribute
            default_attr, query = params.split (',', 1)
            corp.set_default_attr (default_attr)
            manatee.Concordance.__init__ (self, corp, query, 0)
        elif action == 'l':
            # load from a file
            manatee.Concordance.__init__ (self, corp, params)
        elif action == 's':
            # stored in _conc_dir
            manatee.Concordance.__init__ (self, corp,
                                          os.path.join (self.corp._conc_dir,
                                                        corp.corpname, 
                                                        params + '.conc'))
        elif action == 'w':
            # word sketch
            import wmap
            if params[0] == ',':
                # seek list
                slist = wmap.IntVector (map (int, params[1:].split(',')))
                ws = wmap.WMap (corp.get_conf('WSBASE'), 2)
                fs = ws.selected_poss (slist)
            elif params[0] == '-':
                # gramrel level
                ws = wmap.WMap (corp.get_conf('WSBASE'), 1, int (params[1:]))
                fs = ws.poss()
            else:
                # only one seek
                ws = wmap.WMap (corp.get_conf('WSBASE'), 2, int (params))
                fs = ws.poss()
            fs.thisown = False
            manatee.Concordance.__init__ (self, corp, fs)
        elif action == 't':
            # text type wordsketch -- will be replaced with filtered sketches
            import wmap
            suff, seek = params.split()
            ws = wmap.WMap (corp.get_conf('WSBASE') + suff, 2, int (seek))
            manatee.Concordance.__init__ (self, corp, ws.poss())
        else:
            raise RuntimeError(_('Unknown action'))

    def command_g (self, options):
        # sort according to linegroups
        annot = get_stored_conc (self.corp, options, self.corp._conc_dir)
        self.set_linegroup_from_conc (annot)
        lmap = annot.labelmap
        lmap[0] = None
        ids = manatee.IntVector(map (int, lmap.keys()))
        strs = manatee.StrVector(map (lngrp_sortstr, lmap.values()))
        self.linegroup_sort (ids, strs)

    def command_e (self, options):
        # sort first k lines using GDEX
        try: import gdex
        except ImportError: import gdex_old as gdex
        args = options.split(' ',1)
        if len(args) == 2:
            conf = args[1]
        else:
            conf = ''
        conf = self.corp.cm.gdexdict.get(conf, '')
        cnt = int(args[0]) or 100
        best = gdex.GDEX(self.corp, conf)
        best.entryConc (self)
        best_lines = manatee.IntVector([i for s,i
                                        in best.best_k(cnt, cnt)])
        self.set_sorted_view (best_lines)

    def command_s (self, options):
        if options[0] == '*':
            # old GDEX, used command_e, should be deleted in mid 2011
            self.command_e(options[1:])
        else:
            self.sort (options)

    def command_a (self, options):
        annotname, options = options.split(' ', 1)
        annot = get_stored_conc (self.corp, annotname, self.corp._conc_dir)
        self.set_linegroup_from_conc (annot)
        if options[0] == '-':
            self.delete_linegroups (options[1:], True)
        else:
            self.delete_linegroups (options, False)

    def command_d (self, options):
        self.delete_lines (options)

    def command_f (self, options):
        self.shuffle()
        
    def command_r (self, options):
        self.reduce_lines (options)
        
    def command_x (self, options):
        self.swap_kwic_coll (int(options))
        
    def command_n (self, options):
        self.pn_filter (options, 0)

    def command_p (self, options):
        self.pn_filter (options, 1)

    def pn_filter (self, options, ispositive):
        lctx, rctx, rank, query = options.split (None, 3)
        query_elems = re.split(r'(?<!\\),', query)
        if len(query_elems) > 1:
            self.corp.set_default_attr(query_elems[0])
            query = query_elems[1]
        else:
            query = query_elems[0]
        collnum = self.numofcolls() + 1
        self.set_collocation (collnum, query +';', lctx, rctx, int(rank))
        self.delete_pnfilter (collnum, ispositive)

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
        struct = self.corp.get_struct(struct_name)
        attr = struct.get_attr(attr_name)
        normvals = dict([(struct.beg(i), struct.end(i) - struct.beg(i)) for i in range (struct.size())])
        ans = {}
        for i in range(attr.id_range()):
            value = attr.id2str(i)
            valid = attr.str2id(str(value))
            r = self.corp.filter_query (struct.attr_val (attr_name, valid))
            cnt = 0
            while not r.end():
                cnt += normvals[r.peek_beg()]
                r.next()
            ans[value] = cnt
        return ans


    def xfreq_dist (self, crit, limit=1, sortkey='f', normwidth=300, ml='',
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
        normheight=15

        def compute_corrections (freqs, norms, sumf, sumn):
            if sumn == 0:
                return float (normwidth) / max (freqs), 0
            else:
                corr = min (sumf / max (freqs), sumn / max (norms))
                return normwidth / sumf * corr, normwidth / sumn * corr
            
        words = manatee.StrVector()
        freqs = manatee.IntVector()
        norms = manatee.IntVector()
        self.freq_dist (crit, limit, words, freqs, norms)
        if not len (freqs):
            return {}

        # now we intentionally rewrite norms as filled in by freq_dist()
        # because of "hard to explain" metrics they lead to
        if rel_mode == 0:
            norms2_dict = self.get_attr_values_sizes(crit)
            norms = [norms2_dict[x] for x in words]
            sumn = float(self.corp.size())
        elif rel_mode == 1:
            sumn = float(sum([x for x in norms]))

        sumf = float(sum([x for x in freqs]))
        attrs = crit.split()

        def label (attr):
            if '/' in attr:
                attr = attr [:attr.index('/')]
            return self.corp.get_conf (attr + '.LABEL') or attr
        head = [{'n': label (attrs[x]), 's': x/2}
                for x in range(0, len(attrs), 2)]
        head.append ({'n': 'freq', 's': 'freq'})

        tofbar, tonbar = compute_corrections (freqs, norms, sumf, sumn)
        if (tonbar and not(ml)):
            maxf = max(freqs) # because of bar height
            minf = min(freqs)
            maxrel = 0; # because of bar width
            for index, (f, nf) in enumerate(zip(freqs, norms)):
                if nf == 0:
                    nf = 100000
                    norms[index] = 100000
                newrel = (f*tofbar / (nf*tonbar))
                if maxrel < newrel:
                    maxrel = newrel
            if rel_mode == 0:
                head.append ({'n': 'i.p.m.', 'title' : _('instances per million (refers to the respective category)'), 's': 'rel'})
            else:
                head.append ({'n': 'Freq [%]', 'title' : '', 's': 'rel'})

            lines = []
            for w, f, nf in zip (words, freqs, norms):
                rel_norm_freq = {
                    0 : round(f * 1e6 / nf, 1),
                    1 : round(f / sumf * 100, 1)
                }[rel_mode]

                rel_bar = {
                    0 : 1 + int(f * tofbar * normwidth / (nf * tonbar * maxrel)),
                    1 : 1 + int(float(f) / maxf * normwidth)
                }[rel_mode]

                freq_bar = {
                    0 : int(normheight * (f - minf + 1) / (maxf - minf + 1) + 1),
                    1 : 10
                }[rel_mode]

                lines.append({
                    'Word' :[{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                    'freq' : f,
                    'fbar' : int(f * tofbar) + 1,
                    'norm' : nf,
                    'nbar' : int(nf * tonbar),
                    'relbar' : rel_bar,
                    'norel' : ml,
                    'freqbar' : freq_bar,
                    'rel': rel_norm_freq
                })
        else:
            lines = [{'Word':[{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                      'freq': f, 'fbar': int(f*tofbar)+1,
                      'norel': 1}
                     for w,f,nf in zip (words, freqs, norms)]

        if ftt_include_empty and limit == 0 and '.' in attrs[0]:
            attr = self.corp.get_attr(attrs[0])
            all_vals = [attr.id2str(i) for i in range (attr.id_range())]
            used_vals = [line['Word'][0]['n'] for line in lines]
            for v in all_vals:
                if v in used_vals: continue
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

        if (sortkey in ('0','1','2')) and (int(sortkey)<len(lines[0]['Word'])):
            sortkey = int (sortkey)
            lines = [(x['Word'][sortkey]['n'], x) for x in lines]
            lines.sort()
        else:
            if sortkey not in ('freq', 'rel'):
                sortkey = 'freq'
            lines = [(x[sortkey], x) for x in lines]
            lines.sort()
            lines.reverse()

        return {'Head': head,
                'Items': add_block_items ([x[1] for x in lines], block_size=2)}


    def xdistribution (self, xrange, yrange):
        """
        TODO: no direct call found for this
        """
        begs = manatee.IntVector (xrange)
        vals = manatee.IntVector (xrange)
        self.distribution (vals, begs, yrange)
        return zip (vals, begs)

    def collocs (self, cattr='-', csortfn='m', cbgrfns='mt',
                 cfromw=-5, ctow=5, cminfreq=5, cminbgr=3, from_idx=0, max_lines=50):
        statdesc = {'t': 'T-score',
                    'm': 'MI',
                    '3': 'MI3',
                    'l': 'log likelihood',
                    's': 'min. sensitivity',
                    'p': 'MI.log_f',
                    'r': 'relative freq.',
                    'f': 'absolute freq.',
                    'd': 'logDice',
                    }

        items=[]
        colls = manatee.CollocItems (self, cattr, csortfn, cminfreq, cminbgr,
                                     cfromw, ctow, 2 ** 29)
        qfilter = 'q=%%s%i %i 1 [%s="%%s"]' % (cfromw, ctow, cattr)
        i = 0
        while not colls.eos():
            if i >= from_idx and i < from_idx + max_lines:
                items.append ({'str': colls.get_item(), 'freq': colls.get_cnt(),
                               'Stats': [{'s': '%.3f' % colls.get_bgr(s)}
                                         for s in  cbgrfns],
                               'pfilter': qfilter % ('p',colls.get_item()),
                            'nfilter': qfilter % ('n',colls.get_item())
                           })
            colls.next()
            i += 1

        head = [{'n': ''}, {'n': 'Freq', 's': 'f'}] \
               + [{'n': statdesc.get(s,s), 's': s} for s in cbgrfns]
        return {
            'Head': head,
            'Items': add_block_items (items),
            'Total' : i,
            'TotalPages' : int(math.ceil(i / float(max_lines)))
        }

    def linegroup_info_select (self, selected_count=5):
        ids = manatee.IntVector()
        freqs = manatee.IntVector()
        self.get_linegroup_stat (ids, freqs)
        grps = [(f, i) for f,i in zip(freqs, ids) if i]
        grps.sort()
        grps = [i for f,i in grps[-5:]]
        grps.sort()
        self.selected_grps = [0] + grps
        return self.selected_grps
        
    def linegroup_info_subset (self, conc):
        #fstream.thisown = False
        #conc = manatee.Concordance (fstream)
        conc.set_linegroup_from_conc (self)
        if not conc.size():
            return 0, 0, [0]*(len(self.selected_grps)+1)
        ids = manatee.IntVector()
        freqs = manatee.IntVector()
        conc.get_linegroup_stat (ids, freqs)
        info = dict(zip(ids, freqs))
        if not info:
            # no annotation
            return 0, 0, [0]*(len(self.selected_grps)+1)
        hist = [info.get(i,0) for i in self.selected_grps]
        hist.append (conc.size() - sum(hist))
        cnt, maxid = max(zip(freqs, ids))
        return maxid, (cnt/float(conc.size())), hist
        

def load_map (cache_dir):
    import cPickle
    try:
        f = open (cache_dir + '00CONCS.map', 'rb')
    except IOError:
        return {}
    try:
        flck_sh_lock (f)
        ret = cPickle.load (f)
        flck_unlock (f)
    except cPickle.UnpicklingError:
        os.rename (cache_dir + '00CONCS.map', 
                   cache_dir + '00CONCS-broken-%d.map' % os.getpid())
        return {}
    return ret

def uniqname (key, used):
    name = '#'.join ([''.join ([c for c in w if c.isalnum()]) for w in key])
    name = name[1:15]
    if not name:
        name = 'noalnums'
    if name in used:
        used = [w[len(name):] for w in used if w.startswith(name)]
        i = 0
        while str(i) in used:
            i += 1
        name += str(i)
    return name

def add_to_map (cache_dir, subchash, key, size):
    import cPickle
    kmap = None
    try:
        f = open (cache_dir + '00CONCS.map', 'r+b')
    except IOError:
        f = open (cache_dir + '00CONCS.map', 'wb')
        kmap = {}
    flck_ex_lock (f)
    if kmap is None:
        kmap = cPickle.load (f)
    if kmap.has_key ((subchash,key)):
        ret = kmap [subchash,key][0]
    else:
        ret = uniqname (key, [r for (r,s) in kmap.values()])
        kmap [subchash,key] = (ret, size)
        f.seek(0)
        cPickle.dump (kmap, f)
    f.close() # also automatically flck_unlock (f)
    return cache_dir + ret


def get_conc (corp, q=[], save=0, cache_dir='cache'):
    user = os.getenv('REMOTE_USER')
    date = datetime.now()
    try:
        action = q[0][0]
        logging.getLogger(__name__).info('%s\t%s\t%s\t%s\t%s\t%s\n' % (date, user, "noske", corp.corpname, action, q[0][1:]))
    except:
        logging.getLogger(__name__).error('%s\t%s\t%s\t%s\n' % (date, user, corp.corpname, q))
    if not q:
        return None
    q = tuple (q)
    cache_dir = cache_dir + '/' + corp.corpname + '/'
    if save:
        try: 
            if not os.path.isdir (cache_dir):
                os.makedirs (cache_dir)
            elif (os.stat(cache_dir + '00CONCS.map').st_mtime
                  < os.stat(corp.get_conf('PATH') +'word.text').st_mtime):
                os.remove (cache_dir + '00CONCS.map')
                for f in os.listdir (cache_dir):
                    os.remove (f)
        except OSError:
            pass

    saved = load_map (cache_dir)
    subchash = getattr(corp, 'subchash', None)
    for i in range (len(q), 0, -1):
        cache_val = saved.get ((subchash, q[:i]))
        if cache_val:
            conc = PyConc (corp, 'l', os.path.join (cache_dir,
                                                    cache_val[0] + '.conc'))
            toprocess = i
            if toprocess == len(q):
                save = 0
            break
    else:
        conc = PyConc (corp, q[0][0], q[0][1:])
        toprocess = 1

    for act in range(toprocess, len(q)):
        command = q[act][0]
        if save and command in 'gae':
            # user specific/volatile actions, cannot save later
            save = 0
            conc.save (add_to_map (cache_dir, subchash, q[:act],
                                   conc.size()) + '.conc')
        getattr (conc, 'command_' + command) (q[act][1:])

    if save:
        conc.save (add_to_map (cache_dir, subchash, q, conc.size()) + '.conc')

    return conc


def get_conc_desc (q=[], cache_dir='cache', corpname='', subchash=None):
    desctext = {'q': 'Query',
                'a': 'Query',
                'r': 'Random sample',
                's': 'Sort',
                'f': 'Shuffle',
                'n': 'Negative filter',
                'p': 'Positive filter',
                'w': 'Word sketch item',
                't': 'Word sketch texttype item',
                'e': 'GDEX',
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
    saved = load_map (cache_dir + '/' + corpname + '/')
    q = tuple (q)
    
    for i in range (len(q)):
        size = saved.get ((subchash, q[:i+1]), ('',''))[1]
        opid = q[i][0]
        args = q[i][1:]
        url1p = [('q', qi) for qi in q[:i]]
        url2 = urlencode ([('q', qi) for qi in q[:i+1]])
        op = desctext.get (opid)
        formname = forms.get(opid, ('',''))
        if formname[1]:
            url1p.append ((formname[1], args))

        if opid == 's' and args[0] != '*' and i > 0:
            sortopt = {'-1<0': 'left context',
                       '0<0~': 'node',
                       '1>0~': 'right context'}
            sortattrs = args.split()
            if len (sortattrs) > 2:
                op = 'Multilevel Sort'
            args = '%s in %s' % (sortattrs[0].split('/')[0],
                                 sortopt.get(sortattrs[1][:4], sortattrs[1]))
            url1p.append (('skey', {'-1':'lc', '0<': 'kw', '1>': 'rc'}
                           .get (sortattrs[1][:2], '')))

        if op:
            if formname[0]:
                url1 = '%s?%s' % (formname[0], urlencode(url1p))
            else:
                url1 = ''
            desc.append ((op, args, url1, url2, size))
    return desc

def get_conc_labelmap (infopath):
    labels = {}
    try:
        from xml.etree.ElementTree import parse
        annoti = parse (infopath)
        for e in annoti.find('labels'):
            labels[e.find('n').text] = e.find('lab').text
    except IOError, err:
        print >>stderr, 'get_conc_labelmap: %s' % err 
        pass
    return labels

number_re = re.compile ('[0-9]+$')

def lngrp_sortcrit (lab, separator='.'):
    def num2sort (n):
        if number_re.match (n):
            return ('n', int(n))
        else:
            return ('c', n)
    if not lab:
        return [('x','x')]
    return map (num2sort, lab.split (separator, 3))

def lngrp_sortstr (lab, separator='.'):
    f = {'n': 'n%03g', 'c': 'c%s', 'x': '%s'}
    return '|'.join([f[c] % s for c,s in lngrp_sortcrit(lab, separator)])


def format_labelmap (labelmap, separator='.'):
    matrix = {}
    for n,lab in labelmap.items():
        if lab:
            pref = lab.split (separator)[0]
            matrix.setdefault (pref, []).append ((lngrp_sortcrit(lab), lab, n))
    prefixes = [(lngrp_sortcrit(p), p) for p in matrix.keys()]
    prefixes.sort()
    lines = []
    for s, pref in prefixes:
        line = matrix[pref]
        line.sort()
        lines.append ({'Items': [{'n':n, 'lab':lab} for (s, lab,n) in line]})
    return lines


def get_stored_conc (corp, concname, conc_dir):
    basecorpname = corp.corpname.split(':')[0]
    conc_dir = os.path.join (conc_dir, basecorpname)
    if not os.path.isdir (conc_dir):
        os.makedirs (conc_dir)
    cpath = os.path.join (conc_dir, concname)
    conc = PyConc (corp, 'l', cpath + '.conc')
    conc.labelmap = get_conc_labelmap (cpath + '.info')
    return conc


def get_full_ref (corp, pos):
    data = {}
    refs = [(n == '#' and ('Token number', pos) or
             (n, corp.get_attr(n).pos2str (pos)))
            for n in corp.get_conf ('FULLREF').split(',')]
    data['Refs'] = [{'name': (corp.get_conf (n+'.LABEL') or n), 'val': v}
                    for n,v in refs]
    for n,v in refs:
        data [n.replace('.','_')] = v
    return data


def get_detail_context (corp, pos, hitlen=1,
                        detail_left_ctx=40, detail_right_ctx=40,
                        addattrs=[], attrsep='/', detail_ctx_incr=60):
    try:
        maxdetail = int (corp.get_conf ('MAXDETAIL'))
    except:
        maxdetail = 0
    if maxdetail:
        if detail_left_ctx > maxdetail:
            detail_left_ctx = maxdetail
        if detail_right_ctx > maxdetail:
            detail_right_ctx = maxdetail
    if detail_left_ctx > pos:
        detail_left_ctx = pos
    attrs = map (corp.get_attr, ['word'] + addattrs)
    tit = [a.textat (pos - detail_left_ctx) for a in attrs]
    data = {}
    data['left'] = ' '.join ([attrsep.join ([a.next() for a in tit])
                              for x in range (detail_left_ctx)])
    data['kwic'] = ' '.join ([attrsep.join ([a.next() for a in tit])
                              for x in range (hitlen)])
    data['right'] = ' '.join ([attrsep.join ([a.next() for a in tit])
                               for x in range (detail_right_ctx)])

    refbase = 'pos=%i;' % pos
    if hitlen != 1:
        refbase += 'hitlen=%i;' % hitlen
    data['leftlink'] = refbase + ('detail_left_ctx=%i;detail_right_ctx=%i'
                                  % (detail_left_ctx + detail_ctx_incr,
                                     detail_right_ctx))
    data['rightlink'] = refbase + ('detail_left_ctx=%i;detail_right_ctx=%i'
                                   % (detail_left_ctx,
                                      detail_right_ctx + detail_ctx_incr))
    data['righttoleft'] = corp.get_conf ('RIGHTTOLEFT')
    data['pos'] = pos
    return data




if __name__ == '__main__':
    import corplib
    cm = corplib.CorpusManager()
    #cc = PyConc('bnc:text', 'l', 'pokus')
    #cc = PyConc('susanne', 'q', '"dream"')
    cc = PyConc(cm.get_Corpus('bnc'), 'l', 'help')
    #printkwic (cc)
    #print cc.collocs()
    pass
