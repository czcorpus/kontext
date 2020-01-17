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


class UnknownFormatException(Exception):
    pass


class AbstractChartExport(abc.ABC):
    """
    AbstractChartExport represents a single
    format export (e.g. PDF, Excel).
    """

    @abc.abstractmethod
    def get_content_type(self) -> str:
        """
        return a content type identifier (e.g. 'application/json')
        """

    @abc.abstractmethod
    def get_format_name(self) -> str:
        """
        Return a format identifier. It should be both
        human-readable and unique within a single plug-in
        installation. It means that in case of mixing of
        different AbstractChartExport implementations
        it may be necessary to modify some names to
        keep all the export functions available.
        """

    @abc.abstractmethod
    def get_suffix(self) -> str:
        """
        Return a proper file suffix (e.g. 'xlsx' for Excel).
        """

    @abc.abstractmethod
    def export_pie_chart(self, data: List[Tuple[str, float]], title: str) -> str:
        """
        Generate a PIE chart based on passed data and title.

        The method is expected to return raw file data ready
        to be downloaded by a client.
        """


class AbstractChartExportPlugin(abc.ABC):
    """
    AbstractChartExportPlugin represents plug-in itself
    which is expected to contain one or more implementations
    of AbstractChartExport.
    """

    def get_supported_types(self) -> List[str]:
        """
        Return a list of supported format names
        (i.e. the values returned by AbstractChartExport.get_format_name()
        of all the installed export classes).
        """
        return []

    @abc.abstractmethod
    def get_content_type(self, format: str) -> str:
        """
        Return a content type for a specified format
        (e.g. 'PDF' -> 'application/pdf')

        arguments:
        format -- format name (AbstractChartExport.get_format_name())
        """

    @abc.abstractmethod
    def get_suffix(self, format: str) -> str:
        """
        Return a suffix for a specified format.

        arguments:
        format -- format name (AbstractChartExport.get_format_name())
        """

    @abc.abstractmethod
    def export_pie_chart(self, data: List[Tuple[str, float]], title: str, format: str) -> str:
        """
        Export PIE chart data to a PIE chart of
        a specified format.

        arguments:
        data -- chart data
        title -- chart label
        format -- format name (AbstractChartExport.get_format_name())
        """
