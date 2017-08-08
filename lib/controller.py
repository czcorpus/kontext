# Copyright (c) 2003-2011  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Vit Baisa
# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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
import sys
from types import MethodType, DictType, ListType, TupleType
from inspect import isclass
import Cookie
import codecs
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

import plugins
import settings
from translation import ugettext as _
from argmapping import Parameter, GlobalArgs, Args
import fallback_corpus


codecs.register_error('replacedot', lambda err: (u'.', err.end))


def exposed(**kwargs):
    """
    This decorator allows more convenient way how to
    set methods' attributes. Please note that there is
    always an implicit property '__exposed__' set to True.

    Currently detected properties:
    access_level -- 0,1,...
    template -- a Cheetah template source path
    vars -- deprecated; do not use
    page_model -- a JavaScript page module
    legacy -- True/False

    arguments:
    **kwargs -- all the keyword args will be converted into a dict
    """
    def wrapper(func):
        func.__dict__.update(kwargs)
        func.__dict__['__exposed__'] = True
        return func
    return wrapper


def function_defaults(fun):
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
                args[full_k] = corr_func.get(default_type, lambda x: x)(value)
        else:
            if del_nondef:
                del args[full_k]
    return args


def get_traceback():
    """
    Returns python-generated traceback information
    """
    import traceback

    err_type, err_value, err_trace = sys.exc_info()
    return traceback.format_exception(err_type, err_value, err_trace)


def fetch_exception_msg(ex):
    msg = getattr(ex, 'message', None)
    if not msg:
        try:
            msg = unicode(ex)
        except:
            msg = '%r' % ex
    return msg


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


class CheetahResponseFile(object):
    """
    Provides utf-8 compatible output for Cheetah renderer
    """
    def __init__(self, outfile):
        self.outfile = codecs.getwriter('utf-8')(outfile)

    def response(self):
        return self.outfile


class FunctionNotSupported(Exception):
    """
    This marks a functionality which is present in bonito-open but not in KonText
    (either temporarily or for good).
    """
    pass


class UserActionException(Exception):
    """
    This exception should cover general errors occurring in Controller's action methods'
    """
    def __init__(self, message, code=400, error_code=None, error_args=None):
        super(UserActionException, self).__init__(message)
        self.code = code
        self.error_code = error_code
        self.error_args = error_args

    def __repr__(self):
        return self.message

    def __str__(self):
        return self.message


class NotFoundException(UserActionException):
    """
    Raised in case user requests non-exposed/non-existing action
    """
    def __init__(self, message):
        super(NotFoundException, self).__init__(message, 404)


class ForbiddenException(UserActionException):
    """
    Raised in case user access is forbidden
    """
    def __init__(self, message):
        super(ForbiddenException, self).__init__(message, 403)


