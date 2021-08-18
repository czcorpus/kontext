# Copyright (c) 2017 Charles University, Faculty of Arts,
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

from typing import Dict, Any, Union, TypeVar, Generic

T = TypeVar('T')


class ConcFormArgs(Generic[T]):
    """
    A helper class to handle miscellaneous
    concordance-related forms (filter, query, sort,...).

    It is also used to store/restore data via
    conc. persistence plug-in. Perstitent form can
    be tested using `is_persistent` property.
    """

    def __init__(self, persist: bool) -> None:
        self._persistent = persist
        self._op_key = '__new__'
        self.data: T = None

    def updated(self, attrs: Dict[str, Any], op_key: str) -> 'ConcFormArgs[T]':
        """
        Return an updated self object
        (the same instance). There must
        be always the 'op_key' value
        present to emphasize the fact
        that only serialized data (i.e.
        data with their database key)
        can be used to update an 'unbound'
        instance.
        """
        for k, v in attrs.items():
            if hasattr(self.data, k):
                setattr(self.data, k, v)
        self._op_key = op_key
        return self

    def to_dict(self) -> Dict[str, Any]:
        tmp = self.data.to_dict() if self.data else {}
        if not self.is_persistent:
            tmp['op_key'] = self._op_key
        return tmp

    def serialize(self) -> Dict[str, Any]:
        """
        Export data required to be saved. In case there
        are some corpus-dependent and fixed data (e.g. list of PoS),
        it can be omitted here and re-initialized in __init__
        from user-independent data. By default - all the
        object's attributes are exported.
        """
        return self.to_dict()

    @property
    def is_persistent(self) -> bool:
        return self._persistent

    @property
    def op_key(self) -> str:
        """
        op_key property has a special status as
        it is kept separate from other attributes
        and is exported only if an instance is
        persistent (= loaded from database). I.e.
        newly created objects (where op_key == '__new__')
        should not export it.
        """
        return self._op_key

    def make_saveable(self):
        self._op_key = '__new__'
        self._persistent = True

    def validate(self) -> Union[Exception, None]:
        return None

    @property
    def form_type(self):
        return self.data.form_type
