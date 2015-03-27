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

import os
import logging

from controller import exposed
from kontext import Kontext, ConcError, MainMenu, UserActionException
from translation import ugettext as _
import plugins
import l10n
from l10n import export_string, import_string, format_number
import corplib


class Admin(Kontext):

    def __init__(self, request, ui_lang):
        super(Admin, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/admin/'

    @exposed(template='stats.tmpl')
    def stats(self, request):

        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        min_occur = request.args.get('min_occur')

        if plugins.auth.is_administrator(self._session_get('user', 'id')):
            import system_stats

            data = system_stats.load(settings.get('global', 'log_path'), from_date=from_date,
                                     to_date=to_date, min_occur=min_occur)
            maxmin = {}
            for label, section in data.items():
                maxmin[label] = system_stats.get_max_min(section)

            out = {
                'stats': data,
                'minmax': maxmin,
                'from_date': from_date,
                'to_date': to_date,
                'min_occur': min_occur
            }
        else:
            out = {'message': ('error', _('You don\'t have enough privileges to see this page.'))}
        return out