# Copyright (c) 2003-2011  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Vit Baisa
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

"""
KonText controller and related auxiliary objects
"""

from typing import Dict, List, Tuple, Callable, Any, Union, Optional, TYPE_CHECKING, TypeVar
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from .plg import PluginApi

import os
from xml.sax.saxutils import escape
from urllib.parse import unquote, quote
import json
import logging
import time
import re
from functools import partial
import types
import hashlib
import uuid
import jinja2
import attr

import werkzeug.urls
import werkzeug.http
import werkzeug.exceptions

from translation import ugettext
import l10n
import strings
import plugins
import settings
from translation import ugettext as translate
from .req_args import RequestArgsProxy
from argmapping import Persistence, Args
from argmapping.func import convert_func_mapping_types
from .errors import (UserActionException, NotFoundException, get_traceback, fetch_exception_msg,
                     CorpusForbiddenException, ImmediateRedirectException)

import werkzeug.wrappers
import http.cookies

T = TypeVar('T')

# this is fix to include `SameSite` as reserved cookie keyword (added in Python 3.8)
http.cookies.Morsel._reserved['samesite'] = ['SameSite']  # type: ignore


def exposed(access_level: int = 0, template: Optional[str] = None, vars: Tuple = (), page_model: Optional[str] = None, func_arg_mapped: bool = False, skip_corpus_init: bool = False,
            mutates_conc: bool = False, http_method: Union[Optional[str], Tuple[str, ...]] = 'GET', accept_kwargs: bool = None, apply_semi_persist_args: bool = False,
            return_type: str = 'template') -> Callable[..., Any]:
    """
    This decorator allows more convenient way how to
    set methods' attributes. Please note that there is
    always an implicit property '__exposed__' set to True.

    arguments:
    access_level -- 0,1,... (0 = public user, 1 = logged in user)
    template -- a Jinja2 template source path
    vars -- deprecated; do not use
    page_model -- a JavaScript page module
    func_arg_mapped -- True/False (False - provide only self.args and request, True: maps URL args to action func args)
    skip_corpus_init -- True/False (if True then all the corpus init. procedures are skipped
    mutates_conc -- store a new conc action under a new key to a conc_peristence db
    http_method -- required HTTP method (POST, GET, PUT,...), either a single string or a tuple of strings
    accept_kwargs -- True/False
    apply_semi_persist_args -- if True hen use session to initialize action args first
    return_type -- {plain, json, template, xml}
    """
    def wrapper(func):
        func.__dict__['access_level'] = access_level
        func.__dict__['template'] = template
        func.__dict__['vars'] = vars
        func.__dict__['page_model'] = page_model
        func.__dict__['func_arg_mapped'] = func_arg_mapped
        func.__dict__['skip_corpus_init'] = skip_corpus_init
        func.__dict__['mutates_conc'] = mutates_conc
        func.__dict__['http_method'] = http_method
        func.__dict__['accept_kwargs'] = accept_kwargs
        func.__dict__['apply_semi_persist_args'] = apply_semi_persist_args
        func.__dict__['return_type'] = return_type
        func.__dict__['__exposed__'] = True
        return func
    return wrapper


def val_to_js(obj):
    return re.sub(r'<(/)?(script|iframe|frame|frameset|embed|img|object)>', r'<" + "\g<1>\g<2>>', json.dumps(obj),
                  flags=re.IGNORECASE)


class KonTextCookie(http.cookies.BaseCookie):
    """
    Cookie handler which encodes and decodes strings
    as URI components.
    """

    def value_decode(self, val):
        return unquote(val), val

    def value_encode(self, val):
        strval = str(val)
        return strval, quote(strval)


@jinja2.contextfilter
def translat_filter(context, s):
    return ugettext(s)


