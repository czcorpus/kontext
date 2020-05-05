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

from typing import TypeVar, Generic, Union, cast, List, Optional

ValueType = TypeVar('ValueType')


class Parameter(Generic[ValueType]):
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

    def __init__(self, value: ValueType, persistent: int = NON_PERSISTENT) -> None:
        """
        arguments:
        value -- wrapped value (default value and type of the value;
                 accepts primitive types, empty dict, empty list, tuple)
        persistent -- an integer value composed of binary flags defining the persistence level of the property
        """
        self.value: ValueType = value
        self.persistent: int = persistent

    def unwrap(self) -> ValueType:
        if isinstance(self.value, list):
            return cast(ValueType, self.value.copy())
        elif self.value == {}:
            return cast(ValueType, {})
        elif isinstance(self.value, dict):
            raise TypeError(f'Cannot define static property as a non-empty dictionary: {self.value}')
        else:
            return self.value

    def update_attr(self, obj: object, k: str, v: Union[str, int, float]) -> None:
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

    def is_array(self) -> bool:
        return isinstance(self.value, (tuple, list))

    def meets_persistence(self, p_level: int) -> bool:
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
    'base_viewattr',  # attribute used in a text flow
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
    format = Parameter('')

    fc_lemword_window_type = Parameter[str]('both')
    fc_lemword_type = Parameter[str]('all')
    fc_lemword_wsize = Parameter[int](5)
    fc_lemword = Parameter[str]('')
    fc_pos_window_type = Parameter[str]('both')
    fc_pos_type = Parameter[str]('all')
    fc_pos_wsize = Parameter[int](5)
    fc_pos = Parameter[List]([])
    ml = Parameter[int](0)
    concarf = Parameter[str]('')
    concsize = Parameter[str]('')
    Lines = Parameter[List]([])
    fromp = Parameter[int](1)
    numofpages = Parameter[int](0)
    pnfilter = Parameter[str]('p')
    filfl = Parameter[str]('f')
    filfpos = Parameter[str]('-5', persistent=Parameter.SEMI_PERSISTENT)
    filtpos = Parameter[str]('5', persistent=Parameter.SEMI_PERSISTENT)

    # concordance sorting
    sattr = Parameter[str]('')
    sicase = Parameter[str]('')
    sbward = Parameter[str]('')
    spos = Parameter[int](3)
    skey = Parameter[str]('rc')
    sortlevel = Parameter[int](1)
    ml1attr = Parameter[str]('')
    ml2attr = Parameter[str]('')
    ml3attr = Parameter[str]('')
    ml4attr = Parameter[str]('')
    ml1icase = Parameter[str]('')
    ml2icase = Parameter[str]('')
    ml3icase = Parameter[str]('')
    ml4icase = Parameter[str]('')
    ml1bward = Parameter[str]('')
    ml2bward = Parameter[str]('')
    ml3bward = Parameter[str]('')
    ml4bward = Parameter[str]('')
    ml1pos = Parameter[int](1)
    ml2pos = Parameter[int](1)
    ml3pos = Parameter[int](1)
    ml4pos = Parameter[int](1)
    ml1ctx = Parameter[str]('0~0>0')
    ml2ctx = Parameter[str]('0~0>0')
    ml3ctx = Parameter[str]('0~0>0')
    ml4ctx = Parameter[str]('0~0>0')

    freq_sort = Parameter[str]('')
    heading = Parameter[int](0)
    saveformat = Parameter[str]('text')
    wlattr = Parameter[str]('')
    wlpat = Parameter[str]('')
    wlpage = Parameter[int](1)
    wlcache = Parameter[str]('')
    blcache = Parameter[str]('')
    simple_n = Parameter[int](1)
    usearf = Parameter[int](0)
    collpage = Parameter[int](1)
    fpage = Parameter[int](1)
    fmaxitems = Parameter[int](50)
    ftt_include_empty = Parameter[str]('')
    subcsize = Parameter[int](0)
    ref_usesubcorp = Parameter[str]('')
    wlsort = Parameter[str]('')
    keywords = Parameter[str]('')
    Keywords = Parameter[List[str]]([])
    Items = Parameter[List[str]]([])  # TODO check and remove
    selected = Parameter[str]('')
    pages = Parameter[int](0)
    leftctx = Parameter[str]('')
    rightctx = Parameter[str]('')
    numbering = Parameter[int](0)
    align_kwic = Parameter[int](0)
    stored = Parameter[str]('')
    line_numbers = Parameter[int](0, persistent=Parameter.PERSISTENT)
    # end

    # must be an empty string and not None
    corpname = Parameter[str]('', persistent=Parameter.SEMI_PERSISTENT)
    usesubcorp = Parameter[str]('')
    subcname = Parameter[str]('')
    subcpath = Parameter[List[str]]([])
    iquery = Parameter[str]('')
    queryselector = Parameter[str]('', persistent=Parameter.SEMI_PERSISTENT)
    lemma = Parameter[str]('')
    lpos = Parameter[str]('')
    phrase = Parameter[str]('')
    char = Parameter[str]('')
    word = Parameter[str]('')
    wpos = Parameter[str]('')
    cql = Parameter[str]('')
    tag = Parameter[str]('')
    default_attr = Parameter[Optional[str]](None)
    save = Parameter[int](1)
    async = Parameter[int](1)
    qmcase = Parameter[int](0)
    include_empty = Parameter[int](0)
    rlines = Parameter[str]('250')
    attrs = Parameter[str]('word', persistent=Parameter.PERSISTENT)
    ctxattrs = Parameter[str]('word', persistent=Parameter.PERSISTENT)
    attr_allpos = Parameter[str]('kw')
    base_viewattr = Parameter[str]('word', persistent=Parameter.PERSISTENT)
    attr_vmode = Parameter[str]('mouseover', persistent=Parameter.PERSISTENT)
    allpos = Parameter[str]('kw')
    structs = Parameter[str]('', persistent=Parameter.PERSISTENT)
    q = Parameter[List[str]]([])
    pagesize = Parameter[int](40, persistent=Parameter.PERSISTENT)
    wlpagesize = Parameter[int](25, persistent=Parameter.PERSISTENT)
    citemsperpage = Parameter[int](50, persistent=Parameter.PERSISTENT)
    multiple_copy = Parameter[int](0, persistent=Parameter.PERSISTENT)  # TODO do we need this?
    wlsendmail = Parameter[str]('')
    cup_hl = Parameter[str]('q', persistent=Parameter.PERSISTENT)
    structattrs = Parameter[List[str]]([], persistent=Parameter.PERSISTENT)
    cql_editor = Parameter[int](1, persistent=Parameter.PERSISTENT)

    flimit = Parameter[int](1)
    freqlevel = Parameter[int](1)
    hidenone = Parameter[int](1)
    fttattr = Parameter[List[str]]([])

    kwicleftctx = Parameter[str]('-10', persistent=Parameter.PERSISTENT)
    kwicrightctx = Parameter[str]('10', persistent=Parameter.PERSISTENT)
    senleftctx_tpl = Parameter[str]('-1:%s')
    senrightctx_tpl = Parameter[str]('1:%s')
    viewmode = Parameter[str]('kwic')
    align = Parameter[List[str]]([], persistent=Parameter.SEMI_PERSISTENT)
    maincorp = Parameter[str]('')  # used only in case of parallel corpora - specifies primary corp.
    refs = Parameter[Optional[str]](None)  # None means "not initialized" while '' means "user wants no refs"

    shuffle = Parameter[int](0, persistent=Parameter.PERSISTENT)

    subcnorm = Parameter[str]('tokens')

    # Collocations

    cattr = Parameter[str]('word')
    csortfn = Parameter[str]('d')
    cbgrfns = Parameter[List[str]](['m', 't', 'd'])
    cfromw = Parameter[int](-5)
    ctow = Parameter[int](5)
    cminfreq = Parameter[int](3)
    cminbgr = Parameter[int](3)

    # Contingency table

    ctminfreq = Parameter[int](80)   # 80th percentile (see ctminfreq_type)
    ctminfreq_type = Parameter[str]('pabs')  # percentile as a default filter mode
    ctattr1 = Parameter[str]('word')
    ctattr2 = Parameter[str]('word')
    ctfcrit1 = Parameter[str]('0<0')
    ctfcrit2 = Parameter[str]('0<0')

    # word list

    wlminfreq = Parameter[int](5)
    wlicase = Parameter[int](0)
    wlwords = Parameter[str]('')
    blacklist = Parameter[str]('')

    include_nonwords = Parameter[int](0)
    wltype = Parameter[str]('simple')
    wlnums = Parameter[str]('frq')

    wlposattr1 = Parameter[str]('')
    wlposattr2 = Parameter[str]('')
    wlposattr3 = Parameter[str]('')

    maxsavelines = Parameter[int](1000)
    fcrit = Parameter[List[str]]([])

    sort_linegroups = Parameter[int](0)


class Args(object):
    """
    URL/form parameters are mapped here
    """
    pass