class Controller(object):
    """
    This object serves as a controller of the application. It handles action->method mapping,
    target method processing, result rendering, generates required http headers etc.

    Request processing composes of the following phases:
      1) pre-dispatch (_pre_dispatch() method)
      2) validation of registered callbacks (_pre_action_validate() method)
      3) processing of mapped action method
      4) post-dispatch (_post_dispatch() method)
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
        self._validators = []  # a list of functions which must pass (= return None) before any action is performed
        self._exceptmethod = None
        self._template_dir = u'../cmpltmpl/'
        self.args = Args()
        self._uses_valid_sid = True
        self._plugin_api = None  # must be implemented in a descendant

        # initialize all the Parameter attributes
        for k, value in inspect.getmembers(GlobalArgs, predicate=lambda m: isinstance(m, Parameter)):
            setattr(self.args, k, value.unwrap())

        # correct _template_dir
        if not os.path.isdir(self._template_dir):
            self._template_dir = imp.find_module('cmpltmpl')[1]

    def _init_session(self):
        """
        Starts/reloads user's web session data. It can be called even
        if there is no 'sessions' plugin installed (in such case, it just
        creates an empty dictionary with some predefined keys to allow other
        parts of the application to operate properly)
        """
        auth = plugins.get('auth')
        if 'user' not in self._session:
            self._session['user'] = auth.anonymous_user()

        if hasattr(plugins.get('auth'), 'revalidate'):
            try:
                auth.revalidate(self._plugin_api)
            except Exception as ex:
                self._session['user'] = auth.anonymous_user()
                logging.getLogger(__name__).error('Revalidation error: %s' % ex)
                self.add_system_message('error', _('User authentication error. Please try to reload the page or '
                                                   'contact system administrator.'))

    @property  # for legacy reasons, we have to allow an access to the session via _session property
    def _session(self):
        return self._request.session

    def _session_get(self, *nested_keys):
        """
        This is just a convenience method to retrieve session's nested values:
        E.g. self._session['user']['car']['name'] can be rewritten
        as self._session_get('user', 'car', 'name').
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
        the same data the current one has.
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

    def is_template(self, template):
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

    def self_encoding(self):
        return 'iso-8859-1'

    def _add_globals(self, result, methodname, action_metadata):
        """
        This method is expected to fill-in global values needed by output template
        (e.g. each page contains user name or current corpus).
        It is called after an action is processed but before any output starts.
        """
        result['methodname'] = methodname
        deployment_id = settings.get('global', 'deployment_id', None)
        result['deployment_id'] = hashlib.md5(deployment_id).hexdigest()[:6] if deployment_id else None
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
            template_dir = '%s/%s' % (self._template_dir, name[0])
            name = name[1]
        else:
            template_dir = self._template_dir
            name = name[0]
        try:
            tpl_file, pathname, description = imp.find_module(name, [template_dir])
        except ImportError:
            # if some non-root action (e.g. /user/login) calls a root one (e.g. /message)
            # then we have to look for root actions' templates too
            tpl_file, pathname, description = imp.find_module(name, ['%s/..' % template_dir])
        module = imp.load_module(name, tpl_file, pathname, description)
        return getattr(module, name)

    def _get_current_url(self):
        """
        Returns an URL representing current application state
        """
        action_str = '/'.join(filter(lambda x: x, self.get_current_action()))
        query = '?' + self.environ.get('QUERY_STRING') if self.environ.get('QUERY_STRING') else ''
        return self.get_root_url() + action_str + query

    def _updated_current_url(self, params):
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

        parsed_url = list(urlparse.urlparse(self._get_current_url()))
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
        else:
            protocol = self.environ['wsgi.url_scheme']
        url_items = ('%s://%s' % (protocol, self.environ.get('HTTP_HOST')),
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

        params_str = '&'.join(['%s=%s' % (k, quote(convert_val(v))) for k, v in params.items()])
        if len(params_str) > 0:
            return '%s%s?%s' % (root, action, params_str)
        else:
            return '%s%s' % (root, action)

    def _validate_http_method(self, action_metadata):
        if 'http_method' in action_metadata and (self.get_http_method().lower() !=
                                                 action_metadata['http_method'].lower()):
            raise UserActionException(_('Unknown action'), code=404)

    def _pre_action_validate(self):
        """
        Runs defined validators before action itself is performed
        (but after pre_dispatch is run).
        See Controller.add_validator for more info.
        """
        for validator in self._validators:
            err = validator()
            if isinstance(err, Exception):
                raise err

    @staticmethod
    def _invoke_legacy_action(action, args, named_args):
        """
        Calls an action method (= method with the @exposed annotation) in the
        "bonito" way (i.e. with automatic mapping between request args to target
        method args). Such action must have legacy=True meta-information.
        Non-legacy actions are called with werkzeug.wrappers.Request instance
        as the first argument.

        arguments:
        action -- name of the action
        args -- positional arguments of the action (tuple/list)
        named_args -- a dictionary of named args and their defined default values
        """
        na = named_args.copy()
        if hasattr(action, 'accept_kwargs') and getattr(action, 'accept_kwargs') is True:
            del_nondef = 0
        else:
            del_nondef = 1
        convert_types(na, function_defaults(action), del_nondef=del_nondef)
        return action(*args[1:], **na)

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
        convert_types(na, function_defaults(func), 1)
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

    def _get_method_metadata(self, method_name, data_name=None):
        """
        Returns metadata attached to method's __dict__ object. This
        is typically written on a higher level via @exposed annotation.

        arguments:
        method_name -- name of a method
        data_name -- optional data item key; if omitted then all the metadata is retuned

        returns:
        a dictionary of all metadata or a specific metadata item (which could be anything)
        """
        method_obj = getattr(self, method_name, None)
        if data_name is not None:
            ans = None
            if method_obj is not None and hasattr(method_obj, data_name):
                ans = getattr(method_obj, data_name)
        else:
            ans = {}
            if method_obj is not None:
                ans.update(method_obj.__dict__)
            if 'return_type' not in ans or not ans['return_type']:
                ans['return_type'] = 'html'
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
        raise NotImplementedError('Each action controller must implement method get_mapping_url_prefix()')

    def import_req_path(self):
        """
        Parses PATH_INFO into a list of elements

        returns:
        a list of path elements
        """
        ac_prefix = self.get_mapping_url_prefix()
        path = self.environ.get('PATH_INFO', '').strip()

        if not path.startswith(ac_prefix):  # this should not happen unless you hack the code here and there
            raise Exception('URL-action mapping error: cannot match prefix [%s] with path [%s]' % (path, ac_prefix))
        else:
            path = path[len(ac_prefix):]

        path = path.split('/')
        if len(path) is 0 or path[0] is '':
            path = [Controller.NO_OPERATION]
        return path

    def _redirect(self, url, code=303):
        """
        Sets Controller to output HTTP redirection headers.
        Please note that the header output is not immediate -
        an action still must be set and performed. In case there is
        no need to process anything a NOP action (which does nothing)
        can be used.

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

    def _set_not_found(self):
        """
        Sets Controller to output HTTP 404 Not Found response
        """
        self._headers.clear()
        self._status = 404

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
        for p in plugins.get_plugins().values():
            if callable(getattr(p, 'export_actions', None)):
                exported = p.export_actions()
                if self.__class__ in exported:
                    for action in exported[self.__class__]:
                        if not hasattr(self, action.__name__):
                            setattr(self, action.__name__, types.MethodType(action, self))
                        else:
                            raise Exception(
                                'Plugins cannot overwrite existing action methods (%s.%s)' % (
                                    self.__class__.__name__, action.__name__))

    def _pre_dispatch(self, path, args, action_metadata=None):
        """
        Allows specific operations to be performed before the action itself is processed.
        """
        if action_metadata is None:
            action_metadata = {}
        self.add_validator(partial(self._validate_http_method, action_metadata))
        return path, args

    def _post_dispatch(self, methodname, action_metadata, tmpl, result):
        """
        Allows specific operations to be done after the action itself has been
        processed but before any output or HTTP headers.
        """
        if type(result) is dict:
            result['messages'] = result.get('messages', []) + self._system_messages
            result['contains_errors'] = result.get('contains_errors', False) or self.contains_errors()
        if self._request.args.get('format') == 'json' or self._request.form.get('format') == 'json':
            action_metadata['return_type'] = 'json'

    @staticmethod
    def _method_is_exposed(metadata):
        return '__exposed__' in metadata

    def is_action(self, action_name):
        return callable(getattr(self, action_name, None))

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
                text = str(err.message).decode(self.self_encoding(), errors='replace')
        else:
            text = unicode(err)
            err.message = text  # in case we return the original error
        if 'syntax error' in text.lower():
            srch = re.match(r'.+ position (\d+)', text)
            if srch:
                text = _('Query failed: Syntax error at position %s.') % srch.groups()[0]
            else:
                text = _('Query failed: Syntax error.')
            new_err = UserActionException(
                    _('%s Please make sure the query and selected query type are correct.') % text)
        elif 'AttrNotFound' in text:
            srch = re.match(r'AttrNotFound\s+\(([^)]+)\)', text)
            if srch:
                text = _('Attribute "%s" not found.') % srch.groups()[0]
            else:
                text = _('Attribute not found.')
            new_err = UserActionException(text)
        elif 'EvalQueryException' in text:
            new_err = UserActionException(
                        _('Failed to evaluate the query. Please check the syntax and used attributes.'))
        else:
            new_err = err
        return new_err

    def contains_errors(self):
        for item in self._system_messages:
            if item[0] == 'error':
                return True
        return False

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
        path = path if path is not None else self.import_req_path()
        named_args = {}
        headers = []
        action_metadata = self._get_method_metadata(path[0])
        try:
            self._init_session()
            if self.is_action(path[0]) and self._method_is_exposed(action_metadata):
                path, named_args = self._pre_dispatch(path, named_args, action_metadata)
                self._pre_action_validate()
                methodname, tmpl, result = self.process_action(path[0], path, named_args)
            else:
                raise NotFoundException(_('Unknown action [%s]') % path[0])
        except Exception as ex:
            # an error outside the action itself (i.e. pre_dispatch, action validation,
            # post_dispatch etc.)
            logging.getLogger(__name__).error(u'%s\n%s' % (ex, ''.join(get_traceback())))
            if settings.is_debug_mode():
                self._status = 500
                self.add_system_message('error', fetch_exception_msg(ex))
            else:
                self.handle_dispatch_error(ex)
            methodname, tmpl, result = self.process_action('message', path, named_args)

        # Let's test whether process_method actually invoked requested method.
        # If not (e.g. there was an error and a fallback has been used) then reload action metadata
        if methodname != path[0]:
            action_metadata = self._get_method_metadata(methodname)

        self._proc_time = round(time.time() - self._proc_time, 4)
        self._post_dispatch(methodname, action_metadata, tmpl, result)
        # response rendering
        headers += self.output_headers(action_metadata.get('return_type', 'html'))
        output = StringIO.StringIO()
        if self._status < 300 or self._status >= 400:
            self.output_result(methodname, tmpl, result, action_metadata, outf=output)
        ans_body = output.getvalue()
        output.close()
        return self._export_status(), headers, self._uses_valid_sid, ans_body

    def handle_action_error(self, ex, action_name, pos_args, named_args):
        """
        arguments:
        ex -- a risen exception
        action_name -- a name of the original processed method
        pos_args -- positional arguments of the action method
        named_args -- key=>value arguments of the action method
        """
        e2 = self._normalize_error(ex)
        if not isinstance(e2, UserActionException):
            logging.getLogger(__name__).error(''.join(get_traceback()))
            self._status = 500
        else:
            self._status = getattr(e2, 'code', 500)
        if settings.is_debug_mode() or isinstance(e2, UserActionException):
            user_msg = e2.message if type(e2.message) is unicode else str(e2).decode('utf-8')
        else:
            user_msg = _('Failed to process your request. '
                         'Please try again later or contact system support.')
        return_type = self._get_method_metadata(action_name, 'return_type')
        if return_type == 'json':
            return (
                action_name,
                None,
                dict(messages=[user_msg],
                     contains_errors=True,
                     error_code=getattr(ex, 'error_code', None),
                     error_args=getattr(ex, 'error_args', {}))
            )
        else:
            if not self._exceptmethod and self.is_template(action_name + '_form'):
                self._exceptmethod = action_name + '_form'
            if not self._exceptmethod:  # let general error handlers in run() handle the error
                raise e2
            else:
                self.add_system_message('error', user_msg)

            self._pre_dispatch(self._exceptmethod, named_args,
                               self._get_method_metadata(self._exceptmethod))
            em, self._exceptmethod = self._exceptmethod, None
            return self.process_action(em, pos_args, named_args)

    def handle_dispatch_error(self, ex):
        """
        Handles error in a production-ready manner which means that
        user-understandable errors should be presented while the internal
        ones should be hidden behind "server error, please contact admin".
        """
        self._status = 500
        self.add_system_message('error',
                                _('Failed to process your request. '
                                  'Please try again later or contact system support.'))

    def process_action(self, methodname, pos_args, named_args):
        """
        This method handles mapping between HTTP actions and Controller's methods.
        The method expects 'methodname' argument to be a valid @exposed method.

        Please note that 'request' and 'pos_args'+'named_args' are used in a mutually exclusive
        way (the former is passed to 'new style' actions, the latter is used for legacy ones).

        returns: tuple of 3 elements
          0 = method name actually used (it may have changed e.g. due to an error)
          1 = template name
          2 = template data dict
        """
        # reload parameter returns user from a result page
        # to a respective form preceding the result (by convention,
        # this is usually encoded as [action] -> [action]_form
        action_metadata = self._get_method_metadata(methodname)
        if getattr(self.args, 'reload', None):
            self.args.reload = None
            if methodname != 'subcorp':
                reload_template = methodname + '_form'
                if self.is_template(reload_template):
                    return self.process_action(reload_template, pos_args, named_args)
        method = getattr(self, methodname)
        try:
            default_tpl_path = '%s/%s.tmpl' % (self.get_mapping_url_prefix()[1:], methodname)
            if not action_metadata.get('legacy', False):
                # new-style actions use werkzeug.wrappers.Request
                method_ans = method(self._request)
            else:
                method_ans = self._invoke_legacy_action(method, pos_args, named_args)
            return methodname, getattr(method, 'template', default_tpl_path), method_ans
        except Exception as ex:
            return self.handle_action_error(ex, methodname, pos_args, named_args)

    def recode_input(self, x, decode=1):
        """
        converts a query into the encoding of current corpus
        """
        if type(x) is ListType:
            return [self.recode_input(v, decode) for v in x]
        if decode:
            try:
                x = x.decode('utf-8')
            except UnicodeDecodeError:
                x = x.decode('latin1')
        return x

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
        if callable(result):
            outf.write(result())
        # JSON with simple serialization (dict -> string)
        elif action_metadata.get('return_type') == 'json':
            json.dump(result, outf)
        # Template
        elif type(result) is DictType:
            self._add_globals(result, methodname, action_metadata)
            if template.endswith('.tmpl'):
                template_class = self._get_template_class(template[:-5])
                tpl_ans = template_class(searchList=[result, self.args])
            else:
                tpl_ans = Template(template, searchList=[result, self.args])
            if return_template:
                return tpl_ans
            tpl_ans.respond(CheetahResponseFile(outf))
        # Other (string)
        else:
            outf.write(str(result))

    def user_is_anonymous(self):
        return plugins.get('auth').is_anonymous(self._session_get('user', 'id'))

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
