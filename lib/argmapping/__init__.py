# Copyright (c) 2015 Institute of the Czech National Corpus
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

import inspect

from werkzeug.datastructures import MultiDict


class Parameter(object):
    """
    Defines an argument of an argument-mapping template (see below).
    """

    # not stored at all
    NON_PERSISTENT = 0b0000

    # stored in user's settings (and not elsewhere)
    PERSISTENT = 0b0001

    # stored in user's session (and not elsewhere), used to optionally set suitable initial values
    # (action method must have 'apply_semi_persist_args' annotation set to True)
    SEMI_PERSISTENT = 0b0010

    def __init__(self, value, persistent=NON_PERSISTENT):
        """
        arguments:
        value -- wrapped value (default value and type of the value;
                 accepts primitive types, empty dict, empty list, tuple)
        persistent -- an integer value composed of binary flags defining the persistence level of the property
        """
        self.value = value
        self.persistent = persistent

    def unwrap(self):
        if type(self.value) is list:
            ans = self.value[:]
        elif self.value == {}:
            ans = {}
        elif type(self.value) is dict:
            raise TypeError(
                'Cannot define static property as a non-empty dictionary: %s' % (self.value, ))
        else:
            ans = self.value
        return ans

    def update_attr(self, obj, k, v):
        """
        Update obj's 'k' attribute using scalar value
        'v'. This means different things based
        on whether obj.[k] is array or not.

        Rules:
        1. empty string and None reset current obj.[k]
        2. non empty value is appended to array type and
           replaces current value of scalar type

        arguments:
        obj -- argument mapping object
        k -- a string key
        v -- a simple type value (string, int, float)
        """
        if v == '' or v is None:
            if self.is_array():
                setattr(obj, k, [])
            else:
                setattr(obj, k, None)
        else:
            if self.is_array():
                setattr(obj, k, getattr(obj, k, []) + [v])
            else:
                setattr(obj, k, v)

    def is_array(self):
        return type(self.value) is tuple or type(self.value) is list

    def meets_persistence(self, p_level):
        return self.persistent & p_level == p_level


# This attribute set covers all the arguments representing a concordance.
# I.e. the application should be able to restore any concordance just by
# using these parameters. Please note that this list does not include
# the 'q' parameter which collects currently built query and is handled
# individually.
ConcArgsMapping = (
    'corpname',
    'usesubcorp',
    'maincorp',
    'viewmode',
    'pagesize',
    'align',
    'attrs',
    'attr_vmode',
    'attr_allpos',
    'ctxattrs',
    'structs',
    'refs'
)


# Arguments needed to open a correct detailed KWIC context
WidectxArgsMapping = (
    'attrs',
    'attr_allpos',
    'ctxattrs',
    'structs',
    'refs'
)


