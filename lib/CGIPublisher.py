# Copyright (c) 2003-2009  Pavel Rychly
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

import plugins
import settings
from auth import AuthException
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


class RequestProcessingException(Exception):
    """
    General error in user's request processing
    """
    def __init__(self, message, **data):
        Exception.__init__(self, message)
        self.data = data

    def __getitem__(self, key):
        return self.data[key]

    def __setitem__(self, key, value):
        self.data[key] = value


class CheetahResponseFile(object):
    def __init__(self, outfile):
        self.outfile = codecs.getwriter("utf-8")(outfile)

    def response(self):
        return self.outfile


class JsonEncodedData(object):
    """
    If you want to return already encoded JSON data, you have to
    wrap them into this object to prevent CGIPublisher to encode it again...
    """

    def __init__(self, data):
        self.data = data

    def __repr__(self):
        return self.data


class UserActionException(Exception):
    """
    This exception should cover general errors occurring in CGIPublisher's action methods'
    """
    pass


class Parameter(object):
    """
    Setting an object of this type as a static property
    of CGIPublisher causes CGIPublisher to create an object
    property with wrapped value. This solves the attribute
    mess in the original Bonito code.

    arguments:
    value -- a default value of the parameter (defines both value and type)
    persistent -- bool value specifying whether we should save the value to user's settings
    """
    def __init__(self, value, persistent=False):
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

    def is_persistent(self):
        return self.persistent


