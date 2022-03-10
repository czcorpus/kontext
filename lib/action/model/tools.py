import os
from sanic import Sanic
import settings
from translation import ugettext


def apply_theme(data, app: Sanic, public_files_path: str):
    theme_name = settings.get('theme', 'name')
    logo_img = settings.get('theme', 'logo')
    if settings.contains('theme', 'logo_mouseover'):
        logo_alt_img = settings.get('theme', 'logo_mouseover')
    else:
        logo_alt_img = logo_img

    if settings.contains('theme', 'logo_href'):
        logo_href = str(settings.get('theme', 'logo_href'))
    else:
        logo_href = app.url_for('root.root_action')

    if theme_name == 'default':
        logo_title = ugettext('Click to enter a new query')
    else:
        logo_title = str(logo_href)

    theme_favicon = settings.get('theme', 'favicon', None)
    theme_favicon_type = settings.get('theme', 'favicon_type', None)
    if (theme_favicon and not (theme_favicon.startswith('/') or theme_favicon.startswith('http://') or
                               theme_favicon.startswith('https://'))):
        theme_favicon = os.path.join(public_files_path, theme_name, theme_favicon)

    data['theme'] = dict(
        name=settings.get('theme', 'name'),
        logo_path=os.path.normpath(os.path.join(
            public_files_path, 'themes', theme_name, logo_img)),
        logo_mouseover_path=os.path.normpath(os.path.join(
            public_files_path, 'themes', theme_name, logo_alt_img)),
        logo_href=logo_href,
        logo_title=logo_title,
        logo_inline_css=settings.get('theme', 'logo_inline_css', ''),
        online_fonts=settings.get_list('theme', 'fonts'),
        favicon=theme_favicon,
        favicon_type=theme_favicon_type
    )