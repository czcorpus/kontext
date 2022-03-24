# Copyright (c) 2015 Institute of the Czech National Corpus
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

import time
import logging
from sanic import Blueprint

from action.errors import UserActionException, ImmediateRedirectException
from action.model.authorized import UserActionModel
from action.decorators import http_action
import plugins
from plugin_types.auth import SignUpNeedsUpdateException
import settings

bp = Blueprint('user', url_prefix='user')


@bp.route('/loginx', methods=['GET'])
@http_action(template='user/login.html', action_model=UserActionModel)
async def loginx(amodel, req, resp):
    """
    This method is used by some of the installations with Shibboleth-based authentication.
    So for compatibility reasons, let's keep this.
    """
    with plugins.runtime.AUTH as auth:
        req.ctx.session['user'] = await auth.validate_user(amodel.plugin_ctx, None, None)
    if req.args.get('return_url', None):
        amodel.redirect(req.args.get('return_url'))
    return {}


@bp.route('/login', methods=['POST'])
@http_action(template='user/login.html', action_model=UserActionModel)
async def login(amodel, req, resp):
    amodel.disabled_menu_items = amodel.USER_ACTIONS_DISABLED_ITEMS
    with plugins.runtime.AUTH as auth:
        ans = {}
        req.ctx.session['user'] = await auth.validate_user(
            amodel.plugin_ctx, req.form.get('username'), req.form.get('password'))
        if not auth.is_anonymous(req.session['user'].get('id', None)):
            if req.args.get('return_url', None):
                resp.redirect(req.args.get('return_url'))
            else:
                resp.redirect(req.create_url('query', {}))
        else:
            amodel.disabled_menu_items = amodel.USER_ACTIONS_DISABLED_ITEMS
            amodel.add_system_message('error', req.translate('Incorrect username or password'))
        amodel.refresh_session_id()
        return ans


@bp.route('/logoutx', methods=['POST'])
@http_action(
    access_level=1, template='user/login.html', page_model='login', action_model=UserActionModel)
async def logoutx(amodel, req, resp):
    amodel.disabled_menu_items = amodel.USER_ACTIONS_DISABLED_ITEMS
    plugins.runtime.AUTH.instance.logout(req.session)
    amodel.init_session()
    amodel.refresh_session_id()
    plugins.runtime.AUTH.instance.logout_hook(amodel.plugin_ctx)
    resp.redirect(req.create_url('query', {}))
    return {}


@bp.route('/sign_up_form')
@http_action(
    access_level=0, template='user/administration.html', page_model='userSignUp',
    action_model=UserActionModel)
async def sign_up_form(amodel, req, resp):
    ans = dict(credentials_form={}, username_taken=False, user_registered=False)
    with plugins.runtime.AUTH as auth:
        token_key = req.args.get('key')
        username_taken = bool(int(req.args.get('username_taken', '0')))
        if token_key:
            credentials = auth.get_form_props_from_token(token_key)
            if not credentials:
                raise UserActionException('Invalid confirmation token')
            del credentials['password']
            ans['credentials_form'] = credentials
            ans['username_taken'] = username_taken
        if not amodel.user_is_anonymous():
            raise UserActionException('You are already registered')
        else:
            ans['user'] = dict(username=None)
    return ans


@bp.route('/sign_up', methods=['POST'])
@http_action(
    access_level=0, return_type='json', action_model=UserActionModel)
async def sign_up(amodel, req, resp):
    with plugins.runtime.AUTH as auth:
        errors = await auth.sign_up_user(amodel.plugin_ctx, dict(
            username=req.form.get('username'),
            firstname=req.form.get('firstname'),
            lastname=req.form.get('lastname'),
            affiliation=req.form.get('affiliation'),
            email=req.form.get('email'),
            password=req.form.get('password'),
            password2=req.form.get('password2')
        ))
    if len(errors) == 0:
        return dict(ok=True, error_args={})
    else:
        raise UserActionException(req.translate('Failed to sign up user'), error_args=errors)


@bp.route('/test_username')
@http_action(access_level=0, return_type='json', action_model=UserActionModel)
async def test_username(amodel, req, resp):
    with plugins.runtime.AUTH as auth:
        available, valid = await auth.validate_new_username(
            amodel.plugin_ctx, req.args.get('username'))
        return dict(available=available if available and valid else False, valid=valid)


@bp.route('/sign_up_confirm_email')
@http_action(
    access_level=0, template='user/token_confirm.html', page_model='userTokenConfirm', action_model=UserActionModel)
async def sign_up_confirm_email(self, request):
    with plugins.runtime.AUTH as auth:
        try:
            key = request.args.get('key')
            ans = dict(sign_up_url=self.create_url('user/sign_up_form', {}))
            ans.update(await auth.sign_up_confirm(self._plugin_ctx, key))
            return ans
        except SignUpNeedsUpdateException as ex:
            logging.getLogger(__name__).warning(ex)
            raise ImmediateRedirectException(self.create_url('user/sign_up_form',
                                                             dict(key=key, username_taken=1)))


