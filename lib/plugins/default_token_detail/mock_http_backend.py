# -*- coding: utf-8 -*-

# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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
HTTPBackend mock to be used in the default_token_detail plugin unittests
"""

import os

from plugins.abstract.token_detail import AbstractBackend
from plugins.default_token_detail.backends import cached


class HTTPBackend(AbstractBackend):
    def __init__(self, conf):
        super(HTTPBackend, self).__init__()
        self._conf = conf

    @cached
    def fetch_data(self, word, lemma, tag, aligned_corpora, lang):
        if lemma == 'unicode':
            return [u"mocked HTTP backend output - unicode characters: ěščřžýáíé", True]
        if lemma == 'false':
            return ["mocked HTTP backend output - not found", False]
        if lemma == 'exception':
            raise Exception("Mocked exception")
        return ["mocked HTTP backend output - word: %s, lemma: %s" % (word, lemma), True]

    @staticmethod
    def get_path():
        return os.path.join(os.path.dirname(os.path.realpath(__file__)), 'backends/__init__.py')
