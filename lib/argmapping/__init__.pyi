# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import TypeVar, Generic, List, Tuple
T = TypeVar('T')

class Parameter(Generic[T]):
    pass


ConcArgsMapping:Tuple[str,...]

WidectxArgsMapping:Tuple[str,...]


class GlobalArgs(object):
    format:str

    fc_lemword_window_type:str
    fc_lemword_type:str
    fc_lemword_wsize:int
    fc_lemword:str
    fc_pos_window_type:str
    fc_pos_type:str
    fc_pos_wsize:int
    fc_pos:List[str]
    ml:int
    concarf:str
    concsize:str
    Lines:List[str]
    fromp:int
    numofpages:int
    pnfilter:str
    filfl:str
    filfpos:str
    filtpos:str

    # concordance sorting
    sattr:str
    sicase:str
    sbward:str
    spos:int
    skey:str
    sortlevel:int
    ml1attr:str
    ml2attr:str
    ml3attr:str
    ml4attr:str
    ml1icase:str
    ml2icase:str
    ml3icase:str
    ml4icase:str
    ml1bward:str
    ml2bward:str
    ml3bward:str
    ml4bward:str
    ml1pos:int
    ml2pos:int
    ml3pos:int
    ml4pos:int
    ml1ctx:str
    ml2ctx:str
    ml3ctx:str
    ml4ctx:str

    freq_sort:str
    heading:int
    saveformat:str
    wlattr:str
    wlpat:str
    wlpage:int
    wlcache:str
    blcache:str
    simple_n:int
    usearf:int
    collpage:int
    fpage:int
    fmaxitems:int
    ftt_include_empty:str
    subcsize:int
    ref_usesubcorp:str
    wlsort:str
    keywords:str
    Keywords:List[str]
    Items:List[str]
    selected:str
    pages:int
    leftctx:str
    rightctx:str
    numbering:int
    align_kwic:int
    stored:str
    line_numbers:int
    # end

    # must be an empty string and not None
    corpname:str
    usesubcorp:str
    subcname:str
    subcpath:List[str]
    iquery:str
    queryselector:str
    lemma:str
    lpos:str
    phrase:str
    char:str
    word:str
    wpos:str
    cql:str
    tag:str
    default_attr:str
    save:int
    async:int
    qmcase:int
    rlines:str
    attrs:str
    ctxattrs:str
    attr_allpos:str
    attr_vmode:str
    allpos:str
    structs:str
    q:List[str]
    pagesize:int
    wlpagesize:int
    citemsperpage:int
    multiple_copy:int
    wlsendmail:str
    cup_hl:str
    structattrs:List[str]
    cql_editor:int

    flimit:int
    freqlevel:int
    hidenone:int
    fttattr:List[str]

    kwicleftctx:str
    kwicrightctx:str
    senleftctx_tpl:str
    senrightctx_tpl:str
    viewmode:str
    align:List[str]
    maincorp:str
    refs:str

    shuffle:int

    subcnorm:str

    # Collocations

    cattr:str
    csortfn:str
    cbgrfns:List[str]
    cfromw:int
    ctow:int
    cminfreq:int
    cminbgr:int

    # Contingency table

    ctminfreq:int
    ctminfreq_type:str
    ctattr1:str
    ctattr2:str
    ctfcrit1:str
    ctfcrit2:str

    # word list

    wlminfreq:int
    wlicase:int
    wlwords:str
    blacklist:str

    include_nonwords:int
    wltype:str
    wlnums:str

    wlposattr1:str
    wlposattr2:str
    wlposattr3:str

    maxsavelines:int
    fcrit:List[str]

    sort_linegroups:int


class Args(GlobalArgs):
    pass