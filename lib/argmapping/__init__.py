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

from typing import Union, List, Optional, Dict, Any
from enum import Enum
import attr

from controller.req_args import RequestArgsProxy


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


def def_attr(value, persistent: Persistence = Persistence.NON_PERSISTENT):
    return attr.ib(default=value, metadata={'persistent': persistent})


@attr.s(kw_only=True, auto_attribs=True)
class Args(object):
    """
    This class serves as a template for argument handling and
    is not intended to be instantiated.
    """
    # specifies response output format (used in case default one is not applicable)
    format: str = def_attr('')

    fc_lemword_window_type: str = def_attr('both')
    fc_lemword_type: str = def_attr('all')
    fc_lemword_wsize: int = def_attr(5)
    fc_lemword: str = def_attr('')
    fc_pos_window_type: str = def_attr('both')
    fc_pos_type: str = def_attr('all')
    fc_pos_wsize: int = def_attr(5)
    fc_pos: List = def_attr([])
    ml: int = def_attr(0)
    concarf: str = def_attr('')
    concsize: str = def_attr('')
    Lines: List = def_attr([])
    fromp: int = def_attr(1)
    numofpages: int = def_attr(0)
    pnfilter: str = def_attr('p')
    filfl: str = def_attr('f')
    filfpos: str = def_attr('-5', persistent=Persistence.SEMI_PERSISTENT)
    filtpos: str = def_attr('5', persistent=Persistence.SEMI_PERSISTENT)

    # concordance sorting
    sattr: str = def_attr('')
    sicase: str = def_attr('')
    sbward: str = def_attr('')
    spos: int = def_attr(5)
    skey: str = def_attr('rc')
    sortlevel: int = def_attr(1)
    ml1attr: str = def_attr('')
    ml2attr: str = def_attr('')
    ml3attr: str = def_attr('')
    ml4attr: str = def_attr('')
    ml1icase: str = def_attr('')
    ml2icase: str = def_attr('')
    ml3icase: str = def_attr('')
    ml4icase: str = def_attr('')
    ml1bward: str = def_attr('')
    ml2bward: str = def_attr('')
    ml3bward: str = def_attr('')
    ml4bward: str = def_attr('')
    ml1pos: int = def_attr(1)
    ml2pos: int = def_attr(1)
    ml3pos: int = def_attr(1)
    ml4pos: int = def_attr(1)
    ml1ctx: str = def_attr('0~0>0')
    ml2ctx: str = def_attr('0~0>0')
    ml3ctx: str = def_attr('0~0>0')
    ml4ctx: str = def_attr('0~0>0')

    freq_sort: str = def_attr('')
    heading: int = def_attr(0)
    saveformat: str = def_attr('text')
    wlattr: str = def_attr('')
    wlpat: str = def_attr('')
    wlpage: int = def_attr(1)
    wlcache: str = def_attr('')
    blcache: str = def_attr('')
    simple_n: int = def_attr(1)
    usearf: int = def_attr(0)
    collpage: int = def_attr(1)
    fpage: int = def_attr(1)
    fmaxitems: int = def_attr(50)
    ftt_include_empty: str = def_attr('')
    subcsize: int = def_attr(0)
    ref_usesubcorp: str = def_attr('')
    wlsort: str = def_attr('')
    keywords: str = def_attr('')
    Keywords: List[str] = def_attr([])
    Items: List[str] = def_attr([])  # TODO check and remove
    selected: str = def_attr('')
    pages: int = def_attr(0)
    leftctx: str = def_attr('')
    rightctx: str = def_attr('')
    numbering: int = def_attr(0)
    align_kwic: int = def_attr(0)
    stored: str = def_attr('')
    line_numbers: int = def_attr(0, persistent=Persistence.PERSISTENT)
    # end

    # must be an empty string and not None
    corpname: str = def_attr('', persistent=Persistence.SEMI_PERSISTENT)
    usesubcorp: str = def_attr('')
    subcname: str = def_attr('')
    subcpath: List[str] = def_attr([])
    iquery: str = def_attr('')
    queryselector: str = def_attr('', persistent=Persistence.SEMI_PERSISTENT)
    lemma: str = def_attr('')
    lpos: str = def_attr('')
    phrase: str = def_attr('')
    char: str = def_attr('')
    word: str = def_attr('')
    wpos: str = def_attr('')
    cql: str = def_attr('')
    tag: str = def_attr('')
    default_attr: Optional[str] = def_attr(None)
    save: int = def_attr(1)
    asnc: int = def_attr(1)
    qmcase: int = def_attr(0)
    include_empty: int = def_attr(0)
    rlines: str = def_attr('250')
    attrs: str = def_attr('word', persistent=Persistence.PERSISTENT)
    ctxattrs: str = def_attr('word', persistent=Persistence.PERSISTENT)
    attr_allpos: str = def_attr('kw')
    base_viewattr: str = def_attr('word', persistent=Persistence.PERSISTENT)
    attr_vmode: str = def_attr('mouseover', persistent=Persistence.PERSISTENT)
    allpos: str = def_attr('kw')
    structs: str = def_attr('', persistent=Persistence.PERSISTENT)
    q: List[str] = def_attr([])
    pagesize: int = def_attr(40, persistent=Persistence.PERSISTENT)
    wlpagesize: int = def_attr(25, persistent=Persistence.PERSISTENT)
    citemsperpage: int = def_attr(50, persistent=Persistence.PERSISTENT)
    multiple_copy: int = def_attr(0, persistent=Persistence.PERSISTENT)  # TODO do we need this?
    wlsendmail: str = def_attr('')
    cup_hl: str = def_attr('q', persistent=Persistence.PERSISTENT)
    structattrs: List[str] = def_attr([], persistent=Persistence.PERSISTENT)
    cql_editor: int = def_attr(1, persistent=Persistence.PERSISTENT)

    flimit: int = def_attr(1)
    freqlevel: int = def_attr(1)
    hidenone: int = def_attr(1)
    fttattr: List[str] = def_attr([])

    kwicleftctx: str = def_attr('-10', persistent=Persistence.PERSISTENT)
    kwicrightctx: str = def_attr('10', persistent=Persistence.PERSISTENT)
    senleftctx_tpl: str = def_attr('-1:%s')
    senrightctx_tpl: str = def_attr('1:%s')
    viewmode: str = def_attr('kwic')
    align: List[str] = def_attr([], persistent=Persistence.SEMI_PERSISTENT)
    maincorp: str = def_attr('')  # used only in case of parallel corpora - specifies primary corp.
    # None means "not initialized" while '' means "user wants no refs"
    refs: Optional[str] = def_attr(None)
    hitlen: int = def_attr(1)

    shuffle: int = def_attr(0, persistent=Persistence.PERSISTENT)

    subcnorm: str = def_attr('tokens')

    # Collocations

    cattr: str = def_attr('word')
    csortfn: str = def_attr('d')
    cbgrfns: List[str] = def_attr(['m', 't', 'd'])
    cfromw: int = def_attr(-5)
    ctow: int = def_attr(5)
    cminfreq: int = def_attr(3)
    cminbgr: int = def_attr(3)

    # Contingency table

    ctminfreq: int = def_attr(80)   # 80th percentile (see ctminfreq_type)
    ctminfreq_type: str = def_attr('pabs')  # percentile as a default filter mode
    ctattr1: str = def_attr('word')
    ctattr2: str = def_attr('word')
    ctfcrit1: str = def_attr('0<0')
    ctfcrit2: str = def_attr('0<0')

    # word list

    wlminfreq: int = def_attr(5)
    wlicase: int = def_attr(0)
    wlwords: str = def_attr('')
    blacklist: str = def_attr('')

    include_nonwords: int = def_attr(0)
    wltype: str = def_attr('simple')
    wlnums: str = def_attr('frq')

    wlposattr1: str = def_attr('')
    wlposattr2: str = def_attr('')
    wlposattr3: str = def_attr('')

    maxsavelines: int = def_attr(1000)
    fcrit: List[str] = def_attr([])

    sort_linegroups: int = def_attr(0)

    def _fix_interdependent_attrs(self):
        """
        Some self.args values may not play well together with some default
        values of dependent attributes. This method should ensure that all
        the values are consistent.
        """
        if self.attr_vmode in ('mouseover', 'mixed') and self.attr_allpos == 'kw':
            self.attr_allpos = 'all'

    def map_args_to_attrs(self, args: Union[RequestArgsProxy, Dict[str, Any]], corp_selector: bool = False):
        """
        Set existing attrs of self to the values provided by args. Multi-value keys are supported
        in a limited way - only list of strings can be set.

        arguments:
        req_args -- a RequestArgsProxy instance or a general dict containing parameters
        """
        in_args = args if isinstance(args, RequestArgsProxy) else RequestArgsProxy(args, {})
        for full_k in in_args.keys():
            values = in_args.getlist(full_k)
            if len(values) > 0:
                key = full_k.split(':')[-1] if corp_selector else full_k
                if hasattr(self, key):
                    if isinstance(getattr(self, key), (list, tuple)):
                        setattr(self, key, values)
                    elif isinstance(getattr(self, key), int):
                        setattr(self, key, int(values[-1]))
                    else:
                        # when mapping to a scalar arg we always take the last
                        # value item but in such case, the length of values should
                        # be always 1
                        setattr(self, key, values[-1])
        self._fix_interdependent_attrs()


def update_attr(obj: Args, k: str, v: Union[str, int, float]) -> None:
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
        if isinstance(getattr(obj, k), (list, tuple)):
            setattr(obj, k, [])
        else:
            setattr(obj, k, None)
    else:
        if isinstance(getattr(obj, k), (list, tuple)):
            setattr(obj, k, getattr(obj, k, []) + [v])
        else:
            setattr(obj, k, v)
