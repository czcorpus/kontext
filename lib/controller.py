# Copyright (c) 2003-2011  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Vit Baisa
# Copyright (c) 2014  Institute of the Czech National Corpus
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

import os
import sys
from types import MethodType, StringType, DictType, ListType, TupleType, UnicodeType
from inspect import isclass
import Cookie
import codecs
import imp
from urllib import urlencode, quote_plus, unquote, quote
import json
import logging
import StringIO
import inspect
import time
import re

import plugins
import settings
from plugins.abstract.auth import AuthException
from translation import ugettext as _


def replace_dot_error_handler(err):
    return u'.', err.end

codecs.register_error('replacedot', replace_dot_error_handler)


def exposed(**kwargs):
    """
    This decorator allows more convenient way how to
    set methods' attributes. Please note that there is
    always an implicit property '__exposed__' set to True.

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

    """
    defs = {}
    if isclass(fun):
        fun = fun.__init__
    try:
        dl = fun.func_defaults or ()
    except AttributeError:
        return {}
    nl = fun.func_code.co_varnames
    for a, v in zip(nl[fun.func_code.co_argcount - len(dl):], dl):
        defs[a] = v
    return defs


def convert_types(args, defaults, del_nondef=0, selector=0):
    """
    Converts string values as received from GET/POST data into types
    defined by actions' parameters (type is inferred from function's default
    argument values).
    """
    # TODO - there is a potential conflict between global Parameter types and function defaults
    corr_func = {type(0): int, type(0.0): float, TupleType: lambda x: [x]}
    for full_k, v in args.items():
        if selector:
            k = full_k.split(':')[-1]  # filter out selector
        else:
            k = full_k
        if k.startswith('_') or type(defaults.get(k, None)) is MethodType:
            del args[full_k]
        elif k in defaults.keys():
            default_type = type(defaults[k])
            if default_type is not TupleType and type(v) is TupleType:
                args[k] = v = v[-1]
            elif default_type is TupleType and type(v) is ListType:
                v = tuple(v)
            if type(v) is not default_type:
                args[full_k] = corr_func.get(default_type, lambda x: x)(v)
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
    def __init__(self, outfile):
        self.outfile = codecs.getwriter("utf-8")(outfile)

    def response(self):
        return self.outfile


class JsonEncodedData(object):
    """
    If you want to return already encoded JSON data, you have to
    wrap them into this object to prevent Controller to encode it again...
    """

    def __init__(self, data):
        self.data = data

    def __repr__(self):
        return self.data


class UserActionException(Exception):
    """
    This exception should cover general errors occurring in Controller's action methods'
    """
    def __init__(self, message, code=200):
        self.message = message
        self.code = code


class NotFoundException(UserActionException):
    """
    Raised in case user requests non-exposed/non-existing action
    """
    def __init__(self, message):
        super(NotFoundException, self).__init__(message, 404)

    def __str__(self):
        return self.message


class Parameter(object):
    """
    Setting an object of this type as a static property
    of Controller causes Controller to create an object
    property with wrapped value. This solves the attribute
    mess in the original Bonito code.

    arguments:
    value -- a default value of the parameter (defines both value and type)
    persistent -- bool value specifying whether we should save the value to user's settings
    """

    NON_PERSISTENT = 0b0000  # not stored at all
    PERSISTENT = 0b0001  # stored in user's settings (and not elsewhere)
    SEMI_PERSISTENT = 0b0010  # stored in user's session (and not elsewhere)

    def __init__(self, value, persistent=NON_PERSISTENT):
        """
        arguments:
        value -- wrapped value (primitive types, empty dict, empty list, tuple)
        """
        self.value = value
        self.persistent = persistent

    def unwrap(self):
        if type(self.value) is list:
            ans = self.value[:]
        elif self.value == {}:
            ans = {}
        elif type(self.value) is dict:
            raise TypeError('Cannot define static property as a non-empty dictionary: %s' % (self.value, ))
        else:
            ans = self.value
        return ans

    def is_array(self):
        return type(self.value) is tuple or type(self.value) is list

    def meets_persistence(self, p_level):
        return self.persistent & p_level == p_level


