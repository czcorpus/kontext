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
from werkzeug.datastructures import MultiDict


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

    def __init__(self, data=None):
        """
        arguments:
        data -- a werkzeug.datastructures.MultiDict compatible object
        """
        super(GeneralAttrMapping, self).__init__()
        if data is not None:
            for k in self.get_attrs():
                if k in data:
                    setattr(self, k, data[k])
            self._data = data
        else:
            self._data = data if data is not None else MultiDict()

    def get_attrs(self):
        return self.__dict__.keys()

    def getlist(self, item):
        """
        This function makes the class compatible with Werkzeug's 'request.args'
        and 'request.form' objects
        """
        return self._data.getlist(item)

    def to_dict(self, multivals=(), none_replac=None):
        """
        Exports data into a dictionary. By default, all the values are scalar
        even if respective MultiDict contains multiple values per the key.
        To export a value as a list, the respective key must be specified
        explicitly via 'multivals' parameter.
        E.g.: if the original MultiDict is: [('foo', 'bar'), ('foo', 'baz'), ('name', 'jane')]
        then:
          to_dict() produces: {'foo': 'bar', 'name': 'jane'}.
          to_dict(multivals=('foo',)) produces: {'foo': ['bar', 'baz'], 'name': 'jane'}

        arguments:
        multivals -- a list/tuple of keys that will have list-like values (even if there will
                     be one or no respective value)
        none_replac -- a (primitive) value used to replace None values

        returns:
        a dictionary
        """
        ans = {}
        for k in self.get_attrs():
            if k not in multivals:
                v = getattr(self, k)
                ans[k] = v if v is not None else none_replac
            else:
                ans[k] = self.getlist(k)
        return ans

    def __repr__(self):
        return self.to_dict().__repr__()


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
    sel_aligned = None


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