class CGIPublisher(object):
    """
    This object serves as a controller of the application. It handles action->method mapping,
    target method processing, result rendering, generates required http headers etc.
    """
    _keep_blank_values = Parameter(0)
    _url_parameters = Parameter([])
    exceptmethod = Parameter(None)
    format = Parameter(u'')
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
        self._user = None
        self._session = {}
        self._ui_settings = {}
        self._headers = {'Content-Type': 'text/html'}
        self._status = 200
        self._anonymous = None
        self.user = None

        for k, v in inspect.getmembers(self.__class__, predicate=lambda m: isinstance(m, Parameter)):
            setattr(self, k, v.unwrap())

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
        cookie_id = self._get_session_id()
        if plugins.has_plugin('sessions'):
            ans = plugins.sessions.load(cookie_id, {'user': plugins.auth.anonymous_user()})
        else:
            ans = {'id': 0, 'data': {'user': plugins.auth.anonymous_user()}}
        self._set_session_id(ans['id'])
        self._session = ans['data']

        if hasattr(plugins.auth, 'revalidate'):
            plugins.auth.revalidate(self._cookies, self._session)
        self._user = self._session['user']['user']

        if self._session['user']['id'] > 0:
            self._anonymous = 0
        else:
            self._anonymous = 1

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
        s = CGIPublisher.STATUS_MAP.get(self._status, '')
        return '%s  %s' % (self._status, s)

    def _setup_user_paths(self, user_file_id):
        if not self._anonymous:
            self.subcpath.append('%s/%s' % (settings.get('corpora', 'users_subcpath'), user_file_id))
        self._conc_dir = '%s/%s' % (settings.get('corpora', 'conc_dir'), user_file_id)
        self._wseval_dir = '%s/%s' % (settings.get('corpora', 'wseval_dir'), user_file_id)

    def self_encoding(self):
        return 'iso-8859-1'

    def _add_undefined(self, result, methodname, vars):
        pass

    def _add_globals(self, result):
        """
        This is called after an action is processed but before any output starts
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
        returns a class representing respective HTML template

        arguments:
        name -- name of the template/class

        returns:
        an object representing the class
        """
        file, pathname, description = imp.find_module(name, [self._template_dir])
        module = imp.load_module(name, file, pathname, description)
        return getattr(module, name)

    def _get_current_url(self):
        """
        Returns an URL representing current application state
        """
        return self.environ.get('REQUEST_URI')

    def _invoke_action(self, action, args, named_args, tpl_data=None):
        """
        Calls an action method mapped to a specific action

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
        na = self.clone_self()
        na.update(named_args)
        convert_types(na, function_defaults(func), 1)
        return apply(func, args, na)

    def clone_self(self):
        na = {}
        for a in dir(self) + dir(self.__class__):
            if not a.startswith('_') and not callable(getattr(self, a)):
                na[a] = getattr(self, a)
        return na

    def _get_method_metadata(self, method_name, data_name=None):
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

    def import_req_path(self):
        """
        Parses PATH_INFO into a list of elements

        Returns
        -------
        list of path elements
        """
        path = self.environ.get('PATH_INFO', '').strip().split('/')[1:]
        if len(path) is 0 or path[0] is '':
            path = [CGIPublisher.NO_OPERATION]
        elif path[0].startswith('_'):
            raise Exception('access denied')
        return path

    def _redirect(self, url, code=303):
        #self._headers.clear() # TODO resolve this
        self._status = code
        if type(url) is unicode:
            url = url.encode('utf-8')
        self._headers['Location'] = url

    def _set_not_found(self):
        self._headers.clear()
        self._status = 404

    def get_http_method(self):
        return self.environ.get('REQUEST_METHOD', '')

    def _get_persistent_attrs(self):
        return ()

    def _get_persistent_items(self):
        ans = {}
        for k in self._get_persistent_attrs():
            if hasattr(self, k):
                ans[k] = getattr(self, k)
        return ans

    def _pre_dispatch(self, path, selectorname, args, action_metadata=None):
        """
        Allows special operations to be done before the action itself is processed
        """
        return path, selectorname, args

    def _post_dispatch(self, methodname, tmpl, result):
        """
        Allows special operations to be done after the action itself has been processed but before
        any output or HTTP headers.
        """
        pass

    def _restore_ui_settings(self):
        if 'ui_settings' in self._cookies:
            try:
                self._ui_settings = json.loads(self._cookies['ui_settings'].value)
            except ValueError as e:
                logging.getLogger(__name__).warn('Failed to parse ui_settings data: %s' % e)
                self._ui_settings = {}

    def run(self, path=None, selectorname=None):
        """
        This method wraps run_unprotected by try-except clause and presents
        only brief error messages to the user.
        """
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
            path, selectorname, named_args = self._pre_dispatch(path, selectorname, named_args, action_metadata)
            methodname, tmpl, result = self.process_method(path[0], path, named_args)

        except AuthException as e:
            self._status = 401
            named_args['message'] = ('error', u'%s' % e)
            named_args['next_url'] = '%sfirst_form' % self.get_root_url()
            methodname, tmpl, result = self.process_method('message', path, named_args)
            plugins.db.recover()

        except (UserActionException, RuntimeError) as e:
            named_args['message'] = ('error', u'%s' % e)
            named_args['next_url'] = '%sfirst_form' % self.get_root_url()
            methodname, tmpl, result = self.process_method('message', path, named_args)
            plugins.db.recover()

        except Exception as e:  # we assume that this means some kind of a fatal error
            self._status = 500
            logging.getLogger(__name__).error(u'%s\n%s' % (e, ''.join(self.get_traceback())))
            if settings.is_debug_mode():
                named_args['message'] = ('error', u'%s' % e)
            else:
                named_args['message'] = ('error',
                                         _('Failed to process your request. '
                                                'Please try again later or contact system support.'))
            named_args['message_auto_hide_interval'] = 0
            named_args['next_url'] = '%sfirst_form' % self.get_root_url()
            methodname, tmpl, result = self.process_method('message', path, named_args)
            plugins.db.recover()

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
        except:
            pass
        return self._export_status(), headers, ans_body

    def process_method(self, methodname, pos_args, named_args, tpl_data=None):
        """
        This method handles mapping between HTTP actions and CGIPublisher's methods

        Returns
        -------
        result : tuple of 3 elements
          0 = method name
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
        if not hasattr(self, methodname):
            if methodname.endswith('_form'):
                tpl_data = {}
                return methodname[:-5], methodname + '.tmpl', tpl_data
            else:
                raise Exception('unknown method: "%s" dict:%s' % (methodname,
                                                                  self.__dict__))
        method = getattr(self, methodname)
        try:
            return (methodname,
                    getattr(method, 'template', methodname + '.tmpl'),
                    self._invoke_action(method, pos_args, named_args, tpl_data))
        except Exception as e:
            logging.getLogger(__name__).error(''.join(self.get_traceback()))

            return_type = self._get_method_metadata(methodname, 'return_type')
            if return_type == 'json':
                if settings.is_debug_mode() or type(e) is UserActionException:
                    json_msg = str(e).decode('utf-8')
                else:
                    json_msg = _('Failed to process your request. '
                                      'Please try again later or contact system support.')
                return (methodname, None,
                        {'error': json_msg})
            if not self.exceptmethod and self.is_template(methodname + '_form'):
                tpl_data['message'] = ('error', e.message if type(e.message) == unicode else e.message.decode('utf-8'))
                self.exceptmethod = methodname + '_form'
            if settings.is_debug_mode() or not self.exceptmethod:
                   raise e

            self.error = e.message if type(e.message) == unicode else e.message.decode('utf-8')
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

        ans = []

        for k in sorted(self._headers.keys()):
            if self._headers[k]:
                ans.append((k, self._headers[k]))
        # Cookies
        if self._cookies:
            ans.extend([('Set-Cookie', v.OutputString()) for v in self._cookies.values()])   # cookies
        return ans

    def output_result(self, methodname, template, result, action_metadata, outf,
                      return_template=False):
        """
        Renders response body
        """
        from Cheetah.Template import Template
        # JSON
        if action_metadata.get('return_type') == 'json':
            if type(result) != JsonEncodedData:
                json.dump(self.rec_recode(result, utf8_out=True), outf)
            else:
                # TODO
                print >> outf, result  # this is obsolete
        # Template
        elif type(result) is DictType:
            self._add_globals(result)
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
        return not self._session_get('user', 'id')

    def nop(self):
        """
        Represents an empty operation. This is sometimes required
        to keep the controller in a consistent state. E.g. if a redirect
        is requested soon, some operation still must be set.
        """
        return None

    def message(self, *args, **kwargs):
        return kwargs

    message.accept_kwargs = True

    def json_error(self, error='', reset=False):
        """
        Error page
        """
        return {'error': {'message': error, 'reset': reset}}
    json_error.return_type = 'json'

    def get_traceback(self):
        """
        Returns python-generated traceback information
        """
        import traceback

        err_type, err_value, err_trace = sys.exc_info()
        return traceback.format_exception(err_type, err_value, err_trace)
