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


def normalize_bar_chart_svg(src: bytes, vert_bar_chart_max_label: int):
    doc = etree.parse(BytesIO(src))
    g_list = doc.findall('./{http://www.w3.org/2000/svg}g')
    svg_root = doc.getroot()
    svg_root.attrib['width'] = '100%'
    svg_root.attrib['height'] = '100%'
    x1, y1, x2, y2 = parse_viewbox(svg_root.attrib['viewBox'])
    x_corr = round(vert_bar_chart_max_label * 1.1)
    new_x2 = x2 + 40 + x_corr
    new_y2 = y2 + 40
    svg_root.attrib['viewBox'] = f'{x1} {y1} {new_x2} {new_y2}'
    root_g = etree.SubElement(doc.getroot(), 'g')
    root_g.attrib['fill'] = '#ffffff'
    root_g.attrib['transform'] = f'translate({20 + x_corr}, 20)'
    for item in g_list:
        item.getparent().remove(item)
        root_g.append(item)
    return etree.tostring(doc.getroot())


def normalize_wcloud_svg(src: bytes):
    doc = etree.parse(BytesIO(src))
    g_list = doc.findall('./{http://www.w3.org/2000/svg}g')
    svg_root = doc.getroot()
    svg_root.attrib['width'] = '100%'
    svg_root.attrib['height'] = '100%'
    x1, y1, x2, y2 = parse_viewbox(svg_root.attrib['viewBox'])
    new_x2 = x2 + 20
    new_y2 = y2 + 20
    svg_root.attrib['viewBox'] = f'{x1} {y1} {new_x2} {new_y2}'
    root_g = etree.SubElement(doc.getroot(), 'g')
    root_g.attrib['fill'] = '#ffffff'
    root_g.attrib['transform'] = 'translate(10, 10)'
    for item in g_list:
        item.getparent().remove(item)
        root_g.append(item)
    return etree.tostring(doc.getroot())


class Tools(Kontext):

    def get_mapping_url_prefix(self) -> str:
        return '/tools/'

    @exposed(return_type='plain', http_method='POST', skip_corpus_init=True)
    def convert_chart_svg(self, request: Request):
        vert_bar_chart_max_label = int(request.args.get('vertBarChartMaxLabel', '10'))
        chart_type = request.args.get('chartType')
        if chart_type in ('bar', 'time', 'timescatter'):
            svg_src = normalize_bar_chart_svg(request.get_data(), vert_bar_chart_max_label)
        else:
            svg_src = normalize_wcloud_svg(request.get_data())
        if request.args.get('outFormat', '') == 'png':
            self._response.set_header('Content-Type', 'image/png')
            return svg2png(bytestring=svg_src, scale=6, background_color='#FFFFFF')
        elif request.args.get('outFormat', '') == 'svg':
            self._response.set_header('Content-Type', 'image/svg+xml')
            return svg2svg(bytestring=svg_src, scale=6, background_color='#FFFFFF')
        else:
            raise UserActionException('Invalid data format', code=422)


