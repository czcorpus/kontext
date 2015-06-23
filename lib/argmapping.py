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


class AttrMappingInfoProxy(object):
    """
    If a user requires an argument mapping object, this proxy is returned. This
    version can only inform about defined arguments.
    """
    def __init__(self, mapping):
        self._mapping = mapping

    def get_params(self, persistence=None):
        is_param = lambda m: isinstance(m, Parameter) and (persistence is None
                                                           or m.meets_persistence(persistence))
        return inspect.getmembers(self._mapping.__class__, predicate=is_param)

    def get_names(self, persistence=None):
        return [k for k, _ in self.get_params(persistence)]


class AttrMappingProxy(AttrMappingInfoProxy):
    """
    An extended version of argument mapping proxy which supports
    access to actual values (from URL, session etc.).
    """

    def __init__(self, mapping, data=None, semi_persistent_data=None):
        """
        Initializes arguments using primary (= request) and secondary
        (= semi-persistent storage in session).

        arguments:
        mapping -- an instance of an argument mapping object
        data -- a werkzeug.datastructures.MultiDict compatible object
        semi_persistent_data -- a dict-like object
        """
        super(AttrMappingProxy, self).__init__(mapping)
        self._data = data if data is not None else MultiDict()
        self._semi_persistent_data = semi_persistent_data if semi_persistent_data else MultiDict()
        self._params = dict(self.get_params())

    def _is_semipersist_loadable(self, item):
        return (self._params[item].meets_persistence(Parameter.SEMI_PERSISTENT)
                and item in self._semi_persistent_data)

    def __getattr__(self, item):
        if item not in self._params:
            raise AttributeError('Attribute %s not found' % item)
        if item in self._data:
            return self._data[item]
        elif self._is_semipersist_loadable(item):
            return self._semi_persistent_data[item]
        else:
            return self._params[item].unwrap()

    def getlist(self, item):
        """
        This function makes the class compatible with Werkzeug's 'request.args'
        and 'request.form' objects
        """
        if item not in self._params:
            raise AttributeError('Attribute %s not found' % item)
        if item in self._data:
            return self._data.getlist(item)
        elif self._is_semipersist_loadable(item):
            return self._semi_persistent_data.getlist(item)
        else:
            return []

    def to_dict(self, none_replac=None):
        """
        Exports data into a dictionary. The fact whether a value will be
        exported as a scalar or array (see MultiDict and __getitem__() vs. getlist())
        is determined by Parameter.is_array(). It means if you define your
        mapping argument as list-like then it will be exported as a list, otherwise
        a single value will be exported.

        Example:
        Let's say the original MultiDict is: [('foo', 'bar'), ('foo', 'baz'), ('name', 'jane')]

        1) if foo is defined as "foo = Parameter('')":
           then to_dict() produces: {'foo': 'bar', 'name': 'jane'},
        2) if foo is defined as "foo = Parameter([])":
           then to_dict() produces: {'foo': ['bar', 'baz'], 'name': 'jane'}

        arguments:
        none_replac -- a (primitive) value used to replace None values

        returns:
        a dictionary
        """
        ans = {}
        for k, p in self.get_params():
            if not p.is_array():
                v = self.__getattr__(k)
                ans[k] = v if v is not None else none_replac
            else:
                ans[k] = self.getlist(k)
        return ans

    def __repr__(self):
        return self.to_dict().__repr__()


class ConcArgsMapping(object):
    """
    This class covers all the attributes representing a concordance. I.e. the application should
    be able to restore any concordance just by using these parameters.

    Please note that this list does not include the 'q' parameter which collects currently built query
    (it has been inherited from Bonito2).
    """
    corpname = Parameter(u'', persistent=Parameter.SEMI_PERSISTENT)

    usesubcorp = Parameter(u'')

    maincorp = Parameter(u'')

    viewmode = Parameter('kwic')

    pagesize = Parameter(40, persistent=Parameter.PERSISTENT)

    align = Parameter('')

    attrs = Parameter(u'word', persistent=Parameter.PERSISTENT)

    attr_allpos = Parameter(u'kw')

    ctxattrs = Parameter(u'word', persistent=Parameter.PERSISTENT)

    structs = Parameter(u'p,g,err,corr', persistent=Parameter.PERSISTENT)

    # None means "not initialized" while '' means "user wants to show no refs"
    refs = Parameter(None)

    sel_aligned = Parameter([], persistent=Parameter.SEMI_PERSISTENT)


class QueryInputs(object):
    """
    """
    iquery = Parameter(u'')

    lemma = Parameter(u'')

    phrase = Parameter(u'')

    word = Parameter(u'')

    char = Parameter(u'')

    cql = Parameter(u'')

    queryselector = Parameter(u'', persistent=Parameter.SEMI_PERSISTENT)


class WidectxArgsMapping(object):
    """
    Attributes needed to open correct detailed KWIC context.
    """
    attrs = Parameter(u'word', persistent=Parameter.PERSISTENT)

    attr_allpos = Parameter(u'kw')

    ctxattrs = Parameter(u'word', persistent=Parameter.PERSISTENT)

    structs = Parameter(u'p,g,err,corr', persistent=Parameter.PERSISTENT)
    
    refs = Parameter(None)
