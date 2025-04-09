# Copyright (c) 2013 Charles University, Faculty of Arts,
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


import os
from typing import Callable

import settings
from sanic import Sanic


def apply_theme(data, app: Sanic, translate: Callable[[str], str]):
    theme_name = settings.get('theme', 'name')
    logo_img = settings.get('theme', 'logo')
    if settings.contains('theme', 'logo_href'):
        logo_href = str(settings.get('theme', 'logo_href'))
    else:
        logo_href = app.url_for('root.root_action')

    if theme_name == 'default':
        logo_title = translate('Click to enter a new query')
    else:
        logo_title = str(logo_href)

    public_files_path = app.config['static_files_prefix']
    theme_favicon = settings.get('theme', 'favicon', None)
    theme_favicon_type = settings.get('theme', 'favicon_type', None)
    if (theme_favicon and not (theme_favicon.startswith('/') or theme_favicon.startswith('http://') or
                               theme_favicon.startswith('https://'))):
        theme_favicon = os.path.join(public_files_path, theme_name, theme_favicon)

    if not logo_img.startswith('http://') and not logo_img.startswith('https://'):
        logo_path = os.path.normpath(os.path.join(public_files_path, 'themes', theme_name, logo_img))
    else:
        logo_path = logo_img

    data['theme'] = dict(
        name=settings.get('theme', 'name'),
        logo_path=logo_path,
        logo_href=logo_href,
        logo_title=logo_title,
        logo_inline_css=settings.get('theme', 'logo_inline_css', ''),
        online_fonts=settings.get_list('theme', 'fonts'),
        favicon=theme_favicon,
        favicon_type=theme_favicon_type,
        main_background=os.path.join(public_files_path, 'img/groovepaper2.jpg'),
        color_default_text='#010101',
        color_light_text='#8d8c8c',
        color_default_green='#D1ECBF',
    )