class GlobalArgs(object):
    """
    This class serves as a template for argument handling and
    is not intended to be instantiated.
    """
    # specifies response output format (used in case default one is not applicable)
    format = Parameter(u'')

    fc_lemword_window_type = Parameter(u'both')
    fc_lemword_type = Parameter(u'all')
    fc_lemword_wsize = Parameter(5)
    fc_lemword = Parameter(u'')
    fc_pos_window_type = Parameter(u'both')
    fc_pos_type = Parameter(u'all')
    fc_pos_wsize = Parameter(5)
    fc_pos = Parameter([])
    ml = Parameter(0)
    concarf = Parameter(u'')
    concsize = Parameter(u'')
    Lines = Parameter([])
    fromp = Parameter(1)
    numofpages = Parameter(0)
    pnfilter = Parameter(u'p')
    filfl = Parameter(u'f')
    filfpos = Parameter(u'-5', persistent=Parameter.SEMI_PERSISTENT)
    filtpos = Parameter(u'5', persistent=Parameter.SEMI_PERSISTENT)

    # concordance sorting
    sattr = Parameter(u'')
    sicase = Parameter(u'')
    sbward = Parameter(u'')
    spos = Parameter(3)
    skey = Parameter(u'rc')
    sortlevel = Parameter(1)
    ml1attr = Parameter(u'')
    ml2attr = Parameter(u'')
    ml3attr = Parameter(u'')
    ml4attr = Parameter(u'')
    ml1icase = Parameter(u'')
    ml2icase = Parameter(u'')
    ml3icase = Parameter(u'')
    ml4icase = Parameter(u'')
    ml1bward = Parameter(u'')
    ml2bward = Parameter(u'')
    ml3bward = Parameter(u'')
    ml4bward = Parameter(u'')
    ml1pos = Parameter(1)
    ml2pos = Parameter(1)
    ml3pos = Parameter(1)
    ml4pos = Parameter(1)
    ml1ctx = Parameter(u'0~0>0')
    ml2ctx = Parameter(u'0~0>0')
    ml3ctx = Parameter(u'0~0>0')
    ml4ctx = Parameter(u'0~0>0')

    freq_sort = Parameter(u'')
    heading = Parameter(0)
    saveformat = Parameter(u'text')
    wlattr = Parameter(u'')
    wlpat = Parameter(u'')
    wlpage = Parameter(1)
    wlcache = Parameter(u'')
    blcache = Parameter(u'')
    simple_n = Parameter(1)
    usearf = Parameter(0)
    collpage = Parameter(1)
    fpage = Parameter(1)
    fmaxitems = Parameter(50)
    ftt_include_empty = Parameter(u'')
    subcsize = Parameter(0)
    ref_usesubcorp = Parameter(u'')
    wlsort = Parameter(u'')
    keywords = Parameter(u'')
    Keywords = Parameter([])
    Items = Parameter([])  # TODO check and remove
    selected = Parameter(u'')
    pages = Parameter(0)
    leftctx = Parameter(u'')
    rightctx = Parameter(u'')
    numbering = Parameter(0)
    align_kwic = Parameter(0)
    stored = Parameter(u'')
    line_numbers = Parameter(0, persistent=Parameter.PERSISTENT)
    # end

    # must be an empty string and not None
    corpname = Parameter('', persistent=Parameter.SEMI_PERSISTENT)
    usesubcorp = Parameter(u'')
    subcname = Parameter(u'')
    subcpath = Parameter([])
    iquery = Parameter(u'')
    queryselector = Parameter(u'', persistent=Parameter.SEMI_PERSISTENT)
    lemma = Parameter(u'')
    lpos = Parameter(u'')
    phrase = Parameter(u'')
    char = Parameter(u'')
    word = Parameter(u'')
    wpos = Parameter(u'')
    cql = Parameter(u'')
    tag = Parameter('')
    default_attr = Parameter(None)
    save = Parameter(1)
    async = Parameter(1)
    qmcase = Parameter(0)
    include_empty = Parameter(0)
    rlines = Parameter(u'250')
    attrs = Parameter(u'word', persistent=Parameter.PERSISTENT)
    ctxattrs = Parameter(u'word', persistent=Parameter.PERSISTENT)
    attr_allpos = Parameter(u'kw')
    attr_vmode = Parameter(u'mouseover', persistent=Parameter.PERSISTENT)
    allpos = Parameter(u'kw')
    structs = Parameter(u'', persistent=Parameter.PERSISTENT)
    q = Parameter([])
    pagesize = Parameter(40, persistent=Parameter.PERSISTENT)
    wlpagesize = Parameter(25, persistent=Parameter.PERSISTENT)
    citemsperpage = Parameter(50, persistent=Parameter.PERSISTENT)
    multiple_copy = Parameter(0, persistent=Parameter.PERSISTENT)  # TODO do we need this?
    wlsendmail = Parameter(u'')
    cup_hl = Parameter(u'q', persistent=Parameter.PERSISTENT)
    structattrs = Parameter([], persistent=Parameter.PERSISTENT)
    cql_editor = Parameter(1, persistent=Parameter.PERSISTENT)

    flimit = Parameter(1)
    freqlevel = Parameter(1)
    hidenone = Parameter(1)
    fttattr = Parameter([])

    kwicleftctx = Parameter('-10', persistent=Parameter.PERSISTENT)
    kwicrightctx = Parameter('10', persistent=Parameter.PERSISTENT)
    senleftctx_tpl = Parameter('-1:%s')
    senrightctx_tpl = Parameter('1:%s')
    viewmode = Parameter('kwic')
    align = Parameter([], persistent=Parameter.SEMI_PERSISTENT)
    maincorp = Parameter('')  # used only in case of parallel corpora - specifies primary corp.
    refs = Parameter(None)  # None means "not initialized" while '' means "user wants no refs"

    shuffle = Parameter(0, persistent=Parameter.PERSISTENT)

    subcnorm = Parameter('tokens')

    # Collocations

    cattr = Parameter('word')
    csortfn = Parameter('d')
    cbgrfns = Parameter(['m', 't', 'd'])
    cfromw = Parameter(-5)
    ctow = Parameter(5)
    cminfreq = Parameter(3)
    cminbgr = Parameter(3)

    # Contingency table

    ctminfreq = Parameter(80)   # 80th percentile (see ctminfreq_type)
    ctminfreq_type = Parameter('pabs')  # percentile as a default filter mode
    ctattr1 = Parameter('word')
    ctattr2 = Parameter('word')
    ctfcrit1 = Parameter('0<0')
    ctfcrit2 = Parameter('0<0')

    # word list

    wlminfreq = Parameter(5)
    wlicase = Parameter(0)
    wlwords = Parameter('')
    blacklist = Parameter('')

    include_nonwords = Parameter(0)
    wltype = Parameter('simple')
    wlnums = Parameter('frq')

    wlposattr1 = Parameter('')
    wlposattr2 = Parameter('')
    wlposattr3 = Parameter('')

    maxsavelines = Parameter(1000)
    fcrit = Parameter([])

    sort_linegroups = Parameter(0)


class Args(object):
    """
    URL/form parameters are mapped here
    """
    pass
