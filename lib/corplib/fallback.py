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
    EmptyCorpus serves as kind of a fake corpus to keep KonText operational
    in some special cases (= cases where we do not need any corpus to be
    instantiated which is a situation original Bonito code probably never
    count with).
    """

    def __init__(self, **kwargs):
        self.cm = object()
        self.corpname = ''
        self.subcname = None
        self.is_published = False
        self.orig_subcname = None
        self.author = None
        self.author_id = None
        self.orig_spath = None
        for k, v in list(kwargs.items()):
            if hasattr(self, k):
                setattr(self, k, v)

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
        return {
            'ENCODING': 'UTF-8',
            'NAME': self.corpname,
            'ATTRLIST': ''
        }.get(param, '')

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

    def is_subcorpus(self):
        return False


class ErrorCorpus(EmptyCorpus):
    """
    This type is used in case we encounter a corpus-initialization error
    and yet we still need proper template/etc. variables initialized
    (e.g. user visits URL containing non-existing sub-corpus)
    """

    def __init__(self, err):
        """
        arguments:
        err -- an error which caused that the original corpus failed to initialize
        """
        super(ErrorCorpus, self).__init__()
        self._error = err

    def get_error(self):
        """
        returns original error
        """
        return self._error

    def is_subcorpus(self):
        return False
