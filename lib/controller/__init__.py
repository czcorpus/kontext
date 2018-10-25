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

import os
from types import MethodType, DictType, ListType, TupleType
from inspect import isclass
import Cookie
import imp
from urllib import unquote, quote
import json
import logging
import StringIO
import inspect
import time
import re
from functools import partial
import types
import hashlib

import werkzeug.urls
import werkzeug.http
import werkzeug.exceptions

import plugins
import settings
from translation import ugettext as translate
from argmapping import Parameter, GlobalArgs, Args
from controller.errors import (UserActionException, NotFoundException, get_traceback, fetch_exception_msg,
                               CorpusForbiddenException, ImmediateRedirectException)
from templating import CheetahResponseFile


def exposed(access_level=0, template=None, vars=(), page_model=None, legacy=False, skip_corpus_init=False,
            mutates_conc=False, http_method='GET', accept_kwargs=None, apply_semi_persist_args=False,
            return_type='html'):
    """
    This decorator allows more convenient way how to
    set methods' attributes. Please note that there is
    always an implicit property '__exposed__' set to True.

    arguments:
    access_level -- 0,1,... (0 = public user, 1 = logged in user)
    template -- a Cheetah template source path
    vars -- deprecated; do not use
    page_model -- a JavaScript page module
    legacy -- True/False (False - provide only self.args and request, True: maps URL args to action func args)
    skip_corpus_init -- True/False (if True then all the corpus init. procedures are skipped
    mutates_conc -- store a new conc action under a new key to a conc_peristence db
    http_method -- required HTTP method (POST, GET, PUT,...), either a single string or a tuple of strings
    accept_kwargs -- True/False
    apply_semi_persist_args -- if True hen use session to initialize action args first
    return_type -- {plain, json, html}
    """
    def wrapper(func):
        func.__dict__['access_level'] = access_level
        func.__dict__['template'] = template
        func.__dict__['vars'] = vars
        func.__dict__['page_model'] = page_model
        func.__dict__['legacy'] = legacy
        func.__dict__['skip_corpus_init'] = skip_corpus_init
        func.__dict__['mutates_conc'] = mutates_conc
        func.__dict__['http_method'] = http_method
        func.__dict__['accept_kwargs'] = accept_kwargs
        func.__dict__['apply_semi_persist_args'] = apply_semi_persist_args
        func.__dict__['return_type'] = return_type
        func.__dict__['__exposed__'] = True
        return func
    return wrapper


def _function_defaults(fun):
    """
    Returns a dictionary containing default argument names and
    their respective values. This is used when invoking legacy
    action method for URL -> func mapping.

    arguments:
    fun -- an action method with some default arguments
    """
    if isclass(fun):
        fun = fun.__init__
    try:
        default_vals = fun.func_defaults or ()
    except AttributeError:
        return {}
    default_varnames = fun.func_code.co_varnames
    return dict(zip(default_varnames[fun.func_code.co_argcount - len(default_vals):], default_vals))


def convert_types(args, defaults, del_nondef=0, selector=0):
    """
    Converts string values as received from GET/POST data into types
    defined by actions' parameters (type is inferred from function's default
    argument values).

    The function returns the same object as passed via 'args'
    """
    # TODO - there is a potential conflict between global Parameter types and function defaults
    corr_func = {type(0): int, type(0.0): float, TupleType: lambda x: [x]}
    for full_k, value in args.items():
        if selector:
            k = full_k.split(':')[-1]  # filter out selector
        else:
            k = full_k
        if k.startswith('_') or type(defaults.get(k, None)) is MethodType:
            del args[full_k]
        elif k in defaults.keys():
            default_type = type(defaults[k])
            if default_type is not TupleType and type(value) is TupleType:
                args[k] = value = value[-1]
            elif default_type is TupleType and type(value) is ListType:
                value = tuple(value)
            if type(value) is not default_type:
                try:
                    args[full_k] = corr_func.get(default_type, lambda x: x)(value)
                except ValueError as e:
                    raise werkzeug.exceptions.BadRequest(
                        description='Failed to process parameter "{0}": {1}'.format(full_k, e))
        else:
            if del_nondef:
                del args[full_k]
    return args


