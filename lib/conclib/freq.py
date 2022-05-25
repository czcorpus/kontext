# Copyright (c) 2003-2009  Pavel Rychly
# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

from dataclasses import dataclass
from typing import Any, Dict, List

from action.argmapping.action import IntOpt, StrOpt


@dataclass
class FreqItem:
    Word: List[Dict[str, Any]]
    freq: int
    norm: int
    rel: float


@dataclass
class FreqData:
    Head: List[Dict[str, Any]]
    Items: List[FreqItem]
    SkippedEmpty: bool
    NoRelSorting: bool


@dataclass
class MLFreqArgs:

    ml1attr: StrOpt = 'word'
    ml1ctx: StrOpt = '0'
    ml1pos: IntOpt = 1
    ml1fcode: StrOpt = 'rc'
    ml1icase: StrOpt = ''

    ml2attr: StrOpt = 'word'
    ml2ctx: StrOpt = '0'
    ml2pos: IntOpt = 1
    ml2fcode: StrOpt = 'rc'
    ml2icase: StrOpt = ''

    ml3attr: StrOpt = 'word'
    ml3ctx: StrOpt = '0'
    ml3pos: IntOpt = 1
    ml3fcode: StrOpt = 'rc'
    ml3icase: StrOpt = ''

    ml4attr: StrOpt = 'word'
    ml4ctx: StrOpt = '0'
    ml4pos: IntOpt = 1
    ml4fcode: StrOpt = 'rc'
    ml4icase: StrOpt = ''

    ml5attr: StrOpt = 'word'
    ml5ctx: StrOpt = '0'
    ml5pos: IntOpt = 1
    ml5fcode: StrOpt = 'rc'
    ml5icase: StrOpt = ''


def one_level_crit(prefix: str, attr: str, ctx: str, pos: int, fcode: str, icase: str, bward: str = '',
                   empty: str = ''):
    fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
    attrpart = f'{prefix}{attr}/{icase}{bward}{empty} '
    if not ctx:
        ctx = '{}{}'.format(pos, fromcode.get(fcode, '0'))
    if '~' in ctx and '.' in attr:
        ctx = ctx.split('~')[0]
    return attrpart + ctx


def multi_level_crit(freqlevel: int, args: MLFreqArgs) -> str:
    """
    kwargs are: ml{i}attr, ml{i}ctx, ml{i}pos, ml{i}fcode, ml{i}icase
    """
    return ' '.join(
        one_level_crit(
            '',
            getattr(args, f'ml{i}attr', 'word'),
            getattr(args, f'ml{i}ctx', '0'),
            getattr(args, f'ml{i}pos', 1),
            getattr(args, f'ml{i}fcode', 'rc'),
            getattr(args, f'ml{i}icase', ''),
            'e'
        ) for i in range(1, freqlevel + 1)
    )