class Controller(object):
    """
    This object serves as a controller of the application. It handles action->method mapping,
    target method processing, result rendering, generates required http headers etc.

    Request processing composes of the following phases:
      1) pre-dispatch (pre_dispatch() method)
      2) validation of registered callbacks (_pre_action_validate() method)
      3) processing of mapped action method
      4) post-dispatch (post_dispatch() method)
      5) building output headers and body
    """
    NO_OPERATION: str = 'nop'

    def __init__(self, request: werkzeug.wrappers.Request, ui_lang: str):
        """
        arguments:
        request -- Werkzeug's request object
        ui_lang -- language used by user
        """
        self._request: werkzeug.wrappers.Request = request
        self.environ: Dict[str, str] = self._request.environ  # for backward compatibility
        self.ui_lang: str = ui_lang
        self._cookies: KonTextCookie = KonTextCookie(self.environ.get('HTTP_COOKIE', ''))
        self._new_cookies: KonTextCookie = KonTextCookie()
        self._headers: Dict[str, str] = {'Content-Type': 'text/html'}
        self._status: int = 200
        self._system_messages: List[Tuple[str, str]] = []
        self._proc_time: Optional[float] = None
        # a list of functions which must pass (= return None) before any action is performed
        self._validators: List[Callable[[], Exception]] = []
        # templating engine
        self._template_dir: str = os.path.realpath(os.path.join(
            os.path.dirname(__file__), '..', '..', 'templates'))
        tpl_cache_path = settings.get('global', 'template_engine_cache_path', None)
        cache = jinja2.FileSystemBytecodeCache(tpl_cache_path) if tpl_cache_path else None
        self._template_env: jinja2.Environment = jinja2.Environment(
            loader=jinja2.FileSystemLoader(searchpath=self._template_dir),
            bytecode_cache=cache,
            trim_blocks=True,
            lstrip_blocks=True)
        self._template_env.filters.update(
            to_json=val_to_js,
            shorten=strings.shorten,
            camelize=l10n.camelize,
            _=translat_filter,
            xmle=escape,
            create_action=lambda a, p=None: self.create_url(a, p if p is not None else {})
        )
        ##
        self.args: Args = Args()
        self._uses_valid_sid: bool = True
        self._plugin_api: Optional[PluginApi] = None  # must be implemented in a descendant

    def init_session(self) -> None:
        """
        Starts/reloads user's web session data. It can be called even
        if there is no 'sessions' plugin installed (in such case, it just
        creates an empty dictionary with some predefined keys to allow other
        parts of the application to operate properly)
        """
        with plugins.runtime.AUTH as auth:
            if auth is None:
                raise RuntimeError('Auth plugin was not initialized')

            if 'user' not in self._session:
                self._session['user'] = auth.anonymous_user()

            if hasattr(auth, 'revalidate'):
                try:
                    auth.revalidate(self._plugin_api)  # type: ignore
                except Exception as ex:
                    self._session['user'] = auth.anonymous_user()
                    logging.getLogger(__name__).error('Revalidation error: %s' % ex)
                    self.add_system_message('error', translate('User authentication error. Please try to reload the page or '
                                                               'contact system administrator.'))

    @property  # for legacy reasons, we have to allow an access to the session via _session property
    def _session(self) -> Dict[str, Any]:
        return self._request.session

    def session_get(self, *nested_keys: str) -> Any:
        """
        This is just a convenience method to retrieve session's nested values:
        E.g. self._session['user']['car']['name'] can be rewritten
        as self.session_get('user', 'car', 'name').
        If no matching keys are found then None is returned.

        Arguments:
        *nested_keys -- keys to access required value
        """
        curr = dict(self._request.session)
        for k in nested_keys:
            if k in curr:
                curr = curr[k]
            else:
                return None
        return curr

    def refresh_session_id(self) -> None:
        """
        This tells the wrapping WSGI app to create a new session with
        the same data as the current session.
        """
        self._uses_valid_sid = False

    def add_validator(self, func: Callable) -> None:
        """
        Adds a function which is run after pre_dispatch but before action processing.
        If the function returns an instance of Exception then Controller raises this value.
        The validation fails on first encountered error (i.e. subsequent validators are not run).
        This is intended for ancestors to inject pre-run checks.

        arguments:
        func -- a callable instance
        """
        self._validators.append(func)

    def add_system_message(self, msg_type: str, text: str) -> None:
        """
        Adds a system message which will be displayed
        to a user. It is possible to add multiple messages
        by repeatedly call this method.

        arguments:
        msg_type -- one of 'message', 'info', 'warning', 'error'
        text -- text of the message
        """
        self._system_messages.append((msg_type, text))

    def _export_status(self) -> str:
        """
        Exports numerical HTTP status into a HTTP header format
        (e.g. 200 -> '200 OK'

        TODO: values not found in the STATUS_MAP should be treated in a better way
        """
        s = werkzeug.http.HTTP_STATUS_CODES.get(self._status, '')
        return '%s  %s' % (self._status, s)

    @property
    def corp_encoding(self) -> str:
        return 'iso-8859-1'

    def add_globals(self, result: Dict[str, Any], methodname: str, action_metadata: Dict[str, Any]) -> None:
        """
        This method is expected to fill-in global values needed by output template
        (e.g. each page contains user name or current corpus).
        It is called after an action is processed but before any output starts.
        """
        result['methodname'] = methodname
        deployment_id = settings.get('global', 'deployment_id', None)
        result['deployment_suff'] = '?_v={0}'.format(hashlib.md5(deployment_id.encode('utf-8')).hexdigest()[
            :6]) if deployment_id else ''
        result['current_action'] = '/'.join([x for x in self.get_current_action() if x])

    def get_current_url(self) -> str:
        """
        Returns an URL representing current application state
        """
        action_str = '/'.join([x for x in self.get_current_action() if x])
        query = '?' + self.environ.get('QUERY_STRING', '')
        return self.get_root_url() + action_str + query

    def updated_current_url(self, params: Dict[str, Any]) -> str:
        """
        Modifies current URL using passed parameters.

        Devel. note: the method must preserve existing non-unique 'keys'
        (because of current app's architecture derived from Bonito2).
        This means parameter list [(k1, v1), (k2, v2),...] cannot be
        converted into a dictionary and then worked on because some
        data would be lost in such case.

        arguments:
        params -- a dictionary containing parameter names and values

        returns:
        updated URL
        """
        import urllib.parse
        import urllib.request
        import urllib.parse
        import urllib.error

        parsed_url = list(urllib.parse.urlparse(self.get_current_url()))
        old_params = dict(urllib.parse.parse_qsl(parsed_url[4]))
        new_params = []
        for k, v in old_params.items():
            if k in params:
                new_params.append((k, params[k]))
            else:
                new_params.append((k, v))

        for k, v in list(params.items()):
            if k not in old_params:
                new_params.append((k, v))

        parsed_url[4] = urllib.parse.urlencode(new_params)
        return urllib.parse.urlunparse(parsed_url)

    def get_current_action(self) -> Tuple[str, str]:
        """
        Returns a 2-tuple where:
        1st item = module name (or an empty string if an implicit one is in use)
        2nd item = action method name
        """
        prefix, action = self.environ.get('PATH_INFO', '').rsplit('/', 1)
        return prefix.rsplit('/', 1)[-1], action

    def get_root_url(self) -> str:
        """
        Returns the root URL of the application (based on environmental variables). All the action module
        path elements and action names are removed. E.g.:
            The app is installed in http://127.0.0.1/app/ and it is currently processing
            http://127.0.0.1/app/user/login then root URL is still http://127.0.0.1/app/

        Please note that KonText always normalizes PATH_INFO environment
        variable to '/' (see public/app.py).
        """
        module, _ = self.environ.get('PATH_INFO', '').rsplit('/', 1)
        module = '%s/' % module
        if module.endswith(self.get_mapping_url_prefix()):
            action_module_path = module[:-len(self.get_mapping_url_prefix())]
        else:
            action_module_path = ''
        if len(action_module_path) > 0:  # => app is not installed in root path (e.g. http://127.0.0.1/app/)
            action_module_path = action_module_path[1:]
        if 'HTTP_X_FORWARDED_PROTO' in self.environ:
            protocol = self.environ['HTTP_X_FORWARDED_PROTO']
        elif 'HTTP_X_FORWARDED_PROTOCOL' in self.environ:
            protocol = self.environ['HTTP_X_FORWARDED_PROTOCOL']
        else:
            protocol = self.environ['wsgi.url_scheme']
        url_items = ('%s://%s' % (protocol, settings.get_str('global', 'http_host',
                                                             self.environ.get('HTTP_HOST'))),
                     settings.get_str('global', 'action_path_prefix', ''),
                     action_module_path)
        return '/'.join([x for x in [x.strip('/') for x in url_items] if bool(x)]) + '/'

    def create_url(self, action: str, params: Union[Dict[str, Union[str, int, float, bool]], List[Tuple[str, Any]]]) -> str:
        """
        Generates URL from provided action identifier and parameters.
        Please note that utf-8 compatible keys and values are expected here
        (i.e. you can pass either pure ASCII values or UTF-8 ones).

        arguments:
        action -- action identification (e.g. 'first_form', 'admin/users')
        params -- a dict-like object containing parameter names and values
        """
        root = self.get_root_url()

        def convert_val(x):
            return x.encode('utf-8') if isinstance(x, str) else str(x)

        if isinstance(params, dict):
            params_str = '&'.join(f'{k}={quote(convert_val(v))}' for k, v in params.items())
        else:
            params_str = '&'.join(f'{k}={quote(convert_val(v))}' for k, v in params)

        if len(params_str) > 0:
            return f'{root}{action}?{params_str}'
        else:
            return f'{root}{action}'

    def _validate_http_method(self, action_metadata: Dict[str, Any]) -> None:
        hm = action_metadata.get('http_method', 'GET')
        if not isinstance(hm, tuple):
            hm = (hm,)
        if self.get_http_method() not in hm:
            raise UserActionException(translate('Unknown action'), code=404)

    def _pre_action_validate(self) -> None:
        """
        Runs defined validators before action itself is performed
        (but after pre_dispatch is run).
        See Controller.add_validator for more info.
        """
        for validator in self._validators:
            err = validator()
            if isinstance(err, UserActionException):
                logging.getLogger(__name__).error(
                    'Pre-action validator {0}: {1}'.format(validator.__name__, err.internal_message))
                raise err
            elif isinstance(err, Exception):
                logging.getLogger(__name__).error(
                    'Pre-action validator {0}: {1}'.format(validator.__name__, err))
                raise err

    @staticmethod
    def _invoke_func_arg_mapped_action(action: Callable, form: RequestArgsProxy):
        """
        Calls an action method (= method with the @exposed annotation) in the
        "bonito" way (i.e. with automatic mapping between request args to target
        method args). Such action must have func_arg_mapped=True meta-information.
        Non-func_arg_mapped actions are called with werkzeug.wrappers.Request instance
        as the first argument.

        arguments:
        action -- name of the action
        named_args -- a dictionary of named args and their defined default values
        """
        if hasattr(action, 'accept_kwargs') and getattr(action, 'accept_kwargs') is True:
            del_nondef = False
        else:
            del_nondef = True
        return action(**convert_func_mapping_types(form.as_dict(), action, del_nondef=del_nondef))

    def _get_method_metadata(self, method_name: str, attr_name: Optional[str] = None) -> Union[Any, Dict[str, Any]]:
        """
        Returns metadata attached to method's __dict__ object. This
        is typically written on a higher level via @exposed annotation.

        arguments:
        method_name -- name of a method
        attr_name -- optional metadata attribute key; if omitted then all the metadata is returned

        returns:
        a dictionary of all metadata or a specific metadata item (which could be anything)
        """
        method_obj = getattr(self, method_name, None)
        if attr_name is not None:
            ans = None
            if method_obj is not None and hasattr(method_obj, attr_name):
                ans = getattr(method_obj, attr_name)
        else:
            ans = {}
            if method_obj is not None:
                ans.update(method_obj.__dict__)
        return ans

    def get_mapping_url_prefix(self) -> str:
        """
        Each action controller must specify a path prefix of PATH_INFO env. variable
        which connects the controller exclusively with matching URLs.

        A leading and a trailing slashes must be always present. Examples of valid prefixes:
        /
        /stats/
        /tools/admin/
        """
        raise NotImplementedError(
            'Each action controller must implement method get_mapping_url_prefix()')

    def _import_req_path(self) -> List[str]:
        """
        Parses PATH_INFO into a list of elements

        returns:
        a list of path elements
        """
        ac_prefix = self.get_mapping_url_prefix()
        path = self.environ.get('PATH_INFO', '').strip()

        if not path.startswith(ac_prefix):  # this should not happen unless you hack the code here and there
            raise Exception(
                'URL-action mapping error: cannot match prefix [%s] with path [%s]' % (path, ac_prefix))
        else:
            path = path[len(ac_prefix):]

        path_split = path.split('/')
        if not path_split or path_split[0] == '':
            path_split = [Controller.NO_OPERATION]
        return path_split

    def redirect(self, url: str, code: int = 303) -> None:
        """
        Sets Controller to output HTTP redirection headers.
        Please note that the method does not interrupt request
        processing, i.e. the redirect is not immediate. In case
        immediate redirect is needed raise ImmediateRedirectException.

        arguments:
        url -- a target URL
        code -- an optional integer HTTP response code (default is 303)
        """
        self._status = code
        if not url.startswith('http://') and not url.startswith('https://') and not url.startswith('/'):
            url = self.get_root_url() + url
        self._headers['Location'] = url

    def set_not_found(self) -> None:
        """
        Sets Controller to output HTTP 404 Not Found response
        """
        if 'Location' in self._headers:
            del self._headers['Location']
        self._status = 404

    def set_forbidden(self):
        if 'Location' in self._headers:
            del self._headers['Location']
        self._status = 403

    def get_http_method(self) -> str:
        return self.environ.get('REQUEST_METHOD', '')

    @staticmethod
    def _get_attrs_by_persistence(persistence_types: Persistence) -> Tuple[str, ...]:
        """
        Returns list of object's attributes which (along with their values) will be preserved.
        A persistent parameter is the one which meets the following properties:
        1. is of the Parameter type
        2. has a matching persistence flag
        """
        def is_valid_parameter(att):
            return att.metadata['persistent'] is persistence_types

        return tuple(att.name for att in attr.fields(Args) if is_valid_parameter(att))

    def _get_items_by_persistence(self, persistence_types: Persistence) -> Dict[str, any]:
        """
        Similar to the _get_persistent_attrs() but returns also values.

        returns:
        a dictionary property_name : value
        """
        ans = {}
        for k in self._get_attrs_by_persistence(persistence_types):
            if hasattr(self.args, k):
                ans[k] = getattr(self.args, k)
        return ans

    def _install_plugin_actions(self) -> None:
        """
        Tests plug-ins whether they provide method 'export_actions' and if so
        then attaches functions they provide to itself (if exported function's required
        controller class matches current instance's one).
        """
        for plg in plugins.runtime:
            if callable(getattr(plg.instance, 'export_actions', None)):
                exported = getattr(plg.instance, 'export_actions')()
                if self.__class__ in exported:
                    for action in exported[self.__class__]:
                        if not hasattr(self, action.__name__):
                            setattr(self, action.__name__, types.MethodType(action, self))
                        else:
                            raise Exception(
                                'Plugins cannot overwrite existing action methods (%s.%s)' % (
                                    self.__class__.__name__, action.__name__))

    def pre_dispatch(self, action_name: str, action_metadata: Optional[Dict[str, Any]] = None) -> RequestArgsProxy:
        """
        Allows specific operations to be performed before the action itself is processed.
        """
        if action_metadata is None:
            action_metadata = {}

        if 'format' in self._request.args:
            if self._is_allowed_explicit_out_format(self._request.args['format']):
                action_metadata['return_type'] = self._request.args['format']
            else:
                action_metadata['return_type'] = 'text'
                raise UserActionException(
                    'Unknown output format: {0}'.format(self._request.args['format']))
        self.add_validator(partial(self._validate_http_method, action_metadata))
        return RequestArgsProxy(self._request.form, self._request.args)

    def post_dispatch(self, methodname: str, action_metadata: Dict[str, Any], tmpl: Optional[str], result: Optional[Dict[str, Any]], err_desc: Tuple[Optional[Exception], Optional[str]]) -> None:
        """
        Allows specific operations to be done after the action itself has been
        processed but before any output or HTTP headers.

        arguments:
        methodname -- a name of the action ("exposed") method currently processed
        action_metadata -- method annotations
        tmpl -- a template used to process the output
        result -- method output
        err_desc -- a 2-tuple: possible error thrown from within the action along with its unique id
        """
        if isinstance(result, dict):
            result['messages'] = result.get('messages', []) + self._system_messages

    def is_action(self, action_name: str, metadata: Dict[str, Any]) -> bool:
        return callable(getattr(self, action_name, None)) and '__exposed__' in metadata

    def _normalize_error(self, err: Exception) -> Exception:
        """
        This method is intended to extract as much details as possible
        from a broad range of errors and rephrase them in a more
        specific ones (including exception object type).
        It is quite a lame solution but it appears that in case of
        syntax errors, attribute errors etc. Manatee raises only RuntimeError
        without further type distinction.

        Please note that some of the decoding is dependent on how Manatee
        outputs phrases its errors which may change between versions
        (as it probably happened in 2.150.x).

        arguments:
        err -- an instance of Exception

        returns:
        a (possibly different) instance of Exception with
        (possibly) rephrased error message.
        """
        if isinstance(err, UserActionException):
            return err
        text = str(err)
        setattr(err, 'message', text)  # in case we return the original error
        if 'syntax error' in text.lower():
            srch = re.match(r'.+ position (\d+)', text)
            if srch:
                text = translate(f'Query failed: Syntax error at position {srch.groups()[0]}.')
            else:
                text = translate('Query failed: Syntax error.')
            return UserActionException(
                translate(f'{text} Please make sure the query and selected query type are correct.'))
        elif 'AttrNotFound' in text:
            srch = re.match(r'AttrNotFound\s+\(([^)]+)\)', text)
            if srch:
                text = translate(f'Attribute "{srch.groups()[0]}" not found.')
            else:
                text = translate('Attribute not found.')
            return UserActionException(text)

        elif 'EvalQueryException' in text:
            return UserActionException(
                translate('Failed to evaluate the query. Please check the syntax and used attributes.'))
        return err

    def _run_message_action(self, req_args: RequestArgsProxy, action_metadata: Dict[str, Any], message_type: str, message: str) -> Tuple[str, Dict[str, Any]]:
        """
        Run a special action displaying a message (typically an error one) to properly
        finish a broken regular action which raised an Exception.
        """
        self.add_system_message(message_type, message)
        if action_metadata['return_type'] == 'json':
            tpl_path, method_ans = self.process_action('message_json', req_args)
            action_metadata.update(self._get_method_metadata('message_json'))
        elif action_metadata['return_type'] == 'xml':
            tpl_path, method_ans = self.process_action('message_xml', req_args)
            action_metadata.update(self._get_method_metadata('message_xml'))
        else:
            tpl_path, method_ans = self.process_action('message', req_args)
            action_metadata.update(self._get_method_metadata('message'))
        return tpl_path, method_ans

    def _create_err_action_args(self, ex: Exception, return_type: str) -> RequestArgsProxy:
        """
        arguments:
        ex -- a risen exception
        return_type --
        """
        ans = RequestArgsProxy(self._request.form, self._request.args)
        if return_type == 'json':
            ans.add_forced_arg('error_code', getattr(ex, 'error_code', None))
            ans.add_forced_arg('error_args', getattr(ex, 'error_args', {}))
        return ans

    @staticmethod
    def _is_allowed_explicit_out_format(f: str) -> bool:
        return f in ('template', 'json', 'xml', 'plain')

    def run(self, path: Optional[List[str]] = None) -> Tuple[str, List[Tuple[str, str]], bool, Union[str, bytes]]:
        """
        This method wraps all the processing of an HTTP request.

        arguments:
        path -- path part of URL

        returns:
        a 4-tuple: HTTP status, HTTP headers, valid SID flag, response body
        """
        self._install_plugin_actions()
        self._proc_time = time.time()
        path = path if path is not None else self._import_req_path()
        methodname = path[0]
        headers: List[Tuple[str, str]] = []
        err: Tuple[Optional[Exception], Optional[str]] = (None, None)
        action_metadata: Dict[str, Any] = self._get_method_metadata(methodname)

        tmpl: Optional[str]
        result: Optional[Dict[str, Any]]
        if not action_metadata:
            def null(): pass
            action_metadata = {}
            action_metadata.update(exposed()(null).__dict__)
        try:
            self.init_session()
            if self.is_action(methodname, action_metadata):
                req_args = self.pre_dispatch(methodname, action_metadata)
                self._pre_action_validate()
                tmpl, result = self.process_action(methodname, req_args)
            else:
                orig_method = methodname
                methodname = 'message'
                raise NotFoundException(translate('Unknown action [%s]') % orig_method)
        except CorpusForbiddenException as ex:
            err = (ex, None)
            self._status = ex.code
            msg_args = self._create_err_action_args(ex, action_metadata['return_type'])
            tmpl, result = self._run_message_action(
                msg_args, action_metadata, 'error', repr(ex) if settings.is_debug_mode() else str(ex))
        except ImmediateRedirectException as ex:
            err = (ex, None)
            tmpl, result = None, None
            self.redirect(ex.url, ex.code)
        except UserActionException as ex:
            err = (ex, None)
            self._status = ex.code
            msg_args = self._create_err_action_args(ex, action_metadata['return_type'])
            tmpl, result = self._run_message_action(
                msg_args, action_metadata, 'error', repr(ex) if settings.is_debug_mode() else str(ex))
        except werkzeug.exceptions.BadRequest as ex:
            err = (ex, None)
            self._status = ex.code
            msg_args = self._create_err_action_args(ex, action_metadata['return_type'])
            tmpl, result = self._run_message_action(msg_args, action_metadata,
                                                    'error', '{0}: {1}'.format(ex.name, ex.description))
        except Exception as ex:
            # an error outside the action itself (i.e. pre_dispatch, action validation,
            # post_dispatch etc.)
            err_id = hashlib.sha1(str(uuid.uuid1()).encode('ascii')).hexdigest()
            err = (ex, err_id)
            logging.getLogger(__name__).error(
                '{0}\n@{1}\n{2}'.format(ex, err_id, ''.join(get_traceback())))
            self._status = 500
            if settings.is_debug_mode():
                message = fetch_exception_msg(ex)
            else:
                message = translate(
                    'Failed to process your request. Please try again later or contact system support.')
            msg_args = self._create_err_action_args(ex, action_metadata['return_type'])
            tmpl, result = self._run_message_action(msg_args, action_metadata, 'error', message)

        self._proc_time = round(time.time() - self._proc_time, 4)
        self.post_dispatch(methodname, action_metadata, tmpl, result, err)
        # response rendering
        headers += self.output_headers(action_metadata['return_type'])

        if (self._status < 300 or self._status >= 400) and (tmpl is not None and result is not None):
            ans_body = self.output_result(methodname, tmpl, result, action_metadata,
                                          return_type=action_metadata['return_type'])
        else:
            ans_body = ''
        return self._export_status(), headers, self._uses_valid_sid, ans_body

    def process_action(self, methodname: str, req_args: RequestArgsProxy) -> Tuple[str, Dict[str, Any]]:
        """
        This method handles mapping between HTTP actions and Controller's methods.
        The method expects 'methodname' argument to be a valid @exposed method.

        Please note that 'request' and 'named_args' are used in a mutually exclusive
        way (the former is passed to 'new style' actions, the latter is used for func_arg_mapped ones).

        arguments:
            methodname -- a string name of a processed method
            req_args --

        returns: tuple of 3 elements
          0 = template name
          1 = template data dict
        """
        action_metadata = self._get_method_metadata(methodname)
        method = getattr(self, methodname)

        if not action_metadata['func_arg_mapped']:
            # new-style actions use werkzeug.wrappers.Request
            method_ans = method(self._request)
        else:
            method_ans = self._invoke_func_arg_mapped_action(method, req_args)
        tpl_path = action_metadata['template']
        if not tpl_path:
            tpl_path = os.path.join(self.get_mapping_url_prefix()[
                                    1:], '{0}.html'.format(methodname))
        return tpl_path, method_ans

    def urlencode(self, key_val_pairs: List[Tuple[str, Union[str, str, bool, int, float]]]) -> str:
        """
        Recodes values of key-value pairs and encodes them (by urllib.urlencode)
        """
        return werkzeug.urls.url_encode(key_val_pairs)

    def output_headers(self, return_type: str = 'template') -> List[Tuple[str, str]]:
        """
        Generates proper content-type signature and
        creates a cookie to store user's settings

        arguments:
        return_type -- action return type (json, html, xml,...)

        returns:
        bool -- True if content should follow else False
        """
        if return_type == 'json':
            self._headers['Content-Type'] = 'application/json'
        elif return_type == 'xml':
            self._headers['Content-Type'] = 'application/xml'
        elif return_type == 'plain':
            self._headers['Content-Type'] = 'text/plain'
        # Note: 'template' return type should never overwrite content type here as it is action-dependent
        ans = []
        for k, v in sorted([x for x in list(self._headers.items()) if bool(x[1])], key=lambda item: item[0]):
            ans.append((k, v))
        # Cookies
        cookies_same_site = settings.get('global', 'cookies_same_site', None)
        for cookie in self._new_cookies.values():
            if cookies_same_site is not None:
                cookie['Secure'] = True
                cookie['SameSite'] = cookies_same_site
            ans.append(('Set-Cookie', cookie.OutputString()))
        return ans

    def output_result(self, methodname: str, template: str, result: Union[Callable, Dict[str, Any], str, bytes], action_metadata: Dict[str, Any], return_type: str) -> Union[str, bytes]:
        """
        Renders a response body out of a provided data resource along with which can
        required target data type.

        The data source can be:
        1) a callable object returning a string or bytes
        2) a dictionary
        3) str or bytes
        """
        if callable(result):
            return result()
        elif return_type == 'json':
            return json.dumps(result)
        elif return_type == 'xml':
            from templating import Type2XML
            return Type2XML.to_xml(result)
        elif return_type == 'plain' and not isinstance(result, dict):
            return result
        elif isinstance(result, dict):
            self.add_globals(result, methodname, action_metadata)
            template_object = self._template_env.get_template(template)
            for k in attr.asdict(self.args):
                if k not in result:
                    result[k] = getattr(self.args, k)
            return template_object.render(result)
        raise RuntimeError('Unknown source or return type')

    # mypy error: missing return statement
    def user_is_anonymous(self) -> bool:  # type: ignore
        with plugins.runtime.AUTH as auth:
            return getattr(auth, 'is_anonymous')(self.session_get('user', 'id'))

    @exposed()
    def nop(self, request: werkzeug.wrappers.Request, *args: Any) -> None:
        """
        Represents an empty operation. This is sometimes required
        to keep the controller in a consistent state. E.g. if a redirect
        is requested soon, an operation still must be set (even if it does nothing).
        """
        return None

    @exposed(accept_kwargs=True, skip_corpus_init=True, page_model='message')
    def message(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        return kwargs
