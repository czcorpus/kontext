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
HTTPBackend mock to be used in the default_token_connect plugin unittests
"""

import os

from plugins.abstract.token_connect import AbstractBackend
from plugins.default_token_connect.backends import cached


class MockHTTPBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super(MockHTTPBackend, self).__init__(ident)
        self._conf = conf

    @cached
    def fetch(self, corpora, maincorp, token_id, num_tokens, query_args, lang, context=None):
        lemma = query_args.get('lemma', None)
        word = query_args.get('word', None)
        if lemma == 'unicode':
            return ["mocked HTTP backend output - unicode characters: ěščřžýáíé", True]
        if lemma == 'false':
            return ["mocked HTTP backend output - not found", False]
        if lemma == 'lemma1':
            return ['Lemma 1 response', True]
        if lemma == 'lemma2':
            return ['Lemma 2 response', True]
        if lemma == 'exception':
            raise Exception("Mocked exception")
        return ["mocked HTTP backend output - word: %s, lemma: %s" % (word, lemma), True]

    @staticmethod
    def get_path():
        return os.path.join(os.path.dirname(os.path.realpath(__file__)), 'backends/__init__.py')

    def get_required_attrs(self):
        return self._conf['posAttrs']
