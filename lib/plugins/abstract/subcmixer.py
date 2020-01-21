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


class AbstractSubcMixer(abc.ABC):

    @abc.abstractmethod
    def process(self, plugin_api, corpus, corpname, aligned_corpora, args):
        """
        arguments:
            plugin_api -- kontext.PluginApi instance
            corpus -- a manatee.Corpus instance
            corpname -- a corpus name
            aligned_corpora -- corpora we want our result to respect as aligned ones
                            (i.e. only results witch matching items in these corpora
                            can be included)
            args -- required text types ratios
        """
