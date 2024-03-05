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

from typing import Any, Dict, Generic, Optional, TypeVar
import abc


class AbstractRawQueryDecoder:

    @abc.abstractmethod
    def from_raw_query(self, q: str, corpname: str) -> 'AbstractRawQueryDecoder':
        """
        Decode raw Manatee operation (including first character
        representing an operation identifier).
        """
        pass


T = TypeVar('T', bound=AbstractRawQueryDecoder)


class ConcFormArgs(Generic[T]):
    """
    A helper class to handle serialization and
    deserialization of concordance-related forms
    (query, filter, sort,...).
    The actual form data (= the 'data' property)
    are expected to be represented by a data class.

    """

    def __init__(self, persist: bool) -> None:
        self._persistent = persist
        self._op_key = '__new__'
        self._author_id = None
        self.data: T = None

    def __repr__(self):
        return f'<{self.__class__.__name__}{{ _op_key: {self._op_key}, _persistent: {self._persistent} }}>'

    def updated(self, attrs: Dict[str, Any], op_key: str, author_id: int) -> 'ConcFormArgs[T]':
        """
        Return an updated self object (the same instance). There must
        be always the 'op_key' value present to emphasize the fact
        that only serialized data (i.e. data with their database key)
        can be used to update an 'unbound' instance.
        """
        for k, v in attrs.items():
            if hasattr(self.data, k):
                setattr(self.data, k, v)
        self._op_key = op_key
        self._author_id = author_id
        return self

    def from_raw_query(self, q: str, corpname: str) -> 'ConcFormArgs[T]':
        """
        Return an updated self object (the same instance) with data imported
        from a "raw Manatee query" (e.g. stuff like 'sword/ 0 word/ir -1<0 tag/r -2<0'
        (sorting) or 'p-1 -1 -1 [word="drug"]' (filter)).

        This is mostly used along with URL actions create_view, create_lazy_view
        which allows building multistep queries directly using a single request.
        """
        self.data = self.data.from_raw_query(q, corpname)
        return self

    def to_dict(self) -> Dict[str, Any]:
        tmp = self.data.to_dict() if self.data else {}
        if not self.is_persistent:
            tmp['op_key'] = self._op_key
        return tmp

    def serialize(self) -> Dict[str, Any]:
        """
        Export data required to be saved. In case there
        are some per-corpus constant data (e.g. list of PoS),
        they can be omitted here and re-attached back in __init__
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

    @property
    def author_id(self) -> int:
        """
        Author here is the one who created the query first. We don't have
        to care much about access privileges as stored queries are immutable.
        But sometimes we e.g. need to distinguish anonymous author
        and registered one.
        """
        return self._author_id

    def make_saveable(self):
        self._op_key = '__new__'
        self._persistent = True

    def validate(self) -> Optional[Exception]:
        return None

    @property
    def form_type(self):
        return self.data.form_type
