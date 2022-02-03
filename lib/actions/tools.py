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
from lxml import etree
from io import BytesIO
from typing import Tuple

from controller import exposed
from controller.errors import UserActionException
from controller.kontext import Kontext


def parse_viewbox(vb: str) -> Tuple[int, int, int, int]:
    items = [int(v) for v in vb.split(' ')]
    try:
        return items[0], items[1], items[2], items[3]
    except IndexError:
        raise UserActionException(f'Invalid SVG viewBox: {vb}', code=422)


def normalize_viewbox(vb: Tuple[int, int, int, int]) -> str:
    return f'{vb[0]} {vb[1]} {vb[2]+80} {vb[3]+40}'


def normalize_svg(src: bytes):
    doc = etree.parse(BytesIO(src))
    g_list = doc.findall('./{http://www.w3.org/2000/svg}g')
    svg_root = doc.getroot()
    svg_root.attrib['width'] = '100%'
    svg_root.attrib['height'] = '100%'
    x1, y1, x2, y2 = parse_viewbox(svg_root.attrib['viewBox'])
    svg_root.attrib['viewBox'] = normalize_viewbox((x1, y1, x2, y2))
    root_g = etree.SubElement(doc.getroot(), 'g')
    root_g.attrib['fill'] = '#ffffff'
    root_g.attrib['transform'] = 'translate(40, 20)'
    for item in g_list:
        item.getparent().remove(item)
        root_g.append(item)
    return etree.tostring(doc.getroot())


class Tools(Kontext):

    def get_mapping_url_prefix(self) -> str:
        return '/tools/'

    @exposed(return_type='plain', http_method='POST', skip_corpus_init=True)
    def convert_svg(self, request: Request):
        svg_src = normalize_svg(request.get_data())
        if request.args.get('outFormat', '') == 'png':
            self._response.set_header('Content-Type', 'image/png')
            return svg2png(bytestring=svg_src, scale=6, background_color='#FFFFFF')
        elif request.args.get('outFormat', '') == 'svg':
            self._response.set_header('Content-Type', 'image/svg+xml')
            return svg2svg(bytestring=svg_src, scale=6, background_color='#FFFFFF')
        else:
            raise UserActionException('Invalid data format', code=422)


