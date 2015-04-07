# Copyright (c) 2015 Institute of the Czech National Corpus
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

from structures import FixedDict


class GeneralAttrMapping(FixedDict):
    """
    A class collecting arguments used in URL to perform
    some (typically repeated) task - e.g. to be able to
    (re)store a concordance.

    It is expected to be used along with request.args, request.form
    to extract/store parameters without need to repeat them
    manually again and again.

    Implementations are expected just to define arguments (i.e.
    no methods are needed).
    """
    def get_attrs(self):
        return self.__dict__.keys()


class ConcArgsMapping(GeneralAttrMapping):
    """
    This class covers all the attributes representing a concordance. I.e. the application should
    be able to restore any concordance just by using these parameters.

    Please note that this list does not include the 'q' parameter which collects currently built query
    (it has been inherited from Bonito2).
    """
    corpname = None
    usesubcorp = None
    maincorp = None
    viewmode = None
    pagesize = None
    align = None
    attrs = None
    attr_allpos = None
    ctxattrs = None
    structs = None
    refs = None


class WidectxArgsMapping(GeneralAttrMapping):
    """
    Attributes needed to open correct detailed KWIC context.
    """
    usesubcorp = None
    attrs = None
    attr_allpos = None
    ctxattrs = None
    structs = None
    refs = None
