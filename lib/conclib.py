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
import sys
from sys import stderr
import time
import math

import manatee
import settings
import plugins
from butils import *
from languages import Languages

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


def tokens2strclass(tokens):
    return [{'str': tokens[i], 'class': tokens[i + 1].strip('{}')}
            for i in range(0, len(tokens), 2)]


def printkwic(conc, froml=0, tol=5, leftctx='15#', rightctx='15#',
              attrs='word', refs='#', maxcontext=0):
    def strip_tags(tokens):
        return ''.join([tokens[i] for i in range(0, len(tokens), 2)])
    kl = manatee.KWICLines(
        conc, leftctx, rightctx, attrs, 'word', 'p', refs, maxcontext)
    for line in range(froml, tol):
        kl.nextline(line)
        print '%s %s <%s> %s' % (kl.get_refs(), strip_tags(kl.get_left()),
                                 strip_tags(kl.get_kwic()),
                                 strip_tags(kl.get_right()))


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


def add_block_items(items, attr='class', val='even', block_size=3):
    for i in [i for i in range(len(items)) if (i / block_size) % 2]:
        items[i][attr] = val
    return items


def kwicpage(
    corpus, conc, speech_attr=None, fromp=1, line_offset=0, leftctx='-5', rightctx='5', attrs='word',
    ctxattrs='word', refs='#', structs='p', pagesize=40,
    labelmap={}, righttoleft=False, alignlist=[], copy_icon=0,
        tbl_template='none', hidenone=0):
    """
    Generates template data for page displaying provided concordance

    Parameters
    ----------
    corpus : manatee.Corpus
      corpus we are working with
    conc : manatee.Concordance
      a concordance object
    speech_attr : 2-tuple
      sets a name of a speech attribute and structure (struct, attr) or None if speech is not present
    fromp : int
      page number (starts from 1)
    line_offset : int
      first line of the listing (starts from 0)
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
    pagesize : int, optional (default is 40)
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
    hidenone : int (0 or 1)
      TODO

    Returns
    -------
    custom dict containing data as required by related HTML template
    """
    corpus, corpus_fullname = corpus
    refs = refs.replace('.MAP_OUP', '')  # to be removed ...
    try:
        fromp = int(fromp)
        if fromp < 1:
            fromp = 1
    except:
        fromp = 1
    out = {'Lines':
           kwiclines(corpus_fullname, conc, speech_attr, (
                   fromp - 1) * pagesize + line_offset, fromp * pagesize + line_offset,
           leftctx, rightctx, attrs, ctxattrs, refs, structs,
           labelmap, righttoleft, alignlist)}
    add_aligns(corpus_fullname, out, conc, (fromp - 1) * pagesize + line_offset, fromp * pagesize + line_offset,
               leftctx, rightctx, attrs, ctxattrs, refs, structs,
               labelmap, righttoleft, alignlist)
    if copy_icon:
        from tbl_settings import tbl_refs, tbl_structs
        sen_refs = tbl_refs.get(tbl_template, '') + ',#'
        sen_refs = sen_refs.replace('.MAP_OUP', '')  # to be removed ...
        sen_structs = tbl_structs.get(tbl_template, '') or 'g'
        sen_lines = kwiclines(corpus_fullname, conc, speech_attr, (fromp - 1) * pagesize + line_offset, fromp * pagesize + line_offset,
            '-1:s', '1:s', refs=sen_refs, user_structs=sen_structs)
        for old, new in zip(out['Lines'], sen_lines):
            old['Sen_Left'] = new['Left']
            old['Sen_Right'] = new['Right']
            old['Tbl_refs'] = new['Tbl_refs']
    if labelmap:
        out['GroupNumbers'] = format_labelmap(labelmap)
    if fromp > 1:
        out['prevlink'] = 'fromp=%i' % (fromp - 1)
        out['firstlink'] = 'fromp=1'
    if conc.size() > pagesize:
        out['fromp'] = fromp
        out['numofpages'] = numofpages = (conc.size() - 1) / pagesize + 1
        if numofpages < 30:
            out['Page'] = [{'page': x} for x in range(1, numofpages + 1)]
        if fromp < numofpages:
            out['nextlink'] = 'fromp=%i' % (fromp + 1)
            out['lastlink'] = 'fromp=%i' % numofpages
    out['concsize'] = conc.size()

    if type(corpus) == manatee.SubCorpus:
        out['result_arf'] = ''
    else:
        out['result_arf'] = round(conc.compute_ARF(), 2)

    if type(corpus) is manatee.SubCorpus:
        corpsize = corpus.search_size(
        )  # TODO this is unverified solution trying to bypass possible manatee bug
    else:
        corpsize = corpus.size()
    out['result_relative_freq'] = round(
        conc.size() / (float(corpsize) / 1e6), 2)

    out['result_relative_freq_rel_to'] = _('related to the whole %s') % corpus.get_conf('NAME')
    if hasattr(corpus, 'subcname'):
        out['result_relative_freq_rel_to'] += ':%s' % getattr(corpus, 'subcname', '')
    out['result_relative_freq_rel_to'] = '(%s)' % out['result_relative_freq_rel_to']

    if hidenone:
        for line in out['Lines']:
            for part in ('Kwic', 'Left', 'Right'):
                for item in line[part]:
                    item['str'] = item['str'].replace('===NONE===', '')

    return out


