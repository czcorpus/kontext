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


class Pagination(object):
    first_page = 1
    prev_page = None
    next_page = None
    last_page = None

    def export(self):
        return dict(firstPage=self.first_page, prevPage=self.prev_page,
                    nextPage=self.next_page, lastPage=self.last_page)


class KwicPageData(FixedDict):
    """
    Defines data required to render a KWIC page
    """
    Lines = None
    GroupNumbers = None
    fromp = None
    numofpages = None
    Page = None
    pagination = None
    concsize = None
    result_arf = None
    result_relative_freq = None
    KWICCorps = ()
    CorporaColumns = ()


class AttrsMerge(object):
    """
    Handles user and mouseover attributes. While Manatee returns
    just a bunch of values joined into a single string, in KonText
    we need two groups of attributes:
    1) user-selected attributes (= the ones visible in a "Bonito-open" way)
    2) configured mouseover attributes (= the ones visible on mouse-over)

    This class handles these two groups at once and is able to export values
    for both mentioned cases.
    """
    def __init__(self, attrs, mouseover_attrs):
        if type(attrs) in (str, unicode):
            attrs = attrs.split(',')
        self._attrs = []
        for item in attrs + [x for x in mouseover_attrs if x not in attrs]:
            flag = 0
            if item in attrs:
                flag += 1
            if item in mouseover_attrs:
                flag += 2
            self._attrs.append((item, flag))

    def export_all(self):
        return ','.join(x[0] for x in self._attrs)

    def process_output(self, attrs):
        """
         Filter out mouse_over items from attribute string
         produced by Manatee (e.g.: "/-/Pred_Co//VB-S---3P-AA---I/b\u00fdt")
         and return them as separate data items.data

         This functions expects the delimiter used for attributes
         (typically '/') cannot be found within tokens. Otherwise
         the parser may fail in a bad way.

         arguments:
         attrs -- a string containing attributes separated by '/'
                  (e.g.: /-/Pred_Co//VB-S---3P-AA---I/b\u00fdt)
         token -- a token the attributes belong to

         return:
         a 2-tuple (output_string, mouseover_list_of_pairs)
        """
        # input string starts with '/'
        # empty 0-th element in split string represents 'word'
        # which is omitted in attrs string (it exists as a separate value)
        tmp = attrs.split('/')
        ans = []
        mouseover = []
        for i in range(len(tmp)):
            if self._attrs[i][1] & 1 == 1:
                ans.append(tmp[i])
            if self._attrs[i][1] & 2 == 2:
                mouseover.append((self._attrs[i][0], tmp[i]))
        return '/'.join(ans), mouseover


class KwicLinesArgs(object):
    """
    note: please see KwicPageArgs attributes for more information
    """
    speech_segment = None
    fromline = None
    toline = None
    leftctx = '-5'
    rightctx = '5'
    attrs = 'word'
    ctxattrs = 'word'
    refs = '#'
    user_structs = 'p'
    labelmap = {}
    righttoleft = False
    alignlist=()
    token_mouseover = ()

    def create_attrs_merge(self):
        return AttrsMerge(self.attrs, self.token_mouseover)

    def copy(self, **kw):
        ans = KwicLinesArgs()
        for k, v in self.__dict__:
            setattr(ans, k, v)
        for k, v in kw:
            setattr(ans, k, v)
        return ans


