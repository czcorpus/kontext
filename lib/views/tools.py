# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

from io import BytesIO
from typing import Tuple

from action.control import http_action
from action.errors import UserReadableException
from action.krequest import KRequest
from action.model.base import BaseActionModel
from action.response import KResponse
from cairosvg import svg2pdf, svg2png, svg2svg
from lxml import etree
from sanic import Blueprint

bp = Blueprint('tools', url_prefix='tools')


def _parse_viewbox(vb: str) -> Tuple[float, float, float, float]:
    items = [float(v) for v in vb.split(' ')]
    try:
        return items[0], items[1], items[2], items[3]
    except IndexError:
        raise UserReadableException(f'Invalid SVG viewBox: {vb}', code=422)


def _normalize_bar_chart_svg(src: bytes, vert_bar_chart_max_label: int):
    doc = etree.parse(BytesIO(src))
    g_list = doc.findall('./{http://www.w3.org/2000/svg}g')
    svg_root = doc.getroot()
    svg_root.attrib['width'] = '100%'
    svg_root.attrib['height'] = '100%'
    x1, y1, x2, y2 = _parse_viewbox(svg_root.attrib['viewBox'])
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


def _normalize_wcloud_svg(src: bytes):
    doc = etree.parse(BytesIO(src))
    g_list = doc.findall('./{http://www.w3.org/2000/svg}g')
    svg_root = doc.getroot()
    svg_root.attrib['width'] = '100%'
    svg_root.attrib['height'] = '100%'
    x1, y1, x2, y2 = _parse_viewbox(svg_root.attrib['viewBox'])
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


@bp.route('/convert_chart_svg', ['POST'])
@http_action(return_type='plain')
async def convert_chart_svg(amodel: BaseActionModel, req: KRequest, resp: KResponse):
    vert_bar_chart_max_label = int(req.args.get('vertBarChartMaxLabel', '10'))
    chart_type = req.args.get('chartType')
    if chart_type in ('bar', 'time', 'timescatter'):
        svg_src = _normalize_bar_chart_svg(req.unwrapped.body, vert_bar_chart_max_label)
    else:
        svg_src = _normalize_wcloud_svg(req.unwrapped.body)
    if req.args.get('outFormat', '') == 'png':
        resp.set_header('Content-Type', 'image/png')
        return svg2png(bytestring=svg_src, output_width=1200, background_color='#FFFFFF')
    elif req.args.get('outFormat', '') == 'png-print':
        resp.set_header('Content-Type', 'image/png')
        return svg2png(bytestring=svg_src, output_width=4961, background_color='#FFFFFF')
    elif req.args.get('outFormat', '') == 'svg':
        resp.set_header('Content-Type', 'image/svg+xml')
        return svg2svg(bytestring=svg_src, scale=5, background_color='#FFFFFF')
    elif req.args.get('outFormat', '') == 'pdf':
        resp.set_header('Content-Type', 'application/pdf')
        return svg2pdf(bytestring=svg_src, scale=5, background_color='#FFFFFF')
    else:
        raise UserReadableException('Invalid data format', code=422)
