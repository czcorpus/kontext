# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

import logging
from dataclasses import Field, dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, NewType, Optional, Union

from action.req_args import (
    JSONRequestArgsProxy, RequestArgsProxy, create_req_arg_proxy,
    is_req_args_proxy)

StrOpt = NewType('StrOpt', str)
ListStrOpt = NewType('ListStrOpt', List[str])
IntOpt = NewType('IntOpt', int)
ListIntOpt = NewType('ListIntOpt', List[int])


class Persistence(Enum):
    # not stored at all
    NON_PERSISTENT = 0b0000

    # stored in user's settings (and not elsewhere)
    PERSISTENT = 0b0001


# This attribute set covers concordance options
# specifying how to concordance is presented
ConcArgsMapping = (
    'maincorp',
    'viewmode',
    'pagesize',
    'attrs',
    'attr_vmode',
    'base_viewattr',  # attribute used in a text flow
    'structs',
    'refs',
    'ref_max_width'
)


# Arguments needed to open a correct detailed KWIC context
WidectxArgsMapping = (
    'attrs',
    'structs',
    'refs',
    'hitlen',
)


WordlistArgsMapping = (
    'wlpagesize',
    'wlsort',
)

KeywordsArgsMapping = (
)


def comma_separated_to_js(v: str) -> List[str]:
    return v.split(',') if v else []


def mk_metdata(persistent: Persistence = Persistence.NON_PERSISTENT, to_js: Optional[Callable[[Any], Any]] = None):
    return {'persistent': persistent, 'to_js': to_js if to_js else lambda v: v}


@dataclass
class MinArgs:
    corpname: str = field(default='', metadata=mk_metdata())
    usesubcorp: str = field(default='', metadata=mk_metdata())
    subcname: str = field(default='', metadata=mk_metdata())
    align: List[str] = field(default_factory=list, metadata=mk_metdata())
    maincorp: str = field(default='', metadata=mk_metdata())

    def map_args_to_attrs(self, args: Union[RequestArgsProxy, JSONRequestArgsProxy, Dict[str, Any]]):
        in_args = args if is_req_args_proxy(args) else create_req_arg_proxy(args, {}, {})
        if len(in_args.corpora) > 0:
            self.corpname = in_args.corpora[0]
            self.align = in_args.corpora[1:] if len(in_args.corpora) > 1 else []
            self.usesubcorp = in_args.getvalue('usesubcorp')


@dataclass
class GeneralOptionsArgs:
    # concordance
    pagesize: int = field(default=40, metadata=mk_metdata(Persistence.PERSISTENT))
    kwicleftctx: str = field(default='-10', metadata=mk_metdata(Persistence.PERSISTENT))
    kwicrightctx: str = field(default='10', metadata=mk_metdata(Persistence.PERSISTENT))
    line_numbers: bool = field(default=False, metadata=mk_metdata(Persistence.PERSISTENT))
    shuffle: int = field(default=0, metadata=mk_metdata(Persistence.PERSISTENT))
    rich_query_editor: bool = field(default=True, metadata=mk_metdata(Persistence.PERSISTENT))
    ref_max_width: int = field(default=40, metadata=mk_metdata(Persistence.PERSISTENT))

    # wordlist
    wlpagesize: int = field(default=25, metadata=mk_metdata(Persistence.PERSISTENT))

    # keywords
    kwpagesize: int = field(default=25, metadata=mk_metdata(Persistence.PERSISTENT))

    # frequency
    fpagesize: int = field(default=50, metadata=mk_metdata())
    fdefault_view: str = field(default='tables', metadata=mk_metdata(Persistence.PERSISTENT))

    # pquery
    pqueryitemsperpage: int = field(default=50, metadata=mk_metdata(Persistence.PERSISTENT))

    # collocations
    citemsperpage: int = field(default=50, metadata=mk_metdata(Persistence.PERSISTENT))

    # subcpage
    subcpagesize: int = field(default=40, metadata=mk_metdata(Persistence.PERSISTENT))

    def map_args_to_attrs(self, args: Union[RequestArgsProxy, JSONRequestArgsProxy, Dict[str, Any]]):
        in_args = args if is_req_args_proxy(args) else create_req_arg_proxy(args, {}, {})
        for key in in_args.keys():
            values = in_args.getlist(key)
            if len(values) > 0:
                if hasattr(self, key):
                    try:
                        if isinstance(getattr(self, key), bool):
                            setattr(self, key, bool(int(values[-1])))
                        elif isinstance(getattr(self, key), int):
                            setattr(self, key, int(values[-1]))
                        else:
                            setattr(self, key, values[-1])
                    except ValueError as ex:
                        raise ValueError('Request attribute \'{}\': {}'.format(key, ex))


