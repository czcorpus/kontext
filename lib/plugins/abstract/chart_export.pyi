# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
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

import abc
from typing import List, Tuple

class UnknownFormatException(Exception): ...

class AbstractChartExport(abc.ABC):

    def get_content_type(self) -> str: ...

    def get_format_name(self) -> str: ...

    def get_suffix(self) -> str: ...

    def export_pie_chart(self, data:List[Tuple[str, float]], title:str) -> str: ...


class AbstractChartExportPlugin(abc.ABC):

    def get_supported_types(self) -> List[str]: ...

    def get_content_type(self, format:str) -> str: ...

    def get_suffix(self, format:str) -> str: ...

    def export_pie_chart(self, data:List[Tuple[str, float]], title:str, format:str) -> str: ...
