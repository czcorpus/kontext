import os
import settings
from sanic import Sanic
from sanic.request import Request
from translation import ugettext


def _apply_theme(data, app: Sanic, public_files_path: str):
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


def add_globals(app: Sanic, request: Request, page_model: str, result):
    result['page_model'] = page_model
    result['active_plugins'] = []
    result['user_id'] = None
    result['locale'] = None
    result['uiLang'] = None  # what about 'locale' above?
    result['is_local_ui_lang'] = True  # TODO
    result['first_day_of_week'] = None
    result['plugin_data'] = {}
    result['messages'] = []
    result['popup_server_messages'] = []
    result['menu_data'] = {}
    result['async_tasks'] = []
    result['_version'] = (0, 0, 0)
    result['Wposlist'] = []
    result['conc_forms_args'] = {}
    result['SubcorpList'] = []
    result['default_attr'] = None
    result['input_languages'] = None
    result['AlignCommonPosAttrs'] = []
    result['text_types_data'] = None
    result['text_types_notes'] = None
    result['StructAttrList'] = []
    result['StructList'] = []
    result['default_virt_keyboard'] = None
    result['simple_query_default_attrs'] = []
    result['qs_enabled'] = False
    result['job_status_service_url'] = None
    result['use_conc_toolbar'] = None
    result['shuffle_min_result_warning'] = None
    result['multilevel_freq_dist_max_levels'] = None
    result['can_send_mail'] = False
    result['issue_reporting_action'] = None
    result['help_links'] = []
    public_files_path = settings.get('global', 'static_files_prefix', '../files')
    result['files_path'] = public_files_path
    result['corpus_ident'] = None
    result['base_attr'] = None
    result['current_action'] = None
    result['anonymous_user_conc_login_prompt'] = None
    result['explicit_conc_persistence_ui'] = None
    result['user_info'] = request.ctx.user_info
    result['login_url'] = None
    result['logout_url'] = None
    result['root_url'] = app.url_for('root.root_action')
    result['Globals'] = None
    result['conc_url_ttl_days'] = None
    _apply_theme(result, app, public_files_path)
    return result