@bp.route('/set_user_password', methods=['POST'])
@http_action(
    access_level=1, return_type='json', action_model=UserActionModel)
async def set_user_password(amodel, req, resp):
    with plugins.runtime.AUTH as auth:
        curr_passwd = req.form.get('curr_passwd')
        new_passwd = req.form.get('new_passwd')
        new_passwd2 = req.form.get('new_passwd2')
        fields = dict(curr_passwd=True, new_passwd=True, new_passwd2=True)
        ans = dict(fields=fields, messages=[])

        if not amodel.uses_internal_user_pages():
            raise UserActionException(req.translate('This function is disabled.'))
        logged_in = await auth.validate_user(
            amodel.plugin_ctx, req.session_get('user', 'user'), curr_passwd)

        if amodel.is_anonymous_id(logged_in['id']):
            fields['curr_passwd'] = False
            ans['messages'].append(req.translate('Invalid user or password'))
            return ans

        if new_passwd != new_passwd2:
            fields['new_passwd'] = False
            fields['new_passwd2'] = False
            ans['messages'].append(req.translate('New password and its confirmation do not match.'))
            return ans

        if not auth.validate_new_password(new_passwd):
            ans['messages'].append(auth.get_required_password_properties(amodel.plugin_ctx))
            fields['new_passwd'] = False
            fields['new_passwd2'] = False
            return ans

        await auth.update_user_password(amodel.plugin_ctx, req.session_get('user', 'id'), new_passwd)
        return ans


async def _load_query_history(
        amodel: UserActionModel, user_id, offset, limit, from_date, to_date, q_supertype, corpname, archived_only):
    if plugins.runtime.QUERY_HISTORY.exists:
        with plugins.runtime.QUERY_HISTORY as qh:
            rows = await qh.get_user_queries(
                user_id,
                amodel.cm,
                offset=offset, limit=limit,
                q_supertype=q_supertype, corpname=corpname,
                from_date=from_date, to_date=to_date,
                archived_only=archived_only,
                translate=amodel.plugin_ctx.translate)
    else:
        rows = ()
    return rows


@bp.route('/ajax_query_history')
@http_action(access_level=1, return_type='json', action_model=UserActionModel)
async def ajax_query_history(amodel, req, resp):
    offset = int(req.args.get('offset', '0'))
    limit = int(req.args.get('limit'))
    query_supertype = req.args.get('query_supertype')
    corpname = req.args.get('corpname', None)
    archived_only = bool(int(req.args.get('archived_only', '0')))
    rows = await _load_query_history(
        amodel=amodel, q_supertype=query_supertype, corpname=corpname, from_date=None,
        user_id=req.session_get('user', 'id'), to_date=None, archived_only=archived_only, offset=offset,
        limit=limit)
    return dict(
        data=rows,
        from_date=None,
        to_date=None,
        offset=offset,
        limit=limit
    )


@bp.route('/ajax_get_toolbar')
@http_action(return_type='template', action_model=UserActionModel)
async def ajax_get_toolbar(amodel, req, resp):
    with plugins.runtime.APPLICATION_BAR as ab:
        return await ab.get_contents(plugin_ctx=amodel.plugin_ctx, return_url=amodel.return_url)


@bp.route('/ajax_user_info')
@http_action(return_type='json', action_model=UserActionModel)
async def ajax_user_info(amodel, req, resp):
    with plugins.runtime.AUTH as auth:
        user_info = await auth.get_user_info(amodel.plugin_ctx)
        if not amodel.user_is_anonymous():
            return {'user': user_info}
        else:
            return {'user': {'username': user_info['username']}}


@bp.route('/profile')
@http_action(
    return_type='template', template='user/administration.html', page_model='userProfile',
    access_level=1, action_model=UserActionModel)
async def profile(amodel, req, resp):
    if not amodel.uses_internal_user_pages():
        raise UserActionException(req.translate('This function is disabled.'))
    with plugins.runtime.AUTH as auth:
        user_info = await auth.get_user_info(amodel.plugin_ctx)
        if not amodel.user_is_anonymous():
            return dict(credentials_form=user_info, user_registered=True)
        else:
            return dict(credentials_form=dict(username=user_info['username']), user_registered=False)


@bp.route('/switch_language', methods=['POST'])
@http_action(access_level=0, return_type='plain', action_model=UserActionModel)
async def switch_language(amodel, req, resp):
    path_prefix = settings.get_str('global', 'action_path_prefix')
    resp.set_cookie(
        'kontext_ui_lang',
        req.form.get('language'),
        path=path_prefix if path_prefix else '/',
        expires=time.strftime('%a, %d %b %Y %T GMT', time.gmtime(time.time() + 180 * 24 * 3600)))
    resp.redirect(
        req.headers.get('referer', req.create_url('query', []))
    )
    return None
