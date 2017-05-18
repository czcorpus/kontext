# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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


class CollFormArgs(object):

    def __init__(self):
        self.cattr = None
        self.cfromw = '-1'
        self.ctow = '0'
        self.cminfreq = '5'
        self.cminbgr = '3'
        self.cbgrfns = ['t', 'm']
        self.csortfn = 't'

    def update(self, args):
        self.cattr = args.cattr
        self.cfromw = args.cfromw
        self.ctow = args.ctow
        self.cminfreq = args.cminfreq
        self.cminbgr = args.cminbgr
        self.cbgrfns = args.cbgrfns
        self.csortfn = args.csortfn
        return self

    def to_dict(self):
        return dict(self.__dict__)


class FreqFormArgs(object):

    def __init__(self):
        self.fttattr = []
        self.flimit = '1'
        self.freq_sort = 'freq'
        self.ftt_include_empty = False

    def update(self, args):
        self.fttattr = args.fttattr
        self.flimit = args.flimit
        self.freq_sort = args.freq_sort
        self.ftt_include_empty = args.ftt_include_empty
        return self

    def to_dict(self):
        return dict(self.__dict__)

