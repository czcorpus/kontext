# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

from dataclasses import dataclass
from texttypes.cache import TextTypesCache
from typing import Dict, Any


@dataclass
class ModelsSharedData:
    """
    ModelsSharedData is a type for initializing action models with data
    shared by different application pieces.

    Args:
        tt_cache - a text type values cache storing all the different structural
            attributes and their respective values
        plg_shared - a dictionary storing miscellaneous data stored by some plug-ins
            and read by other ones (e.g. an auth plug-in fetches also some data for
            a toolbar plug-in in one request - so we store it and the toolbar plug-in
            can just read it from memory
    """

    tt_cache: TextTypesCache

    plg_shared: Dict[str, Any]
