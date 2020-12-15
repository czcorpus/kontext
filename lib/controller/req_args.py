# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import werkzeug
from collections import defaultdict
from typing import List, Union, Dict, Any


class RequestArgsProxy:
    """
    A wrapper class allowing an access to both
    Werkzeug's request.form and request.args (MultiDict objects).
    It is also possible to force arguments manually in which
    case anything with the same key from 'form' or 'args' is
    suppressed. This is used when unpacking arguments from
    a query hash code.

    The class is used in 'pre dispatch' phase and it is not
    expected to be used within individual action methods
    where 'request' object is available and also 'self.args'
    mapping.
    """

    def __init__(self, form: Union[werkzeug.datastructures.MultiDict, Dict[str, Any]],
                 args: Union[werkzeug.datastructures.MultiDict, Dict[str, Any]]):
        self._form = form if isinstance(
            form, werkzeug.datastructures.MultiDict) else werkzeug.datastructures.MultiDict(form)
        self._args = args if isinstance(
            args, werkzeug.datastructures.MultiDict) else werkzeug.datastructures.MultiDict(args)
        self._forced = defaultdict(lambda: [])

    def __iter__(self):
        return list(self.keys()).__iter__()

    def __contains__(self, item):
        return item in self._forced or item in self._form or item in self._args

    @property
    def corpora(self) -> List[str]:
        return self.getlist('corpname') + self.getlist('align')

    def keys(self):
        return list(set(list(self._forced.keys()) + list(self._form.keys()) + list(self._args.keys())))

    def getlist(self, k: str) -> List[str]:
        """
        Returns a list of values matching passed argument
        name. List is returned even if there is a single
        value avalilable.

        URL arguments have higher priority over POST ones.
        """
        tmp = self._forced[k]
        if len(tmp) > 0:
            return tmp
        tmp = self._form.getlist(k)
        if len(tmp) > 0:
            return tmp
        tmp = self._args.getlist(k)
        return tmp

    def getvalue(self, k):
        """
        Returns either a single value or a list of values
        depending on HTTP request arguments.

        URL arguments have higher priority over POST ones.
        """
        tmp = self.getlist(k)
        if len(tmp) == 0:
            return None
        elif len(tmp) == 1:
            return tmp[0]
        else:
            return tmp

    def add_forced_arg(self, k, *v: List[str]) -> List[str]:
        """
        add key-value parameter overriding any previous or
        future changes applied from URL/Form data. The method
        returns previous values stored under the key k.
        """
        curr = self.getlist(k)[:]
        self._forced[k] = self._forced[k] + list(v)
        return curr

    def as_dict(self):
        """
        Export request data as a dictionary. In case
        a key represents a multi-value - a list is set
        as a value, otherwise a string or None is present.
        """
        ans = {}
        for k in self.keys():
            vals = self.getlist(k)
            if len(vals) == 0:
                ans[k] = None
            elif len(vals) == 1:
                ans[k] = vals[0]
            else:
                ans[k] = vals
        return ans


class JSONRequestArgsProxy:
    """
    JSONRequestArgsProxy is a proxy for app-wide arguments submitted via URL and JSON
    encoded data (e.g. 'corpname', 'usesubcorp', 'format'). It is intended for use similar
    to RequestArgsProxy. I.e. it should be used to extract core arguments of string, int,
    list[string], list[int] etc. types.  Anything more complex/specific should be done
    by direct access to the JSON data.

    The purpose of the class is the same as in case of RequestArgsProxy.
    """

    def __init__(self, json_data: Dict[str, Any],
                 args: Union[werkzeug.datastructures.MultiDict, Dict[str, Any]]):
        self._args = args if isinstance(
            args, werkzeug.datastructures.MultiDict) else werkzeug.datastructures.MultiDict(args)
        self._forced = defaultdict(lambda: [])
        self._json = json_data

    def __iter__(self):
        return list(self.keys()).__iter__()

    def __contains__(self, item):
        return item in self._forced or item in self._json or item in self._args

    @property
    def corpora(self) -> List[str]:
        if self._json.get('type') == 'concQueryArgs':
            return [q['corpname'] for q in self._json['queries']]
        else:
            return [self._json.get('corpname')]

    def keys(self):
        if type(self._json) is dict:
            return self._json.keys()
        return []

    def getlist(self, k: str) -> List[str]:
        """
        Returns a list of values matching passed argument
        name. List is returned even if there is a single
        value avalilable.

        URL arguments have higher priority over JSON ones.

        Please use this method carefully - only for simple
        URL-like arguments as JSON submitted data may contains
        complex nested structures.
        """
        tmp = self._forced[k]
        if len(tmp) > 0:
            return tmp
        tmp = self._json.get(k)
        if type(tmp) is list:
            return tmp
        return [tmp] if tmp is not None else []

    def getvalue(self, k):
        """
        Returns either a single value or a list of values
        depending on HTTP request arguments.

        URL arguments have higher priority over JSON ones.
        """
        tmp = self.getlist(k)
        if len(tmp) == 0:
            return None
        elif len(tmp) == 1:
            return tmp[0]
        else:
            return tmp

    def add_forced_arg(self, k, *v: List[str]) -> List[str]:
        """
        add key-value parameter overriding any previous or
        future changes applied from URL/JSON data. The method
        returns previous values stored under the key k.
        """
        curr = self.getlist(k)[:]
        self._forced[k] = self._forced[k] + list(v)
        return curr

    def as_dict(self):
        """
        Export request data as a dictionary. In case
        a key represents a multi-value - a list is set
        as a value, otherwise a string or None is present.
        """
        ans = {}
        for k in self.keys():
            vals = self.getlist(k)
            if len(vals) == 0:
                ans[k] = None
            elif len(vals) == 1:
                ans[k] = vals[0]
            else:
                ans[k] = vals
        return ans


def create_req_arg_proxy(form: Union[werkzeug.datastructures.MultiDict, Dict[str, Any]],
                         args: Union[werkzeug.datastructures.MultiDict, Dict[str, Any]],
                         json_data: Dict[str, Any]):
    """
    Create either a JSONRequestArgsProxy or RequestArgsProxy based on provided data.
    """
    if json_data:
        return JSONRequestArgsProxy(json_data, args)
    else:
        return RequestArgsProxy(form, args)


def is_req_args_proxy(data: Any) -> bool:
    return isinstance(data, RequestArgsProxy) or isinstance(data, JSONRequestArgsProxy)