class Controller(object):
    """
    This object serves as a controller of the application. It handles action->method mapping,
    target method processing, result rendering, generates required http headers etc.
    """

    _keep_blank_values = Parameter(0)

    _url_parameters = Parameter([])

    exceptmethod = Parameter(None)

    # specifies response output format (used in case default one is not applicable)
    format = Parameter(u'')

    # after an "action" was called, controller internally (without HTTP redirects)
    # calls "action_form" which (by convention) leads to a page with a form submitting
    # to the "action"
    reload = Parameter(0)

    _template_dir = u'../cmpltmpl/'

    _tmp_dir = u'/tmp'

    NO_OPERATION = 'nop'

    STATUS_MAP = {
        200: 'OK',
        301: 'Moved Permanently',
        303: 'See Other',
        304: 'Not Modified',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        500: 'Internal Server Error'
    }

    def __init__(self, environ, ui_lang):
        """
        arguments:
        environ -- web server's environment variables
        ui_lang -- language used by user
        """
        self.environ = environ
        self.ui_lang = ui_lang
        self._cookies = KonTextCookie(self.environ.get('HTTP_COOKIE', ''))
        self._session = {}
        self._ui_settings = {}
        self._headers = {'Content-Type': 'text/html'}
        self._status = 200
        self._system_messages = []
        self._proc_time = None

        # initialize all the Parameter attributes
        for k, v in inspect.getmembers(self.__class__, predicate=lambda m: isinstance(m, Parameter)):
            setattr(self, k, v.unwrap())

        # correct _template_dir
        if not os.path.isdir(self._template_dir):
            self._template_dir = imp.find_module('cmpltmpl')[1]

    def _app_cookie_names(self):
        return ()

    def _init_session(self):
        """
        Starts/reloads user's web session data. It can be called even
        if there is no 'sessions' plugin installed (in such case, it just
        creates an empty dictionary with some predefined keys to allow other
        parts of the application to operate properly)
        """
        cookie_id = self._get_session_id()
        if plugins.has_plugin('sessions'):
            ans = plugins.sessions.load(cookie_id, {'user': plugins.auth.anonymous_user()})
        else:
            ans = {'id': 0, 'data': {'user': plugins.auth.anonymous_user()}}
        self._set_session_id(ans['id'])
        self._session = ans['data']

        if hasattr(plugins.auth, 'revalidate'):
            plugins.auth.revalidate(self._cookies, self._session, self.environ.get('QUERY_STRING', ''))

    def _close_session(self):
        """
        Closes user's web session. Basically, it stores session data to some
        defined storage via a 'sessions' plugin. It can be called even if there is
        no 'sessions' plugin defined.
        """
        if plugins.has_plugin('sessions'):
                plugins.sessions.save(self._get_session_id(), self._session)

    def _session_get(self, *nested_keys):
        """
        Retrieves a value from session dictionary. If no such value is found
        then None is returned. More than one key is understood as a 'path' of
        a nested dictionaries.

        Arguments:
        *nested_keys -- keys to access required value (e.g. a['user']['car']['name'] would be 'user', 'car', 'name')
        """
        curr = self._session
        for k in nested_keys:
            if k in curr:
                curr = curr[k]
            else:
                return None
        return curr

    def _get_session_id(self):
        """
        Returns session ID. If no ID is found then None is returned
        """
        if settings.get('plugins', 'auth')['auth_cookie_name'] in self._cookies:
            return self._cookies[settings.get('plugins', 'auth')['auth_cookie_name']].value
        return None

    def _set_session_id(self, val):
        """
        Sets session ID

        Arguments:
        val -- session ID value (a string is expected)
        """
        self._cookies[settings.get('plugins', 'auth')['auth_cookie_name']] = val

    def get_root_url(self):
        """
        Returns the root URL of the application (based on environmental variables)
        """
        return '%(protocol)s://%(server)s%(script)s/' % {
            'protocol': self.environ['wsgi.url_scheme'],
            'server': self.environ.get('HTTP_HOST'),
            'script': self.environ.get('SCRIPT_NAME')
        }

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
        Tests whether provided template name corresponds
        to a respective python module (= compiled template).

        Arguments:
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
        s = Controller.STATUS_MAP.get(self._status, '')
        return '%s  %s' % (self._status, s)

    def self_encoding(self):
        return 'iso-8859-1'

    def _add_undefined(self, result, methodname, vars):
        pass

    def _add_globals(self, result, methodname, action_metadata):
        """
        This method is expected to fill-in global values needed by output template
        (e.g. each page contains user name or current corpus).
        It is called after an action is processed but before any output starts.
        """
        ppath = self.environ.get('REQUEST_URI', '/')
        try:
            ppath = ppath[:ppath.index('?')]
            ppath = ppath[:ppath.rindex('/')]
        except ValueError:
            pass
        result['hrefbase'] = self.environ.get('HTTP_HOST', '') + ppath

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

        file, pathname, description = imp.find_module(name, [template_dir])
        module = imp.load_module(name, file, pathname, description)
        return getattr(module, name)

    def _get_current_url(self):
        """
        Returns an URL representing current application state
        """
        return self.environ.get('REQUEST_URI')

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

    def _invoke_action(self, action, args, named_args, tpl_data=None):
        """
        Calls an action method (= method with the @exposed annotation)
        mapped to a specific action.

        arguments:
        action -- name of the action
        args -- positional arguments of the action (tuple/list)
        named_args -- a dictionary of named args and their defined default values
        tpl_data -- a dictionary with additional page/response data
        """
        na = named_args.copy()
        if hasattr(action, 'accept_kwargs') and getattr(action, 'accept_kwargs') is True:
            del_nondef = 0
        else:
            del_nondef = 1
        convert_types(na, function_defaults(action), del_nondef=del_nondef)
        ans = apply(action, args[1:], na)
        if type(ans) == dict and tpl_data is not None:
            ans.update(tpl_data)
        return ans

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
        na = self.clone_self()
        na.update(named_args)
        convert_types(na, function_defaults(func), 1)
        return apply(func, args, na)

    def clone_self(self):
        """
        Creates a dictionary based on self arguments and respective values.
        Callable and '_'-prefixed arguments are omitted.
        Please note that the copy is shallow.
        """
        na = {}
        for a in dir(self) + dir(self.__class__):
            if not a.startswith('_') and not callable(getattr(self, a)):
                na[a] = getattr(self, a)
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
        raise NotImplementedError('Each action controller must implement method get_module_url_prefix()')

    def import_req_path(self):
        """
        Parses PATH_INFO into a list of elements

        Returns
        -------
        list of path elements
        """
        ac_prefix = self.get_mapping_url_prefix()
        path = self.environ.get('PATH_INFO', '').strip()

        if not path.startswith(ac_prefix):  # this should not happen unless you hack the code here and there
            raise Exception('URL -> action mapping error')
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
        #self._headers.clear() # TODO resolve this
        self._status = code
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

    def _get_attrs_by_persistence(self, persistence_types):
        """
        Returns list of object's attributes which (along with their values) will be preserved.
        A persistent parameter is the one which meets the following properties:
        1. is of the Parameter type
        2. has a matching persistence flag
        """
        is_valid_parameter = lambda m: isinstance(m, Parameter) and m.meets_persistence(persistence_types)
        attrs = inspect.getmembers(self.__class__, predicate=is_valid_parameter)
        return tuple([x[0] for x in attrs])

    def _get_items_by_persistence(self, persistence_types):
        """
        Similar to the _get_persistent_attrs() but returns also values.

        returns:
        a dictionary property_name : value
        """
        ans = {}
        for k in self._get_attrs_by_persistence(persistence_types):
            if hasattr(self, k):
                ans[k] = getattr(self, k)
        return ans

    def _pre_dispatch(self, path, selectorname, args, action_metadata=None):
        """
        Allows specific operations to be performed before the action itself is processed.
        """
        return path, selectorname, args

    def _post_dispatch(self, methodname, tmpl, result):
        """
        Allows specific operations to be done after the action itself has been
        processed but before any output or HTTP headers.
        """
        if type(result) is dict:
            result['messages'] = self._system_messages
            result['contains_errors'] = self.contains_errors()
            if 'message' in result:
                result['messages'].append(result['message'])
                del(result['message'])
            if len(self._system_messages) > 0:
                result['message_auto_hide_interval'] = 0

    def _restore_ui_settings(self):
        """
        Loads cookie-stored user interface settings.
        """
        if 'ui_settings' in self._cookies:
            try:
                self._ui_settings = json.loads(self._cookies['ui_settings'].value)
            except ValueError as e:
                logging.getLogger(__name__).warn('Failed to parse ui_settings data: %s' % e)
                self._ui_settings = {}

    def _method_is_exposed(self, metadata):
        return '__exposed__' in metadata

    def _analyze_error(self, err):
        """
        This method is intended to extract details about (some) errors via their
        messages and return more specific type with fixed text message.
        It is quite a lame solution but it appears that in case of
        syntax errors, attribute errors etc. Manatee raises only RuntimeError
        without further type distinction.

        Please note that in some cases passed exception object may be returned too.

        arguments:
        err -- an instance of Exception (or a subclass)

        returns:
        user-readable text of the error
        """
        if type(err.message) == unicode:
            text = err.message
        else:
            text = str(err.message).decode(self.self_encoding(), errors='replace')

        if 'Query evaluation error' in text:
            srch = re.match(r'.+ at position (\d+):', text)
            if srch:
                text = _('Query failed: Syntax error at position %s.') % srch.groups()[0]
            else:
                text = _('Query failed: Syntax error.')
            new_err = UserActionException(_('%s Please make sure the query and selected query type are correct.') % text)
        elif 'AttrNotFound' in text:
            srch = re.match(r'AttrNotFound\s+\(([^)]+)\)', text)
            if srch:
                text = _('Attribute "%s" not found.') % srch.groups()[0]
            else:
                text = _('Attribute not found.')
            new_err = UserActionException(text)
        else:
            new_err = err
        return new_err

    def contains_errors(self):
        for item in self._system_messages:
            if item[0] == 'error':
                return True
        return False

    def run(self, path=None, selectorname=None):
        """
        This method wraps all the processing of an HTTP request.
        """
        self._proc_time = time.time()
        path = path if path is not None else self.import_req_path()
        named_args = {}
        headers = []
        # user action processing
        action_metadata = self._get_method_metadata(path[0])

        try:
            self._restore_ui_settings()

            # plugins setup
            for p in plugins.list_plugins():
                if hasattr(p, 'setup') and callable(p.setup):
                    p.setup(lang=self.ui_lang)

            self._init_session()

            if self._method_is_exposed(action_metadata):
                path, selectorname, named_args = self._pre_dispatch(path, selectorname, named_args, action_metadata)
                methodname, tmpl, result = self.process_method(path[0], path, named_args)
                # Let's test whether process_method used requested our method.
                # If not (e.g. there was an error and a fallback has been used) then reload action metadata
                if methodname != path[0]:
                    action_metadata = self._get_method_metadata(methodname)
            else:
                raise NotFoundException(_('Unknown action [%s]') % path[0])

        except AuthException as e:
            self._status = 401
            self.add_system_message('error', u'%s' % fetch_exception_msg(e))
            named_args['next_url'] = '%sfirst_form' % self.get_root_url()
            methodname, tmpl, result = self.process_method('message', path, named_args)

        except (UserActionException, RuntimeError) as e:
            if hasattr(e, 'code'):
                self._status = e.code
            self.add_system_message('error',  fetch_exception_msg(e))
            named_args['next_url'] = '%sfirst_form' % self.get_root_url()
            methodname, tmpl, result = self.process_method('message', path, named_args)

        except Exception as e:  # we assume that this means some kind of a fatal error
            self._status = 500
            logging.getLogger(__name__).error(u'%s\n%s' % (e, ''.join(get_traceback())))
            if settings.is_debug_mode():
                self.add_system_message('error', fetch_exception_msg(e))
            else:
                self.add_system_message('error',
                                        _('Failed to process your request. '
                                          'Please try again later or contact system support.'))
            named_args['message_auto_hide_interval'] = 0
            named_args['next_url'] = '%sfirst_form' % self.get_root_url()
            methodname, tmpl, result = self.process_method('message', path, named_args)

        self._proc_time = round(time.time() - self._proc_time, 4)
        self._post_dispatch(methodname, tmpl, result)

        # response rendering
        headers += self.output_headers(action_metadata.get('return_type', 'html'))
        output = StringIO.StringIO()

        if self._status < 300 or self._status >= 400:
            self.output_result(methodname, tmpl, result, action_metadata, outf=output)
        ans_body = output.getvalue()
        output.close()
        try:
            self._close_session()
        finally:
            pass
        return self._export_status(), headers, ans_body

    def process_method(self, methodname, pos_args, named_args, tpl_data=None):
        """
        This method handles mapping between HTTP actions and Controller's methods.
        The method expects 'methodname' argument to be a valid @exposed method.

        Returns
        -------
        result : tuple of 3 elements
          0 = method name actually used (it may have changed e.g. due to an error)
          1 = template name
          2 = template data dict
        """
        reload = {'headers': 'wordlist_form'}
        if tpl_data is None:
            tpl_data = {}
        # reload parameter returns user from a result page
        # to a respective form preceding the result (by convention,
        # this is usually encoded as [action] -> [action]_form
        if getattr(self, 'reload', None):
            self.reload = None
            if methodname != 'subcorp':
                reload_template = reload.get(methodname, methodname + '_form')
                if self.is_template(reload_template):
                    return self.process_method(reload_template,
                                               pos_args, named_args)
        method = getattr(self, methodname)
        try:
            default_tpl_path = '%s/%s.tmpl' % (self.get_mapping_url_prefix()[1:], methodname)

            return (methodname,
                    getattr(method, 'template', default_tpl_path),
                    self._invoke_action(method, pos_args, named_args, tpl_data))
        except Exception as e:
            e2 = self._analyze_error(e)
            if not isinstance(e2, UserActionException):
                logging.getLogger(__name__).error(''.join(get_traceback()))

            return_type = self._get_method_metadata(methodname, 'return_type')
            if return_type == 'json':
                if settings.is_debug_mode() or type(e) is UserActionException:
                    json_msg = str(e).decode('utf-8')
                else:
                    json_msg = _('Failed to process your request. '
                                 'Please try again later or contact system support.')
                return methodname, None, {'error': json_msg}
            else:
                if not self.exceptmethod and self.is_template(methodname + '_form'):
                    self.exceptmethod = methodname + '_form'
                if not self.exceptmethod:  # let general error handlers in run() handle the error
                    raise e2
                else:
                    self.add_system_message('error', e2.message)

                em, self.exceptmethod = self.exceptmethod, None
                return self.process_method(em, pos_args, named_args, tpl_data)

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

    def rec_recode(self, x, enc='', utf8_out=False):
        """
        Converts recursively an input object's string elements character
        encoding.

        Devel. note: this method should be avoided in future code as
        it is not very clear whether it is able to handle any input
        in a correct way. An explicit string conversion is preferable
        over this.

        arguments:
        x -- an object to be converted
        enc -- object's strings encoding (if none provided then self._encoding() is used)
        utf8_out -- sets whether encoding to UTF-8 should be performed
        (default False which causes the method to do nothing)
        """
        if not utf8_out:
            return x
        if not enc:
            enc = self.self_encoding()
        if isinstance(x, TupleType) or isinstance(x, ListType):
            return [self.rec_recode(e, enc, utf8_out) for e in x]
        if isinstance(x, DictType):
            d = {}
            for key, value in x.items():
                if key in ('corp_full_name', 'Corplist'):
                    d[key] = value
                else:
                    d[key] = self.rec_recode(value, enc, utf8_out)
            return d
        elif type(x) is StringType:
            return unicode(x, enc, 'replace').encode('utf-8')
        elif type(x) is UnicodeType:
            return x.encode('utf-8')
        return x

    def urlencode(self, key_val_pairs):
        """
        Recodes values of key-value pairs and encodes them (by urllib.urlencode)
        """
        enc = self.self_encoding()
        if type(key_val_pairs) is UnicodeType:  # urllib.quote does not support unicode
            key_val_pairs = key_val_pairs.encode("utf-8")
        if type(key_val_pairs) is StringType:
            # mapping strings
            return quote_plus(key_val_pairs)
        return urlencode([(k, self.rec_recode(v, enc, utf8_out=True))
                          for (k, v) in key_val_pairs])

    def output_headers(self, return_type='html'):
        """
        Generates proper content-type signature and
        creates a cookie to store user's settings

        Returns
        -------
        bool : True if content should follow else False
        """
        # The 'ui_settings' cookie is used only by JavaScript client-side code
        # which always expects the cookie to exists.
        if 'ui_settings' not in self._cookies:
            self._cookies['ui_settings'] = None
        self._cookies['ui_settings']['path'] = self.environ.get('SCRIPT_NAME', '/')
        self._cookies['ui_settings'] = json.dumps(self._ui_settings)

        if return_type == 'json':
            self._headers['Content-Type'] = 'text/x-json'
        elif return_type == 'xml':
            self._headers['Content-Type'] = 'application/xml'

        ans = []
        for k, v in sorted(filter(lambda x: bool(x[1]), self._headers.items()), key=lambda x: x[0]):
            if type(v) is unicode:
                v = v.encode('utf-8')
            ans.append((k, v))
        # Cookies
        for cookie_id in self._app_cookie_names():
            if cookie_id in self._cookies.keys():
                ans.append(('Set-Cookie', self._cookies[cookie_id].OutputString()))
        return ans

    def output_result(self, methodname, template, result, action_metadata, outf,
                      return_template=False):
        """
        Renders a response body
        """
        from Cheetah.Template import Template
        # JSON
        if action_metadata.get('return_type') == 'json':
            if type(result) != JsonEncodedData:
                json.dump(self.rec_recode(result, utf8_out=True), outf)
            else:
                print >> outf, result
        # Template
        elif type(result) is DictType:
            self._add_globals(result, methodname, action_metadata)
            self._add_undefined(result, methodname, action_metadata.get('vars', ()))
            result = self.rec_recode(result)
            if template.endswith('.tmpl'):
                TemplateClass = self._get_template_class(template[:-5])
                result = TemplateClass(searchList=[result, self])
            else:
                result = Template(template, searchList=[result, self])
            if return_template:
                return result
            result.respond(CheetahResponseFile(outf))
        # Other (string)
        else:
            outf.write(str(result))

    def _user_is_anonymous(self):
        return self._session_get('user', 'id') == settings.get_int('global', 'anonymous_user_id')

    def nop(self):
        """
        Represents an empty operation. This is sometimes required
        to keep the controller in a consistent state. E.g. if a redirect
        is requested soon, an operation still must be set (even if it does nothing).
        """
        return None

    @exposed(accept_kwargs=True)
    def message(self, *args, **kwargs):
        return kwargs

    @exposed(return_type='json')
    def json_error(self, error='', reset=False):
        """
        Error page
        """
        return {'error': {'message': error, 'reset': reset}}