def add_aligns(
    corpus_fullname, result, conc, fromline, toline, leftctx='40#', rightctx='40#',
    attrs='word', ctxattrs='word', refs='#', structs='p',
        labelmap={}, righttoleft=False, alignlist=[]):
    if not alignlist:
        return
    al_lines = []
    corps_with_colls = manatee.StrVector()
    conc.get_aligned(corps_with_colls)
    result['CollCorps'] = corps_with_colls
    result['Par_conc_corpnames'] = [{'n': c.get_conffile(),
                                     'label': c.get_conf('NAME')
                                     or c.get_conffile()}
                                    for c in [conc.orig_corp] + alignlist]
    for al_corp in alignlist:
        al_corpname = al_corp.get_conffile()
        if al_corpname in corps_with_colls:
            conc.switch_aligned(al_corp.get_conffile())
            al_lines.append(
                kwiclines(corpus_fullname, conc, None, fromline, toline, leftctx,
                          rightctx, attrs, ctxattrs, refs,
                          structs, labelmap, righttoleft))
        else:
            conc.switch_aligned(conc.orig_corp.get_conffile())
            conc.add_aligned(al_corp.get_conffile())
            conc.switch_aligned(al_corp.get_conffile())
            al_lines.append(
                kwiclines(corpus_fullname, conc, None, fromline, toline, '0',
                          '0', 'word', '', refs, structs,
                          labelmap, righttoleft))
    aligns = zip(*al_lines)
    for i, line in enumerate(result['Lines']):
        line['Align'] = aligns[i]