class KonTextCookie(Cookie.BaseCookie):
    """
    Cookie handler which encodes and decodes strings
    as URI components.
    """

    def value_decode(self, val):
        return unquote(val), val

    def value_encode(self, val):
        strval = str(val)
        return strval, quote(strval)


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

    NO_OPERATION = 'nop'

    def __init__(self, request, ui_lang):
        """
        arguments:
        request -- Werkzeug's request object
        ui_lang -- language used by user
        """
        self._request = request
        self.environ = self._request.environ  # for backward compatibility
        self.ui_lang = ui_lang
        self._cookies = KonTextCookie(self.environ.get('HTTP_COOKIE', ''))
        self._new_cookies = KonTextCookie()
        self._headers = {'Content-Type': 'text/html'}
        self._status = 200
        self._system_messages = []
        self._proc_time = None
        # a list of functions which must pass (= return None) before any action is performed
        self._validators = []
        self._template_dir = os.path.realpath(os.path.join(
            os.path.dirname(__file__), '..', '..', 'cmpltmpl'))
        self.args = Args()
        self._uses_valid_sid = True
        self._plugin_api = None  # must be implemented in a descendant

        # initialize all the Parameter attributes
        for k, value in inspect.getmembers(GlobalArgs, predicate=lambda m: isinstance(m, Parameter)):
            setattr(self.args, k, value.unwrap())

    def init_session(self):
        """
        Starts/reloads user's web session data. It can be called even
        if there is no 'sessions' plugin installed (in such case, it just
        creates an empty dictionary with some predefined keys to allow other
        parts of the application to operate properly)
        """
        with plugins.runtime.AUTH as auth:
            if 'user' not in self._session:
                self._session['user'] = auth.anonymous_user()

            if hasattr(auth, 'revalidate'):
                try:
                    auth.revalidate(self._plugin_api)
                except Exception as ex:
                    self._session['user'] = auth.anonymous_user()
                    logging.getLogger(__name__).error('Revalidation error: %s' % ex)
                    self.add_system_message('error', translate('User authentication error. Please try to reload the page or '
                                                               'contact system administrator.'))

    @property  # for legacy reasons, we have to allow an access to the session via _session property
    def _session(self):
        return self._request.session

    def session_get(self, *nested_keys):
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

    def refresh_session_id(self):
        """
        This tells the wrapping WSGI app to create a new session with
        the same data as the current session.
        """
        self._uses_valid_sid = False

    def add_validator(self, func):
        """
        Adds a function which is run after pre_dispatch but before action processing.
        If the function returns an instance of Exception then Controller raises this value.
        The validation fails on first encountered error (i.e. subsequent validators are not run).
        This is intended for ancestors to inject pre-run checks.

        arguments:
        func -- a callable instance
        """
        self._validators.append(func)

    def add_system_message(self, msg_type, text):
        """
        Adds a system message which will be displayed
        to a user. It is possible to add multiple messages
        by repeatedly call this method.

        arguments:
        msg_type -- one of 'message', 'info', 'warning', 'error'
        text -- text of the message
        """
        self._system_messages.append((msg_type, text))

    def _is_template(self, template):
        """
        Tests whether the provided template name corresponds
        to a respective python module (= compiled template).

        arguments:
        template -- template name (e.g. document, first_form,...)
        """
        try:
            imp.find_module(template, [self._template_dir])
            return True
        except ImportError:
            return False

    def _export_status(self):
        """
        Exports numerical HTTP status into a HTTP header format
        (e.g. 200 -> '200 OK'

        TODO: values not found in the STATUS_MAP should be treated in a better way
        """
        s = werkzeug.http.HTTP_STATUS_CODES.get(self._status, '')
        return '%s  %s' % (self._status, s)

    @property
    def corp_encoding(self):
        return 'iso-8859-1'

    def add_globals(self, result, methodname, action_metadata):
        """
        This method is expected to fill-in global values needed by output template
        (e.g. each page contains user name or current corpus).
        It is called after an action is processed but before any output starts.
        """
        result['methodname'] = methodname
        deployment_id = settings.get('global', 'deployment_id', None)
        result['deployment_suff'] = '?_v={0}'.format(hashlib.md5(deployment_id).hexdigest()[
            :6]) if deployment_id else ''
        result['current_action'] = '/'.join([x for x in self.get_current_action() if x])

    def _get_template_class(self, name):
        """
        Imports a python module corresponding to the passed template name and
        returns a class representing respective HTML template.
        A template name may contain also a relative path to the self._template_dir
        in which case the search for the respective module will be performed there.

        arguments:
        name -- name of the template/class

        returns:
        an object representing the class
        """
        name = name.rsplit('/', 1)
        if len(name) == 2:
            template_dir = os.path.join(self._template_dir, name[0])
            name = name[1]
        else:
            template_dir = self._template_dir
            name = name[0]

        srch_dirs = [self._template_dir, template_dir]
        try:
            tpl_file, pathname, description = imp.find_module(name, srch_dirs)
        except ImportError as ex:
            logging.getLogger(__name__).error(
                'Failed to import template {0} in {1}'.format(name, ', '.join(srch_dirs)))
            raise ex
        module = imp.load_module(name, tpl_file, pathname, description)
        return getattr(module, name)

    def get_current_url(self):
        """
        Returns an URL representing current application state
        """
        action_str = '/'.join(filter(lambda x: x, self.get_current_action()))
        query = '?' + self.environ.get('QUERY_STRING') if self.environ.get('QUERY_STRING') else ''
        return self.get_root_url() + action_str + query

    def updated_current_url(self, params):
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
        import urlparse
        import urllib

        parsed_url = list(urlparse.urlparse(self.get_current_url()))
        old_params = urlparse.parse_qsl(parsed_url[4])
        new_params = []
        for k, v in old_params:
            if k in params:
                new_params.append((k, params[k]))
            else:
                new_params.append((k, v))

        old_params = dict(old_params)
        for k, v in params.items():
            if k not in old_params:
                new_params.append((k, v))

        parsed_url[4] = urllib.urlencode(new_params)
        return urlparse.urlunparse(parsed_url)

    def get_current_action(self):
        """
        Returns a 2-tuple where:
        1st item = module name (or an empty string if an implicit one is in use)
        2nd item = action method name
        """
        prefix, action = self.environ.get('PATH_INFO').rsplit('/', 1)
        return prefix.rsplit('/', 1)[-1], action

    def get_root_url(self):
        """
        Returns the root URL of the application (based on environmental variables). All the action module
        path elements and action names are removed. E.g.:
            The app is installed in http://127.0.0.1/app/ and it is currently processing
            http://127.0.0.1/app/user/login then root URL is still http://127.0.0.1/app/

        Please note that KonText always normalizes PATH_INFO environment
        variable to '/' (see public/app.py).
        """
        module, _ = self.environ.get('PATH_INFO').rsplit('/', 1)
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
        return '/'.join(filter(lambda x: bool(x), map(lambda x: x.strip('/'), url_items))) + '/'

    def create_url(self, action, params):
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
            return str(x) if type(x) not in (str, unicode) else x.encode('utf-8')

        if type(params) is dict:
            params_str = '&'.join(['%s=%s' % (k, quote(convert_val(v))) for k, v in params.items()])
        else:
            params_str = '&'.join(['%s=%s' % (k, quote(convert_val(v))) for k, v in params])

        if len(params_str) > 0:
            return '%s%s?%s' % (root, action, params_str)
        else:
            return '%s%s' % (root, action)

    def _validate_http_method(self, action_metadata):
        hm = action_metadata.get('http_method', 'GET')
        if type(hm) is not tuple:
            hm = (hm,)
        if self.get_http_method() not in hm:
            raise UserActionException(translate('Unknown action'), code=404)

    def _pre_action_validate(self):
        """
        Runs defined validators before action itself is performed
        (but after pre_dispatch is run).
        See Controller.add_validator for more info.
        """
        for validator in self._validators:
            err = validator()
            if isinstance(err, UserActionException):
                logging.getLogger(__name__).error(
                    u'Pre-action validator {0}: {1}'.format(validator.__name__, err.internal_message))
                raise err
            elif isinstance(err, Exception):
                logging.getLogger(__name__).error(
                    u'Pre-action validator {0}: {1}'.format(validator.__name__, err))
                raise err

    @staticmethod
    def _invoke_legacy_action(action, named_args):
        """
        Calls an action method (= method with the @exposed annotation) in the
        "bonito" way (i.e. with automatic mapping between request args to target
        method args). Such action must have legacy=True meta-information.
        Non-legacy actions are called with werkzeug.wrappers.Request instance
        as the first argument.

        arguments:
        action -- name of the action
        named_args -- a dictionary of named args and their defined default values
        """
        na = named_args.copy()
        if hasattr(action, 'accept_kwargs') and getattr(action, 'accept_kwargs') is True:
            del_nondef = 0
        else:
            del_nondef = 1
        convert_types(na, _function_defaults(action), del_nondef=del_nondef)
        return action(**na)

    def call_function(self, func, args, **named_args):
        """
        Calls a function with passed arguments but also with attributes of
        'self' used as arguments. Actually the order is following:
        1) get attributes of 'self'
        2) update result by **named_args

        !!! For the sake of sanity, this should be avoided as much as possible
        because it completely hides what is actually passed to the function.

        arguments:
        func -- a callable to be called
        args -- positional arguments
        **named_args -- named arguments of the callable
        """
        na = self.clone_args()
        na.update(named_args)
        convert_types(na, _function_defaults(func), 1)
        return func(*args, **na)

    def clone_args(self):
        """
        Creates a shallow copy of self.args.
        """
        na = {}
        for a in dir(self.args):
            if not a.startswith('_') and not callable(getattr(self.args, a)):
                na[a] = getattr(self.args, a)
        return na

    def _get_method_metadata(self, method_name, attr_name=None):
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

    def get_mapping_url_prefix(self):
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

    def _import_req_path(self):
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

        path = path.split('/')
        if len(path) is 0 or path[0] is '':
            path = [Controller.NO_OPERATION]
        return path

    def redirect(self, url, code=303):
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
        if type(url) is unicode:
            url = url.encode('utf-8')
        self._headers['Location'] = url

    def set_not_found(self):
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

    def get_http_method(self):
        return self.environ.get('REQUEST_METHOD', '')

    @staticmethod
    def _get_attrs_by_persistence(persistence_types):
        """
        Returns list of object's attributes which (along with their values) will be preserved.
        A persistent parameter is the one which meets the following properties:
        1. is of the Parameter type
        2. has a matching persistence flag
        """
        def is_valid_parameter(m):
            return isinstance(m, Parameter) and m.meets_persistence(persistence_types)

        attrs = inspect.getmembers(GlobalArgs, predicate=is_valid_parameter)
        return tuple([x[0] for x in attrs])

    def _get_items_by_persistence(self, persistence_types):
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

    def _install_plugin_actions(self):
        """
        Tests plug-ins whether they provide method 'export_actions' and if so
        then attaches functions they provide to itself (if exported function's required
        controller class matches current instance's one).
        """
        for plg in plugins.runtime:
            if callable(getattr(plg.instance, 'export_actions', None)):
                exported = plg.instance.export_actions()
                if self.__class__ in exported:
                    for action in exported[self.__class__]:
                        if not hasattr(self, action.__name__):
                            setattr(self, action.__name__, types.MethodType(action, self))
                        else:
                            raise Exception(
                                'Plugins cannot overwrite existing action methods (%s.%s)' % (
                                    self.__class__.__name__, action.__name__))

    def pre_dispatch(self, action_name, args, action_metadata=None):
        """
        Allows specific operations to be performed before the action itself is processed.
        """
        if action_metadata is None:
            action_metadata = {}
        self.add_validator(partial(self._validate_http_method, action_metadata))
        return args

    def post_dispatch(self, methodname, action_metadata, tmpl, result):
        """
        Allows specific operations to be done after the action itself has been
        processed but before any output or HTTP headers.
        """
        if type(result) is dict:
            result['messages'] = result.get('messages', []) + self._system_messages
        if self._request.args.get('format') == 'json' or self._request.form.get('format') == 'json':
            action_metadata['return_type'] = 'json'

    def is_action(self, action_name, metadata):
        return callable(getattr(self, action_name, None)) and '__exposed__' in metadata

    def _normalize_error(self, err):
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
        if err.message:
            if type(err.message) == unicode:
                text = err.message
            else:
                text = str(err.message).decode(self.corp_encoding, errors='replace')
        else:
            text = unicode(err)
            err.message = text  # in case we return the original error
        if 'syntax error' in text.lower():
            srch = re.match(r'.+ position (\d+)', text)
            if srch:
                text = translate('Query failed: Syntax error at position %s.') % srch.groups()[0]
            else:
                text = translate('Query failed: Syntax error.')
            new_err = UserActionException(
                translate('%s Please make sure the query and selected query type are correct.') % text)
        elif 'AttrNotFound' in text:
            srch = re.match(r'AttrNotFound\s+\(([^)]+)\)', text)
            if srch:
                text = translate('Attribute "%s" not found.') % srch.groups()[0]
            else:
                text = translate('Attribute not found.')
            new_err = UserActionException(text)
        elif 'EvalQueryException' in text:
            new_err = UserActionException(
                translate('Failed to evaluate the query. Please check the syntax and used attributes.'))
        else:
            new_err = err
        return new_err

    def _run_message_action(self, named_args, action_metadata, message_type, message):
        """
        Run a special action displaying a message (typically an error one) to properly
        finish a broken regular action which raised an Exception.
        """
        self.add_system_message(message_type, message)
        if action_metadata['return_type'] == 'json':
            tpl_path, method_ans = self.process_action('message_json', named_args)
            action_metadata.update(self._get_method_metadata('message_json'))
        else:
            tpl_path, method_ans = self.process_action('message', named_args)
            action_metadata.update(self._get_method_metadata('message'))
        return tpl_path, method_ans

    def _create_user_action_err_result(self, ex, return_type):
        """
        arguments:
        ex -- a risen exception
        return_type --
        """
        e2 = self._normalize_error(ex)
        if settings.is_debug_mode() or isinstance(e2, UserActionException):
            user_msg = fetch_exception_msg(e2)
        else:
            user_msg = translate('Failed to process your request. '
                                 'Please try again later or contact system support.')
        if return_type == 'json':
            return dict(messages=[user_msg],
                        error_code=getattr(ex, 'error_code', None),
                        error_args=getattr(ex, 'error_args', {}))
        else:
            return dict(messages=[user_msg])

    def run(self, path=None):
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
        named_args = {}
        headers = []
        action_metadata = self._get_method_metadata(methodname)
        if not action_metadata:
            def null(): pass
            action_metadata = {}
            action_metadata.update(exposed()(null).__dict__)
        return_type = action_metadata['return_type']
        try:
            self.init_session()
            if self.is_action(methodname, action_metadata):
                named_args = self.pre_dispatch(methodname, named_args, action_metadata)
                self._pre_action_validate()
                tmpl, result = self.process_action(methodname, named_args)
            else:
                orig_method = methodname
                methodname = 'message'
                raise NotFoundException(translate('Unknown action [%s]') % orig_method)
        except CorpusForbiddenException as ex:
            self._status = ex.code
            tmpl, result = self._run_message_action(
                named_args, action_metadata, 'error', ex.message)
        except ImmediateRedirectException as ex:
            tmpl, result = None, None
            self.redirect(ex.url, ex.code)
        except UserActionException as ex:
            self._status = ex.code
            msg_args = self._create_user_action_err_result(ex, return_type)
            named_args.update(msg_args)
            tmpl, result = self._run_message_action(
                named_args, action_metadata, 'error', ex.message)
        except werkzeug.exceptions.BadRequest as ex:
            self._status = ex.code
            tmpl, result = self._run_message_action(named_args, action_metadata,
                                                    'error', '{0}: {1}'.format(ex.name, ex.description))
        except Exception as ex:
            # an error outside the action itself (i.e. pre_dispatch, action validation,
            # post_dispatch etc.)
            logging.getLogger(__name__).error(u'%s\n%s' % (ex, ''.join(get_traceback())))
            self._status = 500
            if settings.is_debug_mode():
                message = fetch_exception_msg(ex)
            else:
                message = translate(
                    'Failed to process your request. Please try again later or contact system support.')
            tmpl, result = self._run_message_action(named_args, action_metadata, 'error', message)

        self._proc_time = round(time.time() - self._proc_time, 4)
        self.post_dispatch(methodname, action_metadata, tmpl, result)
        # response rendering
        headers += self.output_headers(return_type)
        output = StringIO.StringIO()
        if self._status < 300 or self._status >= 400:
            self.output_result(methodname, tmpl, result, action_metadata, outf=output)
        ans_body = output.getvalue()
        output.close()
        return self._export_status(), headers, self._uses_valid_sid, ans_body

    def process_action(self, methodname, named_args):
        """
        This method handles mapping between HTTP actions and Controller's methods.
        The method expects 'methodname' argument to be a valid @exposed method.

        Please note that 'request' and 'named_args' are used in a mutually exclusive
        way (the former is passed to 'new style' actions, the latter is used for legacy ones).

        arguments:
            methodname -- a string name of a processed method
            named_args -- named args for the method (legacy actions)

        returns: tuple of 3 elements
          0 = template name
          1 = template data dict
        """
        action_metadata = self._get_method_metadata(methodname)
        method = getattr(self, methodname)

        if not action_metadata['legacy']:
            # new-style actions use werkzeug.wrappers.Request
            method_ans = method(self._request)
        else:
            method_ans = self._invoke_legacy_action(method, named_args)
        tpl_path = action_metadata['template']
        if not tpl_path:
            tpl_path = '%s/%s.tmpl' % (self.get_mapping_url_prefix()[1:], methodname)
        return tpl_path, method_ans

    def urlencode(self, key_val_pairs):
        """
        Recodes values of key-value pairs and encodes them (by urllib.urlencode)
        """
        return werkzeug.urls.url_encode(key_val_pairs)

    def output_headers(self, return_type='html'):
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

        ans = []
        for k, v in sorted([x for x in self._headers.items() if bool(x[1])], key=lambda item: item[0]):
            if type(v) is unicode:
                v = v.encode('utf-8')
            ans.append((k, v))
        # Cookies
        for cookie_id in self._new_cookies.keys():
            ans.append(('Set-Cookie', self._new_cookies[cookie_id].OutputString()))
        return ans

    def output_result(self, methodname, template, result, action_metadata, outf,
                      return_template=False):
        """
        Renders a response body
        """
        from Cheetah.Template import Template
        # any result with custom serialization
        if action_metadata['return_type'] == 'plain':
            outf.write(str(result))
        elif callable(result):
            outf.write(result())
        # JSON with simple serialization (dict -> string)
        elif action_metadata['return_type'] == 'json':
            json.dump(result, outf)
        # Template
        elif type(result) is DictType:
            self.add_globals(result, methodname, action_metadata)
            if template.endswith('.tmpl'):
                template_class = self._get_template_class(template[:-5])
                tpl_ans = template_class(searchList=[result, self.args])
            else:
                tpl_ans = Template(template, searchList=[result, self.args])
            if return_template:
                return tpl_ans
            tpl_ans.respond(CheetahResponseFile(outf))

    def user_is_anonymous(self):
        with plugins.runtime.AUTH as auth:
            return auth.is_anonymous(self.session_get('user', 'id'))

    @exposed()
    def nop(self, request, *args):
        """
        Represents an empty operation. This is sometimes required
        to keep the controller in a consistent state. E.g. if a redirect
        is requested soon, an operation still must be set (even if it does nothing).
        """
        return None

    @exposed(accept_kwargs=True, skip_corpus_init=True, page_model='message')
    def message(self, *args, **kwargs):
        return kwargs
