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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import json
from plugins.abstract.token_connect import AbstractFrontend


class VallexFrontend(AbstractFrontend):

    def __init__(self, conf):
        super(VallexFrontend, self).__init__(conf)

    def export_data(self, data, status, lang, is_kwic_view):
        response = super(VallexFrontend, self).export_data(data, status, lang)
        response.renderer = 'vallex-json'
        response.contents = json.loads(data.strip().strip('<pre>').strip('</pre>'))
        return response

class PDTVallexFrontend(AbstractFrontend):

    def __init__(self, conf):
        super(PDTVallexFrontend, self).__init__(conf)

    def export_data(self, data, status, lang, is_kwic_view):
        response = super(PDTVallexFrontend, self).export_data(data, status, lang, is_kwic_view)
        response.renderer = 'pdt-vallex-json'
        response.contents = json.loads(data.strip().strip('<pre>').strip('</pre>'))
        return response

class ENGVallexFrontend(AbstractFrontend):

    def __init__(self, conf):
        super(ENGVallexFrontend, self).__init__(conf)

    def export_data(self, data, status, lang, is_kwic_view):
        response = super(ENGVallexFrontend, self).export_data(data, status, lang, is_kwic_view)
        response.renderer = 'eng-vallex-json'
        response.contents = json.loads(data.strip().strip('<pre>').strip('</pre>'))
        return response
