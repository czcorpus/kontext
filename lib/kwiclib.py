# Copyright (c) 2003-2009  Pavel Rychly
# Copyright (c) 2014  Institute of the Czech National Corpus
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

from functools import partial
import re
import itertools

import manatee
from l10n import import_string, export_string
from structures import FixedDict


def lngrp_sortcrit(lab, separator='.'):
    # TODO
    def num2sort(n):
        if re.compile('[0-9]+$').match(n):
            return 'n', int(n)
        else:
            return 'c', n
    if not lab:
        return [('x', 'x')]
    return map(num2sort, lab.split(separator, 3))


def format_labelmap(labelmap, separator='.'):
    # TODO analyze purpose of this function (it seems to be not used)
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


def tokens2strclass(tokens):
    """
    Converts internal data structure produced by KwicLine and CorpRegion containing tokens and
    respective HTML classes into a more suitable form.

    arguments:
    tokens -- a tuple of the following format: ('a token', '{class1 class2}', 'another token', '{class3}',...)

    returns:
    a list of dicts {'str': '[token]', 'class': '[classes]'}
    """
    return [{'str': tokens[i], 'class': tokens[i + 1].strip('{}')}
            for i in range(0, len(tokens), 2)]


class KwicPageData(FixedDict):
    """
    Defines data required to render a KWIC page
    """
    Lines = None
    GroupNumbers = None
    prevlink = None
    firstlink = None
    fromp = None
    numofpages = None
    Page = None
    nextlink = None
    lastlink = None
    concsize = None
    result_arf = None
    result_relative_freq = None
    KWICCorps = ()
    CorporaColumns = ()