class KwicPageArgs(object):
    # 2-tuple sets a name of a speech attribute and structure (struct, attr) or None if speech is not present
    speech_attr = None

    # page number (starts from 1)
    fromp = 1

    # first line of the listing (starts from 0)
    line_offset = 0

    # how many characters/positions/whatever_struct_attrs display on the left side; Use 'str' type!
    leftctx = '-5'

    # how many characters/positions/whatever_struct_attrs display on the right side; Use 'str' type!
    rightctx = '5'

    # positional attributes to be displayed for KWIC (word, lemma, tag,...)
    attrs = 'word'

    # positional attributes to be displayed for non-KWIC tokens (word, lemma, tag)
    ctxattrs = 'word'

    # references (text type information derived from structural attributes) to be displayed
    refs = '#'

    # structures to be displayed
    structs = 'p'

    # number of lines per page
    pagesize = 40

    # ???
    labelmap = {}

    # whether the text flows from right to left
    righttoleft = False

    # ???
    alignlist = []

    # whether display ===EMPTY=== or '' in case a value is empty
    hidenone = 0

    # a list of attributes to be shown on mouse-over (currently for KWIC only)
    token_mouseover = ()

    def __init__(self, argmapping):
        for k, v in argmapping.__dict__.items():
            if hasattr(self, k):
                setattr(self, k, self._import_val(k, v))

    def _import_val(self, k, v):
        t = type(getattr(self, k))
        if t is int:
            return int(v)
        elif t is float:
            return float(v)
        else:
            return v

    def to_dict(self):
        return self.__dict__

    def calc_fromline(self):
        return (self.fromp - 1) * self.pagesize + self.line_offset

    def calc_toline(self):
        return self.fromp * self.pagesize + self.line_offset

    def create_kwicline_args(self, **kw):
        ans = KwicLinesArgs()
        ans.speech_segment = self.speech_attr
        ans.fromline = self.calc_fromline()
        ans.toline = self.calc_toline()
        ans.leftctx = self.leftctx
        ans.rightctx = self.rightctx
        ans.attrs = self.attrs
        ans.ctxattrs = self.ctxattrs
        ans.refs = self.refs
        ans.structs = self.structs
        ans.labelmap = self.labelmap
        ans.righttoleft = self.righttoleft
        ans.alignlist = self.alignlist
        ans.token_mouseover = self.token_mouseover
        for k, v in kw.items():
            setattr(ans, k, v)
        return ans


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

    def kwicpage(self, args):
        """
        Generates template data for page displaying provided concordance

        arguments:
            args -- a KwicArgs instance

        returns:
        KwicPageData converted into a dict
        """
        args.refs = getattr(args, 'refs', '').replace('.MAP_OUP', '')  # to be removed ...
        try:
            fromp = int(args.fromp)
            if fromp < 1:
                fromp = 1
        except:
            fromp = 1

        out = KwicPageData()
        pagination = Pagination()
        out.Lines = self.kwiclines(args.create_kwicline_args())
        self.add_aligns(out, args.create_kwicline_args(speech_segment=None))

        if len(out.CorporaColumns) == 0:
            out.CorporaColumns = [dict(n=self.corpus.corpname, label=self.corpus.get_conf('NAME'))]
            out.KWICCorps = [self.corpus.corpname]

        if args.labelmap:
            out['GroupNumbers'] = format_labelmap(args.labelmap)
        if fromp > 1:
            pagination.prev_page = fromp - 1
            pagination.first_page = 1
        if self.conc.size() > args.pagesize:
            out.fromp = fromp
            out.numofpages = numofpages = (self.conc.size() - 1) / args.pagesize + 1
            if numofpages < 30:
                out.Page = [{'page': x} for x in range(1, numofpages + 1)]
            if fromp < numofpages:
                pagination.next_page = fromp + 1
                pagination.last_page = numofpages
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
        if args.hidenone:
            for line, part in itertools.product(out.Lines, ('Kwic', 'Left', 'Right')):
                for item in line[part]:
                    item['str'] = item['str'].replace('===NONE===', '')
        out.pagination = pagination.export()
        return dict(out)

    def add_aligns(self, result, args):
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

        if not args.alignlist:
            return
        al_lines = []
        corps_with_colls = manatee.StrVector()
        self.conc.get_aligned(corps_with_colls)
        result.KWICCorps = [c for c in corps_with_colls]
        if self.corpus.corpname not in result.KWICCorps:
            result.KWICCorps = [self.corpus.corpname] + result.KWICCorps
        result.CorporaColumns = [dict(n=c.get_conffile(), label=c.get_conf('NAME') or c.get_conffile())
                                 for c in [self.conc.orig_corp] + args.alignlist]
        for al_corp in args.alignlist:
            al_corpname = al_corp.get_conffile()
            if al_corpname in corps_with_colls:
                self.conc.switch_aligned(al_corp.get_conffile())
                al_lines.append(self.kwiclines(args))
            else:
                self.conc.switch_aligned(self.conc.orig_corp.get_conffile())
                self.conc.add_aligned(al_corp.get_conffile())
                self.conc.switch_aligned(al_corp.get_conffile())
                al_lines.append(
                    self.kwiclines(args.copy(leftctx='0', rightctx='0', attrs='word', ctxattrs=''))
                )

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

    def update_speech_boundaries(self, speech_segment, line, column, filter_speech_tag, prev_speech_id=None):
        """
        arguments:
        speech_attr -- 2-tuple (struct_name, attr_name)
        line -- list of dicts {'str': '...', 'class': '...'}
        column -- str, one of {'left', 'kwic', 'right'}; specifies position according to KWIC
        filter_speech_tag -- if True then whole speech tag is removed else only its 'speech attribute'
        prev_speech_id -- str identifier of the previously processed speech segment

        | left                 | kwic                     | right     |
        ---------------------------------------------------------------
        |  <sp>....</sp> <sp>..|..</sp> <sp>..</sp> <sp>..|..</sp>    |

        Returns:
        2-tuple: modified line and the last speech id (which is necessary to obtain proper speech ID in case of partial
        segment on the "left" part of a concordance line and similarly in case of a partial segment on the "right"
        part of a concordance line).

        """
        newline = []
        speech_struct_str = speech_segment[0] if speech_segment and len(speech_segment) > 0 else None
        fragment_separator = '<%s' % speech_struct_str
        last_fragment = None
        last_speech_id = prev_speech_id

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
                    newline_item['open_link'] = {'speech_path': speech_id}
                elif frag_ext.endswith('</%s>' % speech_struct_str):
                    newline_item['close_link'] = {'speech_path': speech_id}
                newline.append(newline_item)
                last_fragment = newline_item
        # we have to treat specific situations related to the end of the
        # concordance line
        if (last_fragment is not None and
                re.search('^<%s(>|[^>]+>)$' % speech_struct_str, last_fragment['str']) and
                column == 'right'):
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

    def kwiclines(self, args):
        """
        Generates list of 'kwic' (= keyword in context) lines according to
        the provided Concordance object and additional parameters (like
        page number, width of the left and right context etc.).

        arguments:
        args -- a KwicLinesArgs instance

        returns:
        a dictionary containing all the required line data (left context, kwic, right context,...)
        """

        # add structures needed to render speech playback information
        all_structs = args.structs
        if args.speech_segment:
            speech_struct_attr_name = '.'.join(args.speech_segment)
            speech_struct_attr = self.corpus.get_attr(speech_struct_attr_name)
            if speech_struct_attr_name not in args.structs:
                all_structs += ',' + speech_struct_attr_name
        else:
            speech_struct_attr_name = None
            speech_struct_attr = None

        lines = []

        if args.righttoleft:
            rightlabel, leftlabel = 'Left', 'Right'
            args.structs += ',ltr'
            # from unicodedata import bidirectional
        else:
            leftlabel, rightlabel = 'Left', 'Right'

        # generate attrs & ctxattrs containing both user and internal (= the ones
        # needed to enhance misc. UI elements) structures
        attrs_tmp = args.create_attrs_merge()
        ctxattrs_tmp = args.create_attrs_merge()

        # self.conc.corp() must be used here instead of self.corpus
        # because in case of parallel corpora these two are different and only the latter one is correct
        kl = manatee.KWICLines(self.conc.corp(), self.conc.RS(True, args.fromline, args.toline),
                               args.leftctx, args.rightctx,
                               attrs_tmp.export_all(), ctxattrs_tmp.export_all(), all_structs, args.refs)
        labelmap = args.labelmap.copy()
        labelmap['_'] = '_'
        maxleftsize = 0
        maxrightsize = 0
        filter_out_speech_tag = args.speech_segment and args.speech_segment[0] not in args.structs \
            and speech_struct_attr_name in all_structs

        i = args.fromline
        while kl.nextline():
            linegroup = str(kl.get_linegroup() or '_')
            linegroup = labelmap.get(linegroup, '#' + linegroup)
            if args.speech_segment:
                leftmost_speech_id = speech_struct_attr.pos2str(kl.get_ctxbeg())
            else:
                leftmost_speech_id = None
            leftwords, last_left_speech_id = self.update_speech_boundaries(args.speech_segment,
                                                                           tokens2strclass(kl.get_left()),
                                                                         'left', filter_out_speech_tag,
                                                                           leftmost_speech_id)
            kwicwords, last_left_speech_id = self.update_speech_boundaries(args.speech_segment,
                                                                           tokens2strclass(kl.get_kwic()),
                                                                         'kwic',
                                                                           filter_out_speech_tag,
                                                                           last_left_speech_id)
            rightwords = self.update_speech_boundaries(args.speech_segment, tokens2strclass(kl.get_right()), 'right',
                                                       filter_out_speech_tag, last_left_speech_id)[0]

            if args.righttoleft and Kwic.isengword(kwicwords[0]):
                leftwords, rightwords = Kwic.update_right_to_left(leftwords, rightwords)

            prev = {}
            for kw in kwicwords:
                kwicwords_upd = []
                if kw.get('class') == 'attr':
                    kw['str'], prev['mouseover'] = attrs_tmp.process_output(kw.get('str', ''))
                else:
                    kwicwords_upd.append(kw)
                prev = kw

            prev = {}
            leftsize = 0
            for w in leftwords:
                if w['class'] == 'attr':
                    w['str'], prev['mouseover'] = ctxattrs_tmp.process_output(w.get('str', ''))
                if not w['class'] == 'strc':
                    leftsize += len(w['str']) + 1
                prev = w
            if leftsize > maxleftsize:
                maxleftsize = leftsize

            prev = {}
            rightsize = 0
            for w in rightwords:
                if w['class'] == 'attr':
                    w['str'], prev['mouseover'] = ctxattrs_tmp.process_output(w.get('str', ''))
                if not w['class'] == 'strc':
                    rightsize += len(w['str']) + 1
                prev = w
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

    def get_sort_idx(self, q=(), pagesize=20):
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

