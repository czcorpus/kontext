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


import time
from dataclasses import asdict, dataclass, field
from typing import Any, ClassVar, Dict, Optional


@dataclass
class AsyncTaskStatus:
    """
    Keeps information about background tasks which are visible to a user
    (i.e. user is informed that some calculation/task takes a long time
    and that it is going to run in background and that the user will
    be notified once it is done).

    Please note that concordance calculation uses a different mechanism
    as it requires continuous update of its status.

    """
    CATEGORY_SUBCORPUS: ClassVar[str] = 'subcorpus'
    CATEGORY_PQUERY: ClassVar[str] = 'pquery'
    CATEGORY_FREQ_PRECALC: ClassVar[str] = 'freqPrecalc'
    CATEGORY_WORDLIST: ClassVar[str] = 'wordlist'
    CATEGORY_KWORDS: ClassVar[str] = 'kwords'

    ident: str
    "task identifier (unique per specific task instance)"

    label: str
    "user-readable task label"

    status: str
    "(taken from Celery), one of: PENDING, STARTED, RETRY, FAILURE, SUCCESS"

    category: str
    args: Dict[str, Any] = field(default_factory=dict)
    created: float = field(default_factory=lambda: time.time())
    error: Optional[str] = None
    url: Optional[str] = None
    auto_redirect: Optional[bool] = None

    def is_finished(self) -> bool:
        return self.status in ('FAILURE', 'SUCCESS')

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'AsyncTaskStatus':
        """
        Creates an instance from the 'dict' type. This is used
        to unserialize instances from session.
        """
        return AsyncTaskStatus(**data)

    def to_dict(self) -> Dict[str, Any]:
        """
        Transforms an instance to the 'dict' type. This is used
        to serialize instances to session.
        """
        return asdict(self)

    def __eq__(self, __o: 'AsyncTaskStatus') -> bool:
        if self.ident != __o.ident:
            raise TypeError('Comparing tasks with different IDs')
        return self.label == __o.label and self.status == __o.status and self.error == __o.error and self.url == __o.url
