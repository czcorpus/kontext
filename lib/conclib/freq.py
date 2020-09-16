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

from typing import Dict, Union, List


def one_level_crit(prefix: str, attr: str, ctx: str, pos: int, fcode: str, icase: str, bward: str = '',
                   empty: str = ''):
    fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
    attrpart = f'{prefix}{attr}/{icase}{bward}{empty} '
    if not ctx:
        ctx = '{}{}'.format(pos, fromcode.get(fcode, '0'))
    if '~' in ctx and '.' in attr:
        ctx = ctx.split('~')[0]
    return attrpart + ctx


def multi_level_crit(freqlevel: int, **kwargs: Dict[str, Union[str, int]]) -> str:
    """
    kwargs are: ml{i}attr, ml{i}ctx, ml{i}pos, ml{i}fcode, ml{i}icase
    """
    return ' '.join(one_level_crit('',
                    kwargs.get(f'ml{i}attr', 'word'),
                    kwargs.get(f'ml{i}ctx', '0'),
                    kwargs.get(f'ml{i}pos', 1),
                    kwargs.get(f'ml{i}fcode', 'rc'),
                    kwargs.get(f'ml{i}icase', ''),
                    'e')
                    for i in range(1, freqlevel + 1))