def separate_speech_struct_from_tag(speech_segment, text):
    """
    Removes structural attribute related to speech file identification.
    E.g. getting input "<seg foo=bar speechfile=1234.wav time=1234>lorem ipsum</seg>" and
    having configuration directive "speech_segment == seg.speechfile" the function
    returns "<seg foo=bar time=1234>lorem ipsum</seg>"

    Parameters
    ----------
    speech_segment: 2-tupe
        (struct_name, attr_name)
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

    speech_struct, speech_struct_attr = speech_segment if speech_segment else (None, None)
    pattern = r"^(<%s\s+.*)%s=([^\s>]+)(\s.+|>)$" % (
        speech_struct, speech_struct_attr)
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
        item['str'] = re.sub('<%s[^>]*>' % tag_name, '', re.sub(
            '</%s>' % tag_name, '', item['str']))
    return line


def line_parts_contain_speech(line_left, line_right):
    """
    Tests whether the line's left and right parts contain speech information
    """
    for fragment in line_left + line_right:
        if 'open_link' in fragment or 'close_link' in fragment:
            return True
    return False


def postproc_kwicline_part(corpus_name, speech_segment, treex_id, line, column, filter_speech_tag, prev_speech_id=None):
    """
    Parameters
    ----------
    corpus_name : str
      name of the corpus
    speech_attr: 2-tupe
      (struct_name, attr_name)
    treex_id: str
      name of the json file
    line : list of dicts
      contains keys 'str', 'class'
    column : str
      one of {'left', 'kwic', 'right'}; specifies position according to KWIC
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
      of partial segment on the "left" left column of a KWIC line and similarly
      in case of a partial segment on the "right" column of a KWIC line - because
      the KWIC word itself separates left and right columns).
    """
    import re
    import urllib

    newline = []
    speech_struct_str = speech_segment[0] if speech_segment and len(speech_segment) > 0 else None
    fragment_separator = '<%s' % speech_struct_str
    last_fragment = None
    last_speech_id = prev_speech_id
    create_speech_path = lambda sp_id: urllib.urlencode({'corpname': corpus_name, 'chunk': sp_id})
    create_treex_path = lambda treex_id: urllib.urlencode({'corpname': corpus_name, 'id': treex_id})

    for item in line:
        fragments = [x for x in re.split('(<%s[^>]*>|</%s>)' % (speech_struct_str, speech_struct_str), item['str']) if x != '']
        for fragment in fragments:
            frag_ext, speech_id = separate_speech_struct_from_tag(speech_segment, fragment)
            if not speech_id:
                speech_id = last_speech_id
            else:
                last_speech_id = speech_id
            newline_item = {
                'str': frag_ext,
                'class': item['class']
            }
            if frag_ext.startswith(fragment_separator):
                newline_item['open_link'] = {'speech_path': create_speech_path(speech_id)}
            elif frag_ext.endswith('</%s>' % speech_struct_str):
                newline_item['close_link'] = {'speech_path': create_speech_path(speech_id)}
            newline_item['treex_view'] = {'path': create_treex_path(treex_id)}
            newline.append(newline_item)
            last_fragment = newline_item
    # we have to treat specific situations related to the end of the
    # concordance line
    if last_fragment is not None \
            and re.search('^<%s(>|[^>]+>)$' % speech_struct_str, last_fragment['str'])\
            and column == 'right':
        del(last_fragment['open_link'])
    if filter_speech_tag:
        remove_tag_from_line(newline, speech_struct_str)
    return newline, last_speech_id


def kwiclines(corpus_fullname, conc, speech_segment, fromline, toline, leftctx='-5', rightctx='5',
    attrs='word', ctxattrs='word', refs='#', user_structs='p',
    labelmap={}, righttoleft=False, alignlist=[],
        align_attrname='align', aattrs='word', astructs=''):
    """
    Generates list of 'kwic' (= keyword in context) lines according to
    the provided Concordance object and additional parameters (like
    page number, width of the left and right context etc.).

    Parameters
    ----------
    corpus_fullname : str
    conc : manatee.Concordance
      concordance we are working with
    speech_attr : str
      if empty then no speech structure is present else a full attribute name
      (i.e. including a structure name - e.g. "seg.speech") is expected
    TODO

    Returns
    -------
    TODO
    """
    def non1hitlen(hitlen):
        if hitlen == 1:
            return ''
        else:
            return ';hitlen=%i' % hitlen

    corpus = conc.corp()
    # structs represent which structures are requested by user
    # all_structs contain also internal structures needed to render
    # additional information (like the speech links)
    all_structs = user_structs
    if speech_segment:
        speech_struct_attr_name = '.'.join(speech_segment)
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
        # from unicodedata import bidirectional

        def isengword(strclass):
            # return bidirectional(word[0]) in ('L', 'LRE', 'LRO')
            return 'ltr' in strclass['class'].split()
    else:
        leftlabel, rightlabel = 'Left', 'Right'
    kl = manatee.KWICLines(corpus, conc.RS(True, fromline, toline), leftctx, rightctx, attrs, ctxattrs,
                           all_structs, refs)

    labelmap = labelmap.copy()
    labelmap['_'] = '_'
    maxleftsize = 0
    maxrightsize = 0
    filter_out_speech_tag = speech_segment and speech_segment[0] not in user_structs \
        and speech_struct_attr_name in all_structs

    while kl.nextline():
        linegroup = str(kl.get_linegroup() or '_')
        linegroup = labelmap.get(linegroup, '#' + linegroup)
        if speech_segment:
            leftmost_speech_id = speech_struct_attr.pos2str(kl.get_ctxbeg())
        else:
            leftmost_speech_id = None
        if corpus_fullname == 'syntaxtest_cs_a': #change to corpus_fullname.contains('cs_a') - for all syntactically annotated corpora
            sent_id = get_sent_id(corpus, kl.get_pos())
            treex_id = sent_id +'.json'
        else:
            treex_id = ''
        leftwords, last_left_speech_id = postproc_kwicline_part(corpus_fullname, speech_segment,treex_id,
                                                                tokens2strclass(kl.get_left()),
                                                                'left', filter_out_speech_tag, leftmost_speech_id)
        kwicwords, last_left_speech_id = postproc_kwicline_part(corpus_fullname, speech_segment, treex_id,
                                                                tokens2strclass(kl.get_kwic()),
                                                                'kwic', filter_out_speech_tag, last_left_speech_id)
        rightwords = postproc_kwicline_part(corpus_fullname, speech_segment,treex_id,
                                            tokens2strclass(kl.get_right()), 'right',
                                            filter_out_speech_tag, last_left_speech_id)[0]

        if righttoleft:
            # change order for "English" context of "English" keywords
            if isengword(kwicwords[0]):
                # preceding words
                nprev = len(leftwords) - 1
                while nprev >= 0 and isengword(leftwords[nprev]):
                    nprev -= 1
                if nprev == -1:
                    # move whole context
                    moveleft = leftwords
                    leftwords = []
                else:
                    moveleft = leftwords[nprev + 1:]
                    del leftwords[nprev + 1:]

                # following words
                nfollow = 0
                while (nfollow < len(rightwords)
                       and isengword(rightwords[nfollow])):
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

        rightsize = 0
        for w in rightwords:
            if not w['class'] == 'strc':
                rightsize += len(w['str']) + 1
        if rightsize > maxrightsize:
            maxrightsize = rightsize

        lines.append({'toknum': kl.get_pos(),
                      'hitlen': non1hitlen(kl.get_kwiclen()),
                      'ref': kl.get_refs(),
                      'Tbl_refs': list(kl.get_ref_list()),
                      leftlabel: leftwords,
                      'Kwic': kwicwords,
                      rightlabel: rightwords,
                      'linegroup': linegroup,
                      'leftsize': leftsize,
                      'rightsize': rightsize,
                      })
    for l in lines:
        l['leftspace'] = ' ' * (maxleftsize - l['leftsize'])
        l['rightspace'] = ' ' * (maxrightsize - l['rightsize'])
    return lines


def strkwiclines(conc, fromline, toline=None, leftctx='-5', rightctx='5'):
    """
    TODO: no direct call found for this method
    """
    def tokens2str(tokens):
        return ''.join([tokens[i] for i in range(0, len(tokens), 2)])
    toline = toline or fromline + 1
    kl = manatee.KWICLines(conc, leftctx, rightctx, 'word', 'word', '', '')
    return [{'left': tokens2str(kl.get_left()),
             'kwic': tokens2str(kl.get_kwic()),
             'right': tokens2str(kl.get_right())}
            for line in range(fromline, toline) if kl.nextline(line)]


def get_sort_idx(conc, q=[], pagesize=20, enc='latin1'):
    crit = ''
    for qq in q:
        if qq.startswith('s') and not qq.startswith('s*'):
            crit = qq[1:]
    if not crit:
        return []
    vals = manatee.StrVector()
    idx = manatee.IntVector()
    if '.' in crit.split('/')[0]:
        just_letters = False
    else:
        just_letters = True
    conc.sort_idx(crit, vals, idx, just_letters)
    out = [(v, pos / pagesize + 1) for v, pos in zip(vals, idx)]
    if just_letters:
        result = []
        keys = []
        for v, p in out:
            if not v[0] in keys:
                result.append((v[0], p))
                keys.append(v[0])
        out = result
    return [{'page': p, 'label': v} for v, p in out]


class PyConc (manatee.Concordance):
    selected_grps = []

    def __init__(self, corp, action, params, sample_size=0, full_size=-1,
                 orig_corp=None):
        self.pycorp = corp
        self.corpname = corp.get_conffile()
        self.orig_corp = orig_corp or self.pycorp
        if action == 'q':
            # query
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
            manatee.Concordance.__init__(self, corp, params)
        elif action == 's':
            # stored in _conc_dir
            manatee.Concordance.__init__(self, corp,
                                         os.path.join(self.pycorp._conc_dir,
                                                      corp.corpname,
                                                      params + '.conc'))
        elif action == 'w':
            # word sketch
            import wmap
            incoll = 1
            if params[0] in [',', ':']:
                # seek list
                slist = wmap.IntVector(map(int, params[1:].split(',')))
                incoll += len([x for x in slist if x < 0])
                self.ws = wmap.WMap(corp.get_conf('WSBASE'),
                                    params[0] == ":" and 1 or 2,
                                    0, 0, self.corpname)
                # self.* prevents freeing at the end of constructor (async
                # conc)
                fs = self.ws.selected_poss(slist)
            elif params[0] == '-':
                # gramrel level
                self.ws = wmap.WMap(corp.get_conf('WSBASE'), 1,
                                    int(params[1:]), 0, self.corpname)
                fs = self.ws.poss()  # self to prevent freeing
            else:
                # only one seek
                self.ws = wmap.WMap(corp.get_conf('WSBASE'), 2, int(params),
                                    0, self.corpname)
                fs = self.ws.poss()  # self to prevent freeing (async conc)
            manatee.Concordance.__init__(self, corp, fs, incoll)
        elif action == 't':
            # text type wordsketch -- will be replaced with filtered sketches
            import wmap
            suff, seek = params.split()
            ws = wmap.WMap(corp.get_conf('WSBASE') + suff, 2, int(seek),
                           0, self.corpname)
            manatee.Concordance.__init__(self, corp, ws.poss())
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

    def pn_filter(self, options, ispositive, excludekwic = False):
        lctx, rctx, rank, query = options.split (None, 3)
        collnum = self.numofcolls() +1
        self.set_collocation(collnum, query + ';', lctx, rctx, int(rank),
                             excludekwic)
        self.delete_pnfilter(collnum, ispositive)

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
            valid = attr.str2id(unicode(value))
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
        if (tonbar and not(ml)):
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
            lines = [{'Word': [{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                      'freq': f, 'fbar': int(f * tofbar) + 1,
                      'norel': 1}
                     for w, f, nf in zip(words, freqs, norms)]

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
                'Items': add_block_items([x[1] for x in lines], block_size=2)}

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
                     'pfilter': qfilter % ('P', escape(colls.get_item())),
                     'nfilter': qfilter % ('N', escape(colls.get_item()))
                     })
            colls.next()
            i += 1

        head = [{'n': ''}, {'n': 'Freq', 's': 'f'}] \
            + [{'n': statdesc.get(s, s), 's': s} for s in cbgrfns]
        return {
            'Head': head,
            'Items': add_block_items(items),
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


def get_cached_conc_sizes(corp, q=[], cache_dir="cache", cachefile=None):
    if not cachefile:  # AJAX call
        q = tuple(q)
        subchash = getattr(corp, "subchash", None)
        cache_dir = cache_dir + '/' + corp.corpname + '/'
        saved = load_map(cache_dir)
        cache_val = saved.get((subchash, q))
        cachefile = os.path.join(cache_dir, cache_val[0] + '.conc')
    import struct
    cache = open(cachefile, "rb")
    flck_sh_lock(cache)
    cache.seek(15)
    finished = str(ord(cache.read(1)))
    (fullsize,) = struct.unpack("q", cache.read(8))
    cache.seek(32)
    (concsize,) = struct.unpack("i", cache.read(4))
    flck_unlock(cache)
    relconcsize = None
    if fullsize > 0:
        relconcsize = 1000000.0 * fullsize / corp.search_size()
    else:
        relconcsize = 1000000.0 * concsize / corp.search_size()
    return {'finished': finished, 'concsize': concsize, 'fullsize': fullsize,
            'relconcsize': relconcsize}


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


def compute_conc(corp, q, cache_dir, subchash, samplesize, fullsize):
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
                    conc = compute_conc(
                        corp, q, cache_dir, subchash, samplesize,
                                         fullsize)
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
                                 fullsize)
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

number_re = re.compile('[0-9]+$')


def lngrp_sortcrit(lab, separator='.'):
    def num2sort(n):
        if number_re.match(n):
            return ('n', int(n))
        else:
            return ('c', n)
    if not lab:
        return [('x', 'x')]
    return map(num2sort, lab.split(separator, 3))


def lngrp_sortstr(lab, separator='.'):
    f = {'n': 'n%03g', 'c': 'c%s', 'x': '%s'}
    return '|'.join([f[c] % s for c, s in lngrp_sortcrit(lab, separator)])


def format_labelmap(labelmap, separator='.'):
    matrix = {}
    for n, lab in labelmap.items():
        if lab:
            pref = lab.split(separator)[0]
            matrix.setdefault(pref, []).append((lngrp_sortcrit(lab), lab, n))
    prefixes = [(lngrp_sortcrit(p), p) for p in matrix.keys()]
    prefixes.sort()
    lines = []
    for s, pref in prefixes:
        line = matrix[pref]
        line.sort()
        lines.append(
            {'Items': [{'n': n, 'lab': lab} for (s, lab, n) in line]})
    return lines


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


def get_sent_id(corp, pos):
    data = {}
    refs = [(n == '#' and ('#', str(pos)) or
             (n, corp.get_attr(n).pos2str(pos)))
            for n in corp.get_conf('FULLREF').split(',') if n != settings.get('corpora', 'view_treex_files_path')]
    data['Refs'] = [{'name': n == '#' and _('Token number')
                             or corp.get_conf(n + '.LABEL') or n,
                     'val': v}
                    for n, v in refs]

    for n, v in refs:
        if n == 's.id':
            sent_id = v
    return sent_id

def get_detail_context(corp, pos, hitlen=1,
                        detail_left_ctx=40, detail_right_ctx=40,
                        addattrs=[], structs='', detail_ctx_incr=60):
    data = {}
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
        if maxdetail == 0:
            maxdetail = int(corp.get_conf('MAXCONTEXT'))
            if maxdetail == 0:
                maxdetail = sys.maxint
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
        seg['str'] = seg['str'].replace('===NONE===', '')
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


def fcs_search(corpus, fcs_query, max_rec, start):
    "aux function for federated content search: operation=searchRetrieve"
    corp, corpus_fullname = corpus
    if not fcs_query:
        raise Exception(7, 'fcs_query', 'Mandatory parameter not supplied')
    query = fcs_query.replace('+', ' ') # convert URL spaces
    exact_match = True # attr=".*value.*"
    if 'exact' in query.lower() and not '=' in query: # lemma EXACT "dog"
        pos = query.lower().index('exact') # first occurence of EXACT
        query = query[:pos] + '=' + query[pos+5:] # 1st exact > =
        exact_match = True
    attrs = corp.get_conf('ATTRLIST').split(',') # list of available attrs
    rq = '' # query for manatee
    try: # parse query
        if '=' in query: # lemma=word | lemma="word" | lemma="w1 w2" | word=""
            attr, term = query.split('=')
            attr = attr.strip()
            term = term.strip()
        else: # "w1 w2" | "word" | word
            attr = 'lemma'
            term = query.strip()
        if '"' in attr:
            raise Exception
        if '"' in term: # "word" | "word1 word2" | "" | "it is \"good\""
            if term[0] != '"' or term[-1] != '"': # check q. marks
                raise Exception
            term = term[1:-1].strip() # remove quotation marks
            if ' ' in term: # multi-word term
                if exact_match:
                    rq = ' '.join(['[%s="%s"]' % (attr, t)
                                   for t in term.split()])
                else:
                    rq = ' '.join(['[%s=".*%s.*"]' % (attr, t)
                                   for t in term.split()])
            elif term.strip() == '': # ""
                raise Exception # empty term
            else: # one-word term
                if exact_match:
                    rq = '[%s="%s"]' % (attr, term)
                else:
                    rq = '[%s=".*%s.*"]' % (attr, term)
        else: # must be single-word term
            if ' ' in term:
                raise Exception
            if exact_match: # build query
                rq = '[%s="%s"]' % (attr, term)
            else:
                rq = '[%s=".*%s.*"]' % (attr, term)
    except: # there was a problem when parsing
        raise Exception(10, query, 'Query syntax error')
    if not attr in attrs:
        raise Exception(16, attr, 'Unsupported index')
    try: # try to get concordance
        conc = get_conc(corp, q=['q' + rq])
    except Exception, e:
        raise Exception(10, repr(e), 'Query syntax error')
    page = kwicpage(corpus, conc)  # convert concordance
    if len(page['Lines']) < start:
        raise Exception(61, 'startRecord', 'First record position out of range')
    return [(kwicline['Left'][0]['str'], kwicline['Kwic'][0]['str'],
             kwicline['Right'][0]['str'], kwicline['ref'])
            for kwicline in page['Lines']][start:][:max_rec]


def fcs_scan(corpus, scan_query, max_ter, start):
    "aux function for federated content search: operation=scan"
    corp, corpus_fullname = corpus
    if not scan_query:
        raise Exception(7, 'scan_query', 'Mandatory parameter not supplied')
    query = scan_query.replace('+', ' ') # convert URL spaces
    exact_match = False
    if 'exact' in query.lower() and not '=' in query: # lemma ExacT "dog"
        pos = query.lower().index('exact') # first occurence of EXACT
        query = query[:pos] + '=' + query[pos+5:] # 1st exact > =
        exact_match = True
    attrs = corp.get_conf('ATTRLIST').split(',') # list of available attrs
    try:
        if '=' in query:
            attr, value = query.split('=')
            attr = attr.strip()
            value = value.strip()
        else: # must be in format attr = value
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
    if attr == 'fcs.resource':
        resources = []
        if value == 'root':
            if plugins.has_plugin('corptree'):
                corpora = plugins.corptree.list
                i = 0
                for item in corpora:
                    if i >= max_ter:
                        break
                    resource_info = {}
                    corpus_id = item['id']
                    c = manatee.Corpus(corpus_id)
                    corpus_title = c.get_conf('NAME')
                    resource_info['title'] = c.get_conf('NAME')
                    resource_info['landingPageURI'] = c.get_conf('INFOHREF')
                    resource_info['language'] = Languages().get_iso_code(c.get_conf('LANGUAGE'))
                    resource_info['description'] = c.get_conf('INFO')
                    resources.append((corpus_id, corpus_title, resource_info))
                    i += 1
            else:
                resource_info = {}
                c = manatee.Corpus(corpus_fullname)
                corpus_title = c.get_conf('NAME')
                resource_info['title'] = c.get_conf('NAME')
                resource_info['landingPageURI'] = c.get_conf('INFOHREF')
                resource_info['language'] = Languages().get_iso_code(c.get_conf('LANGUAGE'))
                resource_info['description'] = c.get_conf('INFO')
                resources.append((corpus_fullname, corpus_title, resource_info))
        return resources
    elif not attr in attrs:
        raise Exception(16, attr, 'Unsupported index')
    import corplib
    if exact_match:
        wlpattern = '^' + value + '$'
    else:
        wlpattern = '.*' + value + '.*'
    wl = corplib.wordlist(corp, wlattr=attr, wlpat=wlpattern, wlsort='f')
    return [(d['str'], d['freq']) for d in wl][start:][:max_ter]

