# Copyright (c) 2013 Institute of the Czech National Corpus
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


class EmptyCorpus(object):
    """
    """

    def __init__(self):
        self.cm = object()
        self.corpname = ''

    def compute_docf(self, *args, **kwargs):
        pass

    def count_ARF(self, *args, **kwargs):
        pass

    def count_rest(self, *args, **kwargs):
        pass

    def eval_query(self, *args, **kwargs):
        pass

    def filter_fstream(self, *args, **kwargs):
        pass

    def filter_query(self, *args, **kwargs):
        pass

    def get_attr(self, *args, **kwargs):
        pass

    def get_conf(self, param):
        if param == 'ENCODING':
            return 'UTF-8'
        return ''

    def get_conffile(self, *args, **kwargs):
        pass

    def get_confpath(self, *args, **kwargs):
        pass

    def get_info(self, *args, **kwargs):
        pass

    def get_sizes(self, *args, **kwargs):
        pass

    def get_struct(self, *args, **kwargs):
        pass

    def search_size(self):
        return 0

    def set_default_attr(self, *args, **kwargs):
        pass

    def size(self):
        return 0

