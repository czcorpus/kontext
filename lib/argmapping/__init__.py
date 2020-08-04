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

from typing import Union, List, Optional
from enum import Enum
import attr


class Persistence(Enum):
    # not stored at all
    NON_PERSISTENT = 0b0000

    # stored in user's settings (and not elsewhere)
    PERSISTENT = 0b0001

    # stored in user's session (and not elsewhere), used to optionally set suitable initial values
    # (action method must have 'apply_semi_persist_args' annotation set to True)
    SEMI_PERSISTENT = 0b0010


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
    'refs',
    'hitlen'
)

def update_attr(obj: object, k: str, v: Union[str, int, float]) -> None:
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
            if attr.fields_dict(Args)[k].type in [list, tuple]:
                setattr(obj, k, [])
            else:
                setattr(obj, k, None)
        else:
            if attr.fields_dict(Args)[k].type in [list, tuple]:
                setattr(obj, k, getattr(obj, k, []) + [v])
            else:
                setattr(obj, k, v)

def attr_builder(value, persistent:Persistence=Persistence.NON_PERSISTENT):
    return attr.ib(default=value, metadata={'persistent': persistent})


@attr.s(kw_only=True, auto_attribs=True)
class Args(object):
    """
    This class serves as a template for argument handling and
    is not intended to be instantiated.
    """
    # specifies response output format (used in case default one is not applicable)
    format:str = attr_builder('')

    fc_lemword_window_type:str = attr_builder('both')
    fc_lemword_type:str = attr_builder('all')
    fc_lemword_wsize:int = attr_builder(5)
    fc_lemword:str = attr_builder('')
    fc_pos_window_type:str = attr_builder('both')
    fc_pos_type:str = attr_builder('all')
    fc_pos_wsize:int = attr_builder(5)
    fc_pos:List = attr_builder([])
    ml:int = attr_builder(0)
    concarf:str = attr_builder('')
    concsize:str = attr_builder('')
    Lines:List = attr_builder([])
    fromp:int = attr_builder(1)
    numofpages:int = attr_builder(0)
    pnfilter:str = attr_builder('p')
    filfl:str = attr_builder('f')
    filfpos:str = attr_builder('-5', persistent=Persistence.SEMI_PERSISTENT)
    filtpos = attr_builder('5', persistent=Persistence.SEMI_PERSISTENT)

    # concordance sorting
    sattr:str = attr_builder('')
    sicase:str = attr_builder('')
    sbward:str = attr_builder('')
    spos:int = attr_builder(5)
    skey:str = attr_builder('rc')
    sortlevel:int = attr_builder(1)
    ml1attr:str = attr_builder('')
    ml2attr:str = attr_builder('')
    ml3attr:str = attr_builder('')
    ml4attr:str = attr_builder('')
    ml1icase:str = attr_builder('')
    ml2icase:str = attr_builder('')
    ml3icase:str = attr_builder('')
    ml4icase:str = attr_builder('')
    ml1bward:str = attr_builder('')
    ml2bward:str = attr_builder('')
    ml3bward:str = attr_builder('')
    ml4bward:str = attr_builder('')
    ml1pos:int = attr_builder(1)
    ml2pos:int = attr_builder(1)
    ml3pos:int = attr_builder(1)
    ml4pos:int = attr_builder(1)
    ml1ctx:str = attr_builder('0~0>0')
    ml2ctx:str = attr_builder('0~0>0')
    ml3ctx:str = attr_builder('0~0>0')
    ml4ctx:str = attr_builder('0~0>0')

    freq_sort:str = attr_builder('')
    heading:int = attr_builder(0)
    saveformat:str = attr_builder('text')
    wlattr:str = attr_builder('')
    wlpat:str = attr_builder('')
    wlpage:int = attr_builder(1)
    wlcache:str = attr_builder('')
    blcache:str = attr_builder('')
    simple_n:int = attr_builder(1)
    usearf:int = attr_builder(0)
    collpage:int = attr_builder(1)
    fpage:int = attr_builder(1)
    fmaxitems:int = attr_builder(50)
    ftt_include_empty:str = attr_builder('')
    subcsize:int = attr_builder(0)
    ref_usesubcorp:str = attr_builder('')
    wlsort:str = attr_builder('')
    keywords:str = attr_builder('')
    Keywords:List[str] = attr_builder([])
    Items:List[str] = attr_builder([])  # TODO check and remove
    selected:str = attr_builder('')
    pages:int = attr_builder(0)
    leftctx:str = attr_builder('')
    rightctx:str = attr_builder('')
    numbering:int = attr_builder(0)
    align_kwic:int = attr_builder(0)
    stored:str = attr_builder('')
    line_numbers:int = attr_builder(0, persistent=Persistence.PERSISTENT)
    # end

    # must be an empty string and not None
    corpname:str = attr_builder('', persistent=Persistence.SEMI_PERSISTENT)
    usesubcorp:str = attr_builder('')
    subcname:str = attr_builder('')
    subcpath:List[str] = attr_builder([])
    iquery:str = attr_builder('')
    queryselector:str = attr_builder('', persistent=Persistence.SEMI_PERSISTENT)
    lemma:str = attr_builder('')
    lpos:str = attr_builder('')
    phrase:str = attr_builder('')
    char:str = attr_builder('')
    word:str = attr_builder('')
    wpos:str = attr_builder('')
    cql:str = attr_builder('')
    tag:str = attr_builder('')
    default_attr:Optional[str] = attr_builder(None)
    save:int = attr_builder(1)
    asnc:int = attr_builder(1)
    qmcase:int = attr_builder(0)
    include_empty:int = attr_builder(0)
    rlines:str = attr_builder('250')
    attrs:str = attr_builder('word', persistent=Persistence.PERSISTENT)
    ctxattrs:str = attr_builder('word', persistent=Persistence.PERSISTENT)
    attr_allpos:str = attr_builder('kw')
    base_viewattr:str = attr_builder('word', persistent=Persistence.PERSISTENT)
    attr_vmode:str = attr_builder('mouseover', persistent=Persistence.PERSISTENT)
    allpos:str = attr_builder('kw')
    structs:str = attr_builder('', persistent=Persistence.PERSISTENT)
    q:List[str] = attr_builder([])
    pagesize:int = attr_builder(40, persistent=Persistence.PERSISTENT)
    wlpagesize:int = attr_builder(25, persistent=Persistence.PERSISTENT)
    citemsperpage:int = attr_builder(50, persistent=Persistence.PERSISTENT)
    multiple_copy:int = attr_builder(0, persistent=Persistence.PERSISTENT)  # TODO do we need this?
    wlsendmail:str = attr_builder('')
    cup_hl:str = attr_builder('q', persistent=Persistence.PERSISTENT)
    structattrs:List[str] = attr_builder([], persistent=Persistence.PERSISTENT)
    cql_editor:int = attr_builder(1, persistent=Persistence.PERSISTENT)

    flimit:int = attr_builder(1)
    freqlevel:int = attr_builder(1)
    hidenone:int = attr_builder(1)
    fttattr:List[str] = attr_builder([])

    kwicleftctx:str = attr_builder('-10', persistent=Persistence.PERSISTENT)
    kwicrightctx:str = attr_builder('10', persistent=Persistence.PERSISTENT)
    senleftctx_tpl:str = attr_builder('-1:%s')
    senrightctx_tpl:str = attr_builder('1:%s')
    viewmode:str = attr_builder('kwic')
    align:List[str] = attr_builder([], persistent=Persistence.SEMI_PERSISTENT)
    maincorp:str = attr_builder('')  # used only in case of parallel corpora - specifies primary corp.
    # None means "not initialized" while '' means "user wants no refs"
    refs:Optional[str] = attr_builder(None)
    hitlen:int = attr_builder(1)

    shuffle:int = attr_builder(0, persistent=Persistence.PERSISTENT)

    subcnorm:str = attr_builder('tokens')

    # Collocations

    cattr:str = attr_builder('word')
    csortfn:str = attr_builder('d')
    cbgrfns:List[str] = attr_builder(['m', 't', 'd'])
    cfromw:int = attr_builder(-5)
    ctow:int = attr_builder(5)
    cminfreq:int = attr_builder(3)
    cminbgr:int = attr_builder(3)

    # Contingency table

    ctminfreq:int = attr_builder(80)   # 80th percentile (see ctminfreq_type)
    ctminfreq_type:str = attr_builder('pabs')  # percentile as a default filter mode
    ctattr1:str = attr_builder('word')
    ctattr2:str = attr_builder('word')
    ctfcrit1:str = attr_builder('0<0')
    ctfcrit2:str = attr_builder('0<0')

    # word list

    wlminfreq:int = attr_builder(5)
    wlicase:int = attr_builder(0)
    wlwords:str = attr_builder('')
    blacklist:str = attr_builder('')

    include_nonwords:int = attr_builder(0)
    wltype:str = attr_builder('simple')
    wlnums:str = attr_builder('frq')

    wlposattr1:str = attr_builder('')
    wlposattr2:str = attr_builder('')
    wlposattr3:str = attr_builder('')

    maxsavelines:int = attr_builder(1000)
    fcrit:List[str] = attr_builder([])

    sort_linegroups:int = attr_builder(0)
