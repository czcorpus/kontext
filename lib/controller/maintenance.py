# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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


class MaintenanceController(object):

    def __init__(self, request, ui_lang):
        self.request = request

    def run(self, *args):
        status = '503 Service Unavailable'
        headers = [('Content-Type', 'text/html')]
        body = '<html><body><h1>503 Service Unavailable</h1></body></html>'
        return status, headers, True, body
