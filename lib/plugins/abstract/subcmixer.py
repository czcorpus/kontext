# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
The 'subcmixer' plug-in provides a way how to create
subcorpora with defined proportions of specific text
types. It requires a working 'live_attributes'
plug-in which provides input arguments used by 'subcmixer'.
"""

import abc
from typing import Any, List, Optional, TypeVar, TypedDict, Dict, Generic
from corplib.corpus import KCorpus
from lib.controller.plg import PluginCtx


class ExpressionItem(TypedDict):
    attrName: str
    attrValue: str
    ratio: Optional[float]


T = TypeVar('T')


class AbstractSubcMixer(abc.ABC, Generic[T]):

    @abc.abstractmethod
    def process(self, plugin_ctx: PluginCtx, corpus: KCorpus, corpname: str, aligned_corpora: List[str], args: List[ExpressionItem]) -> T:
        """
        arguments:
            plugin_ctx -- kontext.PluginCtx instance
            corpus --
            corpname -- a corpus name
            aligned_corpora -- corpora we want our result to respect as aligned ones
                            (i.e. only results witch matching items in these corpora
                            can be included)
            args -- required text types ratios
        """
