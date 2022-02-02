# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

from werkzeug import Request
from cairosvg import svg2png, svg2svg

from controller import exposed
from controller.errors import UserActionException
from controller.kontext import Kontext


class Tools(Kontext):

    def get_mapping_url_prefix(self) -> str:
        return '/tools/'

    @exposed(return_type='plain', http_method='POST', skip_corpus_init=True)
    def convert_svg(self, request: Request):
        if request.args.get('outFormat', '') == 'png':
            self._response.set_header('Content-Type', 'image/png')
            return svg2png(bytestring=request.get_data(), scale=6, background_color='#FFFFFF')
        elif request.args.get('outFormat', '') == 'svg':
            self._response.set_header('Content-Type', 'image/svg+xml')
            return svg2svg(bytestring=request.get_data(), scale=6, background_color='#FFFFFF')
        else:
            raise UserActionException('Invalid data format', code=422)