@dataclass
class UserActionArgs(GeneralOptionsArgs, MinArgs):  # note - order of parents matter here!
    pass


@dataclass
class Args(UserActionArgs):
    """
    """
    @staticmethod
    def get_field(name: str) -> Field:
        return Args.__dataclass_fields__[name]

    # specifies response output format (used in case default one is not applicable)
    format: str = field(default='', metadata=mk_metdata())

    ml: int = field(default=0, metadata=mk_metdata())
    concarf: str = field(default='', metadata=mk_metdata())
    concsize: str = field(default='', metadata=mk_metdata())
    Lines: List = field(default_factory=list, metadata=mk_metdata())
    fromp: int = field(default=1, metadata=mk_metdata())
    numofpages: int = field(default=0, metadata=mk_metdata())
    pnfilter: str = field(default='p', metadata=mk_metdata())
    filfl: str = field(default='f', metadata=mk_metdata())
    filfpos: str = field(default='-5', metadata=mk_metdata())
    filtpos: str = field(default='5', metadata=mk_metdata())

    # concordance sorting
    sattr: str = field(default='', metadata=mk_metdata())
    sicase: str = field(default='', metadata=mk_metdata())
    sbward: str = field(default='', metadata=mk_metdata())
    spos: int = field(default=5, metadata=mk_metdata())
    skey: str = field(default='rc', metadata=mk_metdata())
    sortlevel: int = field(default=1, metadata=mk_metdata())

    # multi-level freq. distrib
    ml1attr: str = field(default='', metadata=mk_metdata())
    ml2attr: str = field(default='', metadata=mk_metdata())
    ml3attr: str = field(default='', metadata=mk_metdata())
    ml4attr: str = field(default='', metadata=mk_metdata())
    ml5attr: str = field(default='', metadata=mk_metdata())
    ml1icase: str = field(default='', metadata=mk_metdata())
    ml2icase: str = field(default='', metadata=mk_metdata())
    ml3icase: str = field(default='', metadata=mk_metdata())
    ml4icase: str = field(default='', metadata=mk_metdata())
    ml5icase: str = field(default='', metadata=mk_metdata())
    ml1bward: str = field(default='', metadata=mk_metdata())
    ml2bward: str = field(default='', metadata=mk_metdata())
    ml3bward: str = field(default='', metadata=mk_metdata())
    ml4bward: str = field(default='', metadata=mk_metdata())
    ml5bward: str = field(default='', metadata=mk_metdata())
    ml1pos: int = field(default=1, metadata=mk_metdata())
    ml2pos: int = field(default=1, metadata=mk_metdata())
    ml3pos: int = field(default=1, metadata=mk_metdata())
    ml4pos: int = field(default=1, metadata=mk_metdata())
    ml5pos: int = field(default=1, metadata=mk_metdata())
    ml1ctx: str = field(default='0~0>0', metadata=mk_metdata())
    ml2ctx: str = field(default='0~0>0', metadata=mk_metdata())
    ml3ctx: str = field(default='0~0>0', metadata=mk_metdata())
    ml4ctx: str = field(default='0~0>0', metadata=mk_metdata())
    ml5ctx: str = field(default='0~0>0', metadata=mk_metdata())

    freq_sort: str = field(default='freq', metadata=mk_metdata())
    heading: int = field(default=0, metadata=mk_metdata())
    saveformat: str = field(default='txt', metadata=mk_metdata())
    simple_n: int = field(default=1, metadata=mk_metdata())
    usearf: int = field(default=0, metadata=mk_metdata())
    collpage: int = field(default=1, metadata=mk_metdata())
    fpage: int = field(default=1, metadata=mk_metdata())
    wlsort: str = field(default='', metadata=mk_metdata())
    keywords: str = field(default='', metadata=mk_metdata())
    Keywords: List[str] = field(default_factory=list, metadata=mk_metdata())
    Items: List[str] = field(default_factory=list, metadata=mk_metdata())  # TODO check and remove
    selected: str = field(default='', metadata=mk_metdata())
    pages: int = field(default=0, metadata=mk_metdata())
    leftctx: str = field(default='', metadata=mk_metdata())
    rightctx: str = field(default='', metadata=mk_metdata())
    numbering: int = field(default=0, metadata=mk_metdata())
    align_kwic: int = field(default=0, metadata=mk_metdata())
    stored: str = field(default='', metadata=mk_metdata())
    # end

    subcpath: List[str] = field(default_factory=list, metadata=mk_metdata())
    save: int = field(default=1, metadata=mk_metdata())
    rlines: str = field(default='250', metadata=mk_metdata())
    attrs: str = field(default='word', metadata=mk_metdata(
        Persistence.PERSISTENT, comma_separated_to_js))
    base_viewattr: str = field(default='word', metadata=mk_metdata(Persistence.PERSISTENT))
    attr_vmode: str = field(default='visible-kwic', metadata=mk_metdata(Persistence.PERSISTENT))
    structs: str = field(default='', metadata=mk_metdata(
        Persistence.PERSISTENT, comma_separated_to_js))
    q: List[str] = field(default_factory=list, metadata=mk_metdata())
    cutoff: int = field(default=0, metadata=mk_metdata())
    wlsendmail: str = field(default='', metadata=mk_metdata())
    cup_hl: str = field(default='q', metadata=mk_metdata(Persistence.PERSISTENT))
    structattrs: List[str] = field(
        default_factory=list, metadata=mk_metdata(Persistence.PERSISTENT))

    qs_enabled: bool = field(default=True, metadata=mk_metdata(Persistence.PERSISTENT))

    flimit: int = field(default=1, metadata=mk_metdata())
    freqlevel: int = field(default=1, metadata=mk_metdata())
    hidenone: int = field(default=1, metadata=mk_metdata())
    fttattr: List[str] = field(default_factory=list, metadata=mk_metdata())
    fttattr_async: List[str] = field(default_factory=list, metadata=mk_metdata())

    senleftctx_tpl: str = field(default='-1:%s', metadata=mk_metdata())
    senrightctx_tpl: str = field(default='1:%s', metadata=mk_metdata())
    viewmode: str = field(default='kwic', metadata=mk_metdata())
    """
    used only in case of parallel corpora - specifies primary corp.
    """
    # None means "not initialized" while '' means "user wants no refs"
    refs: Optional[str] = field(default=None, metadata=mk_metdata(to_js=comma_separated_to_js))
    ref_max_width: Optional[int] = field(default=40, metadata=mk_metdata())
    hitlen: int = field(default=1, metadata=mk_metdata())

    subcnorm: str = field(default='tokens', metadata=mk_metdata())

    # Collocations

    cattr: str = field(default='word', metadata=mk_metdata())
    csortfn: str = field(default='d', metadata=mk_metdata())
    cbgrfns: List[str] = field(default_factory=lambda: ['m', 't', 'd'], metadata=mk_metdata())
    cfromw: int = field(default=-5, metadata=mk_metdata())
    ctow: int = field(default=5, metadata=mk_metdata())
    cminfreq: int = field(default=3, metadata=mk_metdata())
    cminbgr: int = field(default=3, metadata=mk_metdata())

    # 2-dimensional frequency

    # 80th percentile (see ctminfreq_type)
    ctminfreq: int = field(default=80, metadata=mk_metdata())
    ctminfreq_type: str = field(
        default='pabs', metadata=mk_metdata())  # percentile as a default filter mode
    # freq. crit. for the 1st dim. in 2D freq. dist.
    ctfcrit1: str = field(default='word 0<0', metadata=mk_metdata())
    # freq. crit. for the 2nd dim. in 2D freq. dist.
    ctfcrit2: str = field(default='word 0<0', metadata=mk_metdata())

    maxsavelines: int = field(default=1000, metadata=mk_metdata())
    fcrit: List[str] = field(default_factory=list, metadata=mk_metdata())
    fcrit_async: List[str] = field(default_factory=list, metadata=mk_metdata())

    sort_linegroups: int = field(default=0, metadata=mk_metdata())

    def _upgrade_legacy_value(self, key: str, value: Union[str, int], src_data: RequestArgsProxy) -> Union[str, int]:
        """
        note: this will be removed in v1.0.0
        """
        if key == 'attr_vmode':
            if 'attr_allpos' in src_data:
                v2 = src_data.getvalue('attr_allpos')
                logging.getLogger(__name__).warning(
                    f'Upgrading legacy attr_vmode conf: {value} + {v2}')
                if value == 'mixed' and v2 == 'all':
                    return 'visible-kwic'
                if value == 'multiline' and v2 == 'all':
                    return 'visible-multiline'
                if value == 'visible' and v2 == 'all':
                    return 'visible-all'
                if value == 'mouseover' and v2 == 'all':
                    return 'mouseover'
                return 'visible-kwic'
            if value not in ('visible-all', 'visible-kwic', 'visible-multiline', 'mouseover'):
                logging.getLogger(__name__).warning(
                    f'Invalid attr_vmode {value} - auto-corrected to "visible-kwic".')
                return 'visible-kwic'
        return value

    @staticmethod
    def _is_options_only_arg(name: str) -> bool:
        """
        Tests whether the provided argument should be treated as one activated only
        via stored user options - i.e. having the value in URL (or some submitted form)
        should not change its value.
        """
        return name in ('shuffle', )

    @staticmethod
    def _is_request_map_source(data: Union[RequestArgsProxy, JSONRequestArgsProxy, Dict[str, Any]]):
        return isinstance(data, RequestArgsProxy) or isinstance(data, JSONRequestArgsProxy)

    def map_args_to_attrs(self, args: Union[RequestArgsProxy, JSONRequestArgsProxy, Dict[str, Any]]):
        """
        Set existing attrs of self to the values provided by args. Multi-value keys are supported
        in a limited way - only a list of strings can be set.

        arguments:
        req_args -- a RequestArgsProxy instance or a general dict containing parameters
        """
        in_args = args if is_req_args_proxy(args) else create_req_arg_proxy(args, {}, {})
        for key in in_args.keys():
            values = in_args.getlist(key)
            if len(values) > 0:
                if hasattr(self, key) and not (self._is_options_only_arg(key) and self._is_request_map_source(args)):
                    try:
                        if isinstance(getattr(self, key), (list, tuple)):
                            setattr(self, key, values)
                        elif isinstance(getattr(self, key), bool):
                            setattr(self, key, bool(int(values[-1])))
                        elif isinstance(getattr(self, key), int):
                            setattr(self, key, int(
                                self._upgrade_legacy_value(key, values[-1], in_args)))
                        else:
                            if key in ('attrs', 'structs', 'refs'):
                                setattr(self, key, ','.join(values))
                            # when mapping to a scalar arg we always take the last
                            # value item but in such case, the length of values should
                            # be always 1
                            else:
                                setattr(self, key, self._upgrade_legacy_value(
                                    key, values[-1], in_args))
                    except Exception as ex:
                        raise RuntimeError(f'Failed to map request attribute \'{key}\': {ex}')
        if len(in_args.corpora) > 0:
            self.corpname = in_args.corpora[0]
            self.align = in_args.corpora[1:] if len(in_args.corpora) > 1 else []
            self.usesubcorp = in_args.getvalue('usesubcorp')


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
