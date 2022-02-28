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


from typing import Dict, Any, Optional, ClassVar
import time
from dataclasses import dataclass, field, asdict


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