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

from plugins.abstract.query_suggest import AbstractFrontend, Response
from typing import Any, Dict


class ErrorFrontend(AbstractFrontend):

    def __init__(self, conf):
        super().__init__(conf, 'error')

    def export_data(self, data, value, ui_lang):
        response = super().export_data(data, value, ui_lang)
        response.contents = data
        return response


class BasicFrontend(AbstractFrontend):

    def __init__(self, conf):
        super().__init__(conf, 'basic')
        self.on_item_click = conf.get('onItemClick', None)

    def export_data(self, data, value, ui_lang):
        response = super().export_data(data, value, ui_lang)
        response.contents = data
        return response


class PosAttrPairRelFrontend(AbstractFrontend):

    MAX_ATTR2_VARIANTS = 30

    def __init__(self, conf):
        super().__init__(conf, 'posAttrPairRel')
        self.on_item_click = conf.get('onItemClick', None)
        self.is_active = True

    @property
    def custom_conf(self):
        conf_out = dict(self._conf)
        for k in list(conf_out.keys()):
            # prevent showing sensitive information (passwords in URL etc.)
            if 'server' in k:
                del conf_out[k]
        return conf_out

    def export_data(self, data: Dict[str, Any], value, ui_lang):
        data_norm = data['data']
        value_indirect = bool(self._conf.get('attr3'))
        for k, att2_variants in data['data'].items():
            data_norm[k] = att2_variants[:self.MAX_ATTR2_VARIANTS]
            if len(att2_variants) > self.MAX_ATTR2_VARIANTS:
                data_norm[k].append(None)
            if value_indirect and self._conf.get('attr3'):
                for v in data_norm[k]:
                    if v == value:
                        value_indirect = False
                        break
        data['data'] = data_norm
        data['value_indirect'] = value_indirect  # value has been found via attribute(s) != attr1, attr2
        response = super().export_data(data_norm, value, ui_lang)
        response.contents = data
        return response
