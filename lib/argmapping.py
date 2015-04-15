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

import inspect

from werkzeug.datastructures import MultiDict


class Parameter(object):
    """
    Setting an object of this type as a static property
    of Controller causes Controller to create an object
    property with wrapped value. This solves the attribute
    mess in the original Bonito code.

    arguments:
    value -- a default value of the parameter (defines both value and type)
    persistent -- bool value specifying whether we should save the value to user's settings
    """

    NON_PERSISTENT = 0b0000  # not stored at all
    PERSISTENT = 0b0001  # stored in user's settings (and not elsewhere)
    SEMI_PERSISTENT = 0b0010  # stored in user's session (and not elsewhere)

    def __init__(self, value, persistent=NON_PERSISTENT):
        """
        arguments:
        value -- wrapped value (primitive types, empty dict, empty list, tuple)
        """
        self.value = value
        self.persistent = persistent

    def unwrap(self):
        if type(self.value) is list:
            ans = self.value[:]
        elif self.value == {}:
            ans = {}
        elif type(self.value) is dict:
            raise TypeError('Cannot define static property as a non-empty dictionary: %s' % (self.value, ))
        else:
            ans = self.value
        return ans

    def is_array(self):
        return type(self.value) is tuple or type(self.value) is list

    def meets_persistence(self, p_level):
        return self.persistent & p_level == p_level


class GeneralAttrMapping(object):
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
        self._data = data if data is not None else MultiDict()
        for k, v in inspect.getmembers(self.__class__, predicate=lambda m: isinstance(m, Parameter)):
            if k in self._data:
                setattr(self, k, self._data[k])
            else:
                setattr(self, k, v.unwrap())

    def get_names(self):
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
        for k in self.get_names():
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
    corpname = Parameter(u'')
    usesubcorp = Parameter(u'')
    maincorp = Parameter(u'')
    viewmode = Parameter('kwic')
    pagesize = Parameter(40, persistent=Parameter.PERSISTENT)
    align = Parameter('')
    attrs = Parameter(u'word', persistent=Parameter.PERSISTENT)
    attr_allpos = Parameter(u'kw')
    ctxattrs = Parameter(u'word', persistent=Parameter.PERSISTENT)
    structs = Parameter(u'p,g,err,corr', persistent=Parameter.PERSISTENT)
    refs = Parameter(None)  # None means "not initialized" while '' means "user wants to show no refs"
    sel_aligned = Parameter([])


class WidectxArgsMapping(GeneralAttrMapping):
    """
    Attributes needed to open correct detailed KWIC context.
    """
    attrs = Parameter(u'word', persistent=Parameter.PERSISTENT)
    attr_allpos = Parameter(u'kw')
    ctxattrs = Parameter(u'word', persistent=Parameter.PERSISTENT)
    structs = Parameter(u'p,g,err,corr', persistent=Parameter.PERSISTENT)
    refs = Parameter(None)