class Kwic(object):
    """
    KWIC related data preparation utilities

    arguments:
    corpus -- a manatee.Corpus instance
    corpus_fullname -- full (internal) name of the corpus (e.g. with path prefix if used)
    conc -- a manatee.Concordance instance
    """
    def __init__(self, corpus, corpus_fullname, conc):
        self.corpus = corpus
        self.corpus_fullname = corpus_fullname
        self.conc = conc
        self.corpus_encoding = self.corpus.get_conf('ENCODING')
        self.import_string = partial(import_string, from_encoding=self.corpus_encoding)
        self.export_string = partial(export_string, to_encoding=self.corpus_encoding)

    def kwicpage(self, speech_attr=None, fromp=1, line_offset=0, leftctx='-5', rightctx='5',
                 attrs='word', ctxattrs='word', refs='#', structs='p', pagesize=40, labelmap={},
                 righttoleft=False, alignlist=[], hidenone=0):
        """
        Generates template data for page displaying provided concordance

        arguments:
        speech_attr -- 2-tuple sets a name of a speech attribute and structure (struct, attr) or None if speech is not present
        fromp -- page number (starts from 1)
        line_offset -- first line of the listing (starts from 0)
        leftctx -- str, optional (default is '-5'), how many characters/positions/whatever_struct_attrs display on the left side
        rightctx -- str, optional (default is '5'), how many characters/positions/whatever_struct_attrs display on the right side
        attrs -- str, optional (default is 'word'), attributes to be displayed
        ctxattrs -- str, optional (default is 'word')
        refs -- str, optional (default is '#'), references to be displayed
        structs -- str, optional (default is 'p')
        pagesize -- int, optional (default is 40), number of lines per page
        labelmap -- dict, optional (default is {}) ???
        righttoleft -- bool, optional (default is False), whether text flows from right to left
        alignlist -- list, optional (default is [])
        hidenone -- int (0 or 1), whether display ===EMPTY=== or '' in case a value is empty

        returns:
        KwicPageData converted into a dict
        """
        refs = refs.replace('.MAP_OUP', '')  # to be removed ...
        try:
            fromp = int(fromp)
            if fromp < 1:
                fromp = 1
        except:
            fromp = 1

        out = KwicPageData()
        out.Lines = self.kwiclines(speech_attr, (fromp - 1) * pagesize + line_offset,
                                   fromp * pagesize + line_offset, leftctx, rightctx, attrs, ctxattrs,
                                   refs, structs, labelmap, righttoleft, alignlist)

        self.add_aligns(out, (fromp - 1) * pagesize + line_offset, fromp * pagesize + line_offset,
                        leftctx, rightctx, attrs, ctxattrs, refs, structs, labelmap, righttoleft, alignlist)
        if len(out.CorporaColumns) == 0:
            out.CorporaColumns = [dict(n=self.corpus.corpname, label=self.corpus.get_conf('NAME'))]
            out.KWICCorps = [self.corpus.corpname]

        if labelmap:
            out['GroupNumbers'] = format_labelmap(labelmap)
        if fromp > 1:
            out.prevlink = 'fromp=%i' % (fromp - 1)
            out.firstlink = 'fromp=1'
        if self.conc.size() > pagesize:
            out.fromp = fromp
            out.numofpages = numofpages = (self.conc.size() - 1) / pagesize + 1
            if numofpages < 30:
                out.Page = [{'page': x} for x in range(1, numofpages + 1)]
            if fromp < numofpages:
                out.nextlink = 'fromp=%i' % (fromp + 1)
                out.lastlink = 'fromp=%i' % numofpages
        out.concsize = self.conc.size()

        if type(self.corpus) == manatee.SubCorpus:
            out.result_arf = ''
        else:
            out.result_arf = round(self.conc.compute_ARF(), 2)

        if type(self.corpus) is manatee.SubCorpus:
            corpsize = self.corpus.search_size(
            )  # TODO this is unverified solution trying to bypass possible manatee bug
        else:
            corpsize = self.corpus.size()
        out.result_relative_freq = round(
            self.conc.size() / (float(corpsize) / 1e6), 2)
        if hidenone:
            for line, part in itertools.product(out.Lines, ('Kwic', 'Left', 'Right')):
                for item in line[part]:
                    item['str'] = item['str'].replace('===NONE===', '')
        return dict(out)

    def add_aligns(self, result, fromline, toline, leftctx='40#', rightctx='40#',
                   attrs='word', ctxattrs='word', refs='#', structs='p', labelmap={}, righttoleft=False,
                   alignlist=[]):
        """
        Adds lines from aligned corpora. Method modifies passed KwicPageData instance by setting
        respective attributes.

        arguments:
        result -- KwicPageData type is required
        """
        def create_empty_cell():
            return {'rightsize': 0, 'hitlen': ';hitlen=9', 'Right': [], 'Kwic': [], 'linegroup': '_', 'leftsize': 0,
                    'ref': '', 'rightspace': '', 'leftspace': '', 'kwiclen': 0, 'toknum': None,
                    'Left': []}

        def fix_length(arr, length):
            return arr + [create_empty_cell() for _ in range(length - len(arr))]

        if not alignlist:
            return
        al_lines = []
        corps_with_colls = manatee.StrVector()
        self.conc.get_aligned(corps_with_colls)
        result.KWICCorps = [c for c in corps_with_colls]
        if self.corpus.corpname not in result.KWICCorps:
            result.KWICCorps = [self.corpus.corpname] + result.KWICCorps
        result.CorporaColumns = [dict(n=c.get_conffile(), label=c.get_conf('NAME') or c.get_conffile())
                                 for c in [self.conc.orig_corp] + alignlist]
        for al_corp in alignlist:
            al_corpname = al_corp.get_conffile()
            if al_corpname in corps_with_colls:
                self.conc.switch_aligned(al_corp.get_conffile())
                al_lines.append(self.kwiclines(None, fromline, toline, leftctx, rightctx, attrs, ctxattrs,
                                               refs, structs, labelmap, righttoleft))
            else:
                self.conc.switch_aligned(self.conc.orig_corp.get_conffile())
                self.conc.add_aligned(al_corp.get_conffile())
                self.conc.switch_aligned(al_corp.get_conffile())
                al_lines.append(
                    self.kwiclines(None, fromline, toline, '0', '0', 'word', '', refs, structs, labelmap, righttoleft))

        # It appears that Manatee returns lists of different lengths in case some translations
        # are missing at the end of a concordance. Following block fixes this issue.
        al_lines_fixed = [fix_length(item, len(result.Lines)) for item in al_lines]
        aligns = zip(*al_lines_fixed)
        for i, line in enumerate(result.Lines):
            line['Align'] = aligns[i]

    @staticmethod
    def separate_speech_struct_from_tag(speech_segment, text):
        """
        Removes structural attribute related to speech file identification.
        E.g. getting input "<seg foo=bar speechfile=1234.wav time=1234>lorem ipsum</seg>" and
        having configuration directive "speech_segment == seg.speechfile" the function
        returns "<seg foo=bar time=1234>lorem ipsum</seg>"

        arguments:
        speech_segment -- 2-tuple (struct_name, attr_name)
        text -- a string to be processed

        returns:
        2-tuple (modified string, structural attribute value)
        """
        import re

        speech_struct, speech_struct_attr = speech_segment if speech_segment else (None, None)
        pattern = r"^(<%s\s+.*)%s=([^\s>]+)(\s.+|>)$" % (
            speech_struct, speech_struct_attr)
        srch = re.search(pattern, text)
        if srch is not None:
            return srch.group(1).rstrip() + srch.group(3), srch.group(2)
        return text, ''

    @staticmethod
    def remove_tag_from_line(line, tag_name):
        """
        arguments:
        line -- list of dicts containing at least the key 'str'
          line as used in postproc_kwicline
        tag_name -- str

        returns:
        the same object as the 'line' parameter
        """
        import re

        for item in line:
            item['str'] = re.sub('<%s[^>]*>' % tag_name, '', re.sub(
                '</%s>' % tag_name, '', item['str']))
        return line

    @staticmethod
    def line_parts_contain_speech(line_left, line_right):
        """
        Tests whether the line's left and right parts contain speech information
        """
        for fragment in line_left + line_right:
            if 'open_link' in fragment or 'close_link' in fragment:
                return True
        return False

    def postproc_kwicline_part(self, speech_segment, line, column, filter_speech_tag, prev_speech_id=None):
        """
        arguments:
        speech_attr -- 2-tuple (struct_name, attr_name)
        line -- list of dicts {'str': '...', 'class': '...'}
        column -- str, one of {'left', 'kwic', 'right'}; specifies position according to KWIC
        filter_speech_tag -- if True then whole speech tag is removed else only its 'speech attribute'
        prev_speech_id -- str identifier of the previously processed speech segment

        Returns:
        2-tuple: modified line and the last speech id (which is necessary to obtain proper speech ID in case of partial
        segment on the "left" left column of a KWIC line and similarly in case of a partial segment on the "right"
        column of a KWIC line - because the KWIC word itself separates left and right columns).
        """
        import re
        import urllib

        newline = []
        speech_struct_str = speech_segment[0] if speech_segment and len(speech_segment) > 0 else None
        fragment_separator = '<%s' % speech_struct_str
        last_fragment = None
        last_speech_id = prev_speech_id
        create_speech_path = lambda sp_id: urllib.urlencode({'corpname': self.corpus_fullname, 'chunk': sp_id})

        for item in line:
            item['str'] = self.import_string(item['str'])
            fragments = [x for x in re.split('(<%s[^>]*>|</%s>)' % (speech_struct_str, speech_struct_str), item['str'])
                         if x != '']
            for fragment in fragments:
                frag_ext, speech_id = self.separate_speech_struct_from_tag(speech_segment, fragment)
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
                newline.append(newline_item)
                last_fragment = newline_item
        # we have to treat specific situations related to the end of the
        # concordance line
        if last_fragment is not None \
                and re.search('^<%s(>|[^>]+>)$' % speech_struct_str, last_fragment['str'])\
                and column == 'right':
            del(last_fragment['open_link'])
        if filter_speech_tag:
            self.remove_tag_from_line(newline, speech_struct_str)
        return newline, last_speech_id

    @staticmethod
    def non1hitlen(hitlen):
        return '' if hitlen == 1 else '%i' % hitlen

    @staticmethod
    def isengword(strclass):
        # return bidirectional(word[0]) in ('L', 'LRE', 'LRO')
        return 'ltr' in strclass['class'].split()

    @staticmethod
    def update_right_to_left(leftwords, rightwords):
        """
        change order for "English" context of "English" keywords
        """
        # preceding words
        nprev = len(leftwords) - 1
        while nprev >= 0 and Kwic.isengword(leftwords[nprev]):
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
               and Kwic.isengword(rightwords[nfollow])):
            nfollow += 1
        moveright = rightwords[:nfollow]
        del rightwords[:nfollow]
        leftwords = leftwords + moveright
        rightwords = moveleft + rightwords
        return leftwords, rightwords

    def kwiclines(self, speech_segment, fromline, toline, leftctx='-5', rightctx='5',
                  attrs='word', ctxattrs='word', refs='#', user_structs='p', labelmap={}, righttoleft=False,
                  alignlist=[], align_attrname='align', aattrs='word', astructs=''):
        """
        Generates list of 'kwic' (= keyword in context) lines according to
        the provided Concordance object and additional parameters (like
        page number, width of the left and right context etc.).

        arguments:
        speech_segment -- 2-tuple
        ...

        returns:
        a dictionary containing all the required line data (left context, kwic, right context,...)
        """

        # structs represent which structures are requested by user
        # all_structs contain also internal structures needed to render
        # additional information (like the speech links)
        all_structs = user_structs
        if speech_segment:
            speech_struct_attr_name = '.'.join(speech_segment)
            speech_struct_attr = self.corpus.get_attr(speech_struct_attr_name)
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
        else:
            leftlabel, rightlabel = 'Left', 'Right'

        # self.conc.corp() must be used here instead of self.corpus
        # because in case of parallel corpora these two are different and only the latter one is correct
        kl = manatee.KWICLines(self.conc.corp(), self.conc.RS(True, fromline, toline), leftctx, rightctx, attrs, ctxattrs,
                               all_structs, refs)
        labelmap = labelmap.copy()
        labelmap['_'] = '_'
        maxleftsize = 0
        maxrightsize = 0
        filter_out_speech_tag = speech_segment and speech_segment[0] not in user_structs \
            and speech_struct_attr_name in all_structs

        i = fromline
        while kl.nextline():
            linegroup = str(kl.get_linegroup() or '_')
            linegroup = labelmap.get(linegroup, '#' + linegroup)
            if speech_segment:
                leftmost_speech_id = speech_struct_attr.pos2str(kl.get_ctxbeg())
            else:
                leftmost_speech_id = None
            leftwords, last_left_speech_id = self.postproc_kwicline_part(speech_segment,
                                                                         tokens2strclass(kl.get_left()),
                                                                         'left', filter_out_speech_tag,
                                                                         leftmost_speech_id)
            kwicwords, last_left_speech_id = self.postproc_kwicline_part(speech_segment,
                                                                         tokens2strclass(kl.get_kwic()),
                                                                         'kwic',
                                                                         filter_out_speech_tag,
                                                                         last_left_speech_id)
            rightwords = self.postproc_kwicline_part(speech_segment, tokens2strclass(kl.get_right()), 'right',
                                                     filter_out_speech_tag, last_left_speech_id)[0]

            if righttoleft and Kwic.isengword(kwicwords[0]):
                leftwords, rightwords = Kwic.update_right_to_left(leftwords, rightwords)

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
            line_data = dict(toknum=kl.get_pos(),
                             hitlen=Kwic.non1hitlen(kl.get_kwiclen()),
                             kwiclen=kl.get_kwiclen(),
                             ref=self.import_string(kl.get_refs()),
                             Kwic=kwicwords,
                             linegroup=linegroup,
                             leftsize=leftsize,
                             rightsize=rightsize,
                             linenum=i)
            line_data[leftlabel] = leftwords
            line_data[rightlabel] = rightwords
            lines.append(line_data)
            i += 1
        for line in lines:
            line['leftspace'] = ' ' * (maxleftsize - line['leftsize'])
            line['rightspace'] = ' ' * (maxrightsize - line['rightsize'])
        return lines

    def get_sort_idx(self, q=[], pagesize=20):
        """
        In case sorting is active this method generates shortcuts to pages where new
        first letter of sorted keys (it can be 'left', 'kwic', 'right') starts.

        arguments:
        q -- a query (as a list)
        pagesize -- number of items per page

        returns:
        a list of dicts with following structure (example):
            [{'page': 1, 'label': u'a'}, {'page': 1, 'label': u'A'}, {'page': 2, 'label': u'b'},...]
        """
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
        self.conc.sort_idx(crit, vals, idx, just_letters)
        out = [(v, pos / pagesize + 1) for v, pos in zip(vals, idx)]
        if just_letters:
            result = []
            keys = []
            for v, p in out:
                if not v[0] in keys:
                    result.append((v[0], p))
                    keys.append(v[0])
            out = result

        ans = []
        for v, p in out:
            try:
                ans.append({'page': p, 'label': self.import_string(v)})
            except UnicodeDecodeError:
                # Without manatee.set_encoding, manatee appears to produce
                # few extra undecodable items. Ignoring them produces
                # the same result as in case of official Bonito app.
                pass
        return ans

