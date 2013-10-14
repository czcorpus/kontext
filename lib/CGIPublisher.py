# Copyright (c) 2003-2009  Pavel Rychly
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

import __builtin__
import os
import sys
import re
from types import MethodType, StringType, DictType, ListType, TupleType, UnicodeType
from inspect import isclass
import Cookie
import codecs
import imp
from urllib import urlencode, quote_plus, unquote, quote
import json
import logging
import gettext
import locale

import plugins
import settings
import auth


def replace_dot_error_handler(err):
    return u'.', err.end

codecs.register_error('replacedot', replace_dot_error_handler)


def function_defaults(fun):
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


def correct_types(args, defaults, del_nondef=0, selector=0):
    corr_func = {type(0): int, type(0.0): float, ListType: lambda x: [x]}
    for full_k, v in args.items():
        if selector:
            k = full_k.split(':')[-1]  # filter out selector
        else:
            k = full_k
        if k.startswith('_') or type(defaults.get(k, None)) is MethodType:
            del args[full_k]
        elif defaults.has_key(k):
            default_type = type(defaults[k])
            if default_type is not ListType and type(v) is ListType:
                args[k] = v = v[-1]
            if type(v) is not default_type:
                try:
                    args[full_k] = corr_func[default_type](v)
                except:
                    pass
        else:
            if del_nondef:
                del args[full_k]
    return args


def q_help(page, lang):  # html code for context help
    return "<a onclick=\"window.open('http://www.sketchengine.co.uk/help.cgi?page=" \
           + page + ";lang=" + lang \
           + "','help','width=500,height=300,scrollbars=yes')\" class=\"help\">[?]</a>"


class BonitoCookie(Cookie.BaseCookie):
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


class CGIPublisher(object):
    """
    This object serves as a controller of the application. It handles action->method mapping,
    target method processing, result rendering, generates required http headers etc.
    """
    _headers = {'Content-Type': 'text/html; charset=utf-8'}
    _keep_blank_values = 0
    _template_dir = u'../cmpltmpl/'
    _locale_dir = u'../locale/'
    _tmp_dir = u'/tmp'
    _url_parameters = []
    exceptmethod = None
    debug = None
    precompile_template = 1
    format = u''
    uilang = u''
    reload = 0
    _has_access = 1
    _anonymous = 0
    menupos = ''
    user = None

    NO_OPERATION = 'nop'

    def __init__(self, environ=os.environ):
        self.environ = environ
        self.headers_sent = False
        self._cookies = BonitoCookie(self.environ.get('HTTP_COOKIE', ''))
        self._session = {}

        # correct _locale_dir
        if not os.path.isdir(self._locale_dir):
            p = os.path.join(os.path.dirname(__file__), self._locale_dir)
            if os.path.isdir(p):
                self._locale_dir = p
            else:
                import gettext
                # This will set the system default locale directory as a side-effect:
                gettext.install(domain='ske', unicode=True)
                # hereby we retrieve the system default locale directory back:
                self._locale_dir = gettext.bindtextdomain('ske')

        # correct _template_dir
        if not os.path.isdir(self._template_dir):
            self._template_dir = imp.find_module('cmpltmpl')[1]

    def _init_session(self):
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

    def _session_get(self, *nested_keys):
        """
        Retrieves a value from session dictionary. If no such value is found
        then None is returned. More than one key is understood as a 'path' of
        a nested dictionaries.
        """
        curr = self._session
        for k in nested_keys:
            if k in curr:
                curr = curr[k]
            else:
                return None
        return curr

    def _get_session_id(self):
        if settings.get('plugins', 'auth')['auth_cookie_name'] in self._cookies:
            return self._cookies[settings.get('plugins', 'auth')['auth_cookie_name']].value
        return None

    def _set_session_id(self, val):
        self._cookies[settings.get('plugins', 'auth')['auth_cookie_name']] = val

    def _from_session(self, *keys):
        curr = self._session
        for k in keys:
            if k in curr:
                curr = curr[k]
            else:
                return None
        return curr

    def get_uilang(self, locale_dir):
        """
        loads user language from user settings or from browser's configuration
        """
        if 'uilang' in self._session:
            lgs_string = self._session['uilang']
        elif 'ui_settings' in self._cookies:
            ui_settings = json.loads(self._cookies['ui_settings'].value)
            lgs_string = ui_settings.get('set_uilang', None)
        else:
            lgs_string = None
        if not lgs_string:
            lgs_string = os.environ.get('HTTP_ACCEPT_LANGUAGE', '')
        if lgs_string == '':
            return ''  # english
        lgs_string = re.sub(';q=[^,]*', '', lgs_string)
        lgs = lgs_string.split(',')
        lgdirs = os.listdir(locale_dir)
        for lg in lgs:
            lg = lg.replace('-', '_').lower()
            if lg.startswith('en'):  # english
                return ''
            for lgdir in lgdirs:
                if lgdir.lower().startswith(lg):
                    return lgdir
        return ''

    def init_locale(self):
        # locale
        locale_dir = '../locale/'  # TODO
        if not os.path.isdir(locale_dir):
            p = os.path.join(os.path.dirname(__file__), locale_dir)
            if os.path.isdir(p):
                locale_dir = p
            else:
                # This will set the system default locale directory as a side-effect:
                gettext.install(domain='ske', unicode=True)
                # hereby we retrieve the system default locale directory back:
                locale_dir = gettext.bindtextdomain('ske')

        os.environ['LANG'] = self.get_uilang(locale_dir)
        settings.set('session', 'lang', os.environ['LANG'] if os.environ['LANG'] else 'en')
        os.environ['LC_ALL'] = os.environ['LANG']
        formatting_lang = '%s.utf-8' % (os.environ['LANG'] if os.environ['LANG'] else 'en_US')
        locale.setlocale(locale.LC_ALL, formatting_lang)
        translat = gettext.translation('ske', locale_dir, fallback=True)
        try:
            translat._catalog[''] = ''
        except AttributeError:
            pass
        __builtin__.__dict__['_'] = translat.ugettext

    def is_template(self, template):
        try:
            imp.find_module(template, [self._template_dir])
            return True
        except ImportError:
            return False

    def _setup_user_paths(self, user_file_id):
        if not self._anonymous:
            self.subcpath.append('%s/%s' % (settings.get('corpora', 'users_subcpath'), user_file_id))
        self._conc_dir = '%s/%s' % (settings.get('corpora', 'conc_dir'), user_file_id)
        self._wseval_dir = '%s/%s' % (settings.get('corpora', 'wseval_dir'), user_file_id)

    def _setup_action_params(self, actions=None):
        """
        Sets-up parameters related to processing of current action.
        This typically includes concordance-related values (to be able to keep the state),
        user's options etc.

        Parameters
        ----------
        actions : callable
            a function taking a single parameter (a dictionary) which can can be used
            to alter some of the parameters
        """
        options = {}
        if self._user:
            user_file_id = self._user
        else:
            user_file_id = 'anonymous'
        plugins.settings_storage.load(self._session_get('user', 'id'), options)
        correct_types(options, self.clone_self(), selector=1)
        if callable(actions):
            actions(options)
        self._setup_user_paths(user_file_id)
        self.__dict__.update(options)

    def _save_options(self, optlist=[], selector=''):
        """
        Saves user's options to a storage
        """
        if selector:
            tosave = [(selector + ':' + opt, self.__dict__[opt])
                      for opt in optlist if opt in self.__dict__]
        else:
            tosave = [(opt, self.__dict__[opt]) for opt in optlist
                      if opt in self.__dict__]
        options = {}
        plugins.settings_storage.load(self._session_get('user', 'id'), options)
        options.update(tosave)
        if not self._anonymous:
            plugins.settings_storage.save(self._session_get('user', 'id'), options)
        else:
            pass  # TODO save to the session

    def self_encoding(self):
        return 'iso-8859-1'

    def _add_undefined(self, result, methodname):
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

    def call_method(self, method, args, named_args, tpl_data=None):
        na = named_args.copy()
        if hasattr(method, 'accept_kwargs') and getattr(method, 'accept_kwargs') is True:
            del_nondef = 0
        else:
            del_nondef = 1
        correct_types(na, function_defaults(method), del_nondef=del_nondef)
        ans = apply(method, args[1:], na)
        if type(ans) == dict and tpl_data is not None:
            ans.update(tpl_data)
        return ans

    def call_function(self, func, args, **named_args):
        na = self.clone_self()
        na.update(named_args)
        correct_types(na, function_defaults(func), 1)
        return apply(func, args, na)

    def clone_self(self):
        na = {}
        for a in dir(self) + dir(self.__class__):
            if not a.startswith('_') and not callable(getattr(self, a)):
                na[a] = getattr(self, a)
        return na

    def _get_method_metadata(self, method_name, data_name):
        if hasattr(self, method_name) and hasattr(getattr(self, method_name), data_name):
            return getattr(getattr(self, method_name), data_name)
        return None

    def import_req_path(self):
        """
        Parses PATH_INFO into a list of elements

        Returns
        -------
        list of path elements
        """
        path = os.getenv('PATH_INFO', '').strip().split('/')[1:]
        if len(path) is 0 or path[0] is '':
            path = [CGIPublisher.NO_OPERATION]
        elif path[0].startswith('_'):
            raise Exception('access denied')
        return path

    def _redirect(self, url, code=303):
        self._headers.clear()
        self._headers['Location'] = url

    def _set_not_found(self):
        self._headers.clear()
        self._headers[''] = 'Status: 404'

    def get_http_method(self):
        return os.getenv('REQUEST_METHOD', '')

    def _get_persistent_attrs(self):
        return []

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

    def run_unprotected(self, path=None, selectorname=None):
        """
        Runs an HTTP-mapped action in a mode which does wrap
        error processing (i.e. it may throw an exception).
        """
        tmpl = None
        methodname = None
        self.init_locale()
        self._init_session()

        if path is None:
                path = self.import_req_path()

        try:
            named_args = {}

            action_metadata = {
                'return_type': self._get_method_metadata(path[0], 'return_type'),
                'template': self._get_method_metadata(path[0], 'template')
            }
            path, selectorname, named_args = self._pre_dispatch(path, selectorname, named_args, action_metadata)
            methodname, tmpl, result = self.process_method(path[0], path, named_args)
            self._post_dispatch(methodname, tmpl, result)

            cont = self.output_headers(action_metadata.get('return_type', None))
            if cont:
                self.output_result(methodname, tmpl, result, action_metadata.get('return_type', None))

            if plugins.has_plugin('sessions'):
                plugins.sessions.save(self._get_session_id(), self._session)

        except Exception as e:
            import logging
            logging.getLogger(__name__).error(u'%s\n%s' % (e, ''.join(self.get_traceback())))
            raise RequestProcessingException(e.message, tmpl=tmpl, methodname=methodname)

    def run(self, path=None, selectorname=None):
        """
        This method wraps run_unprotected by try-except clause and presents
        only brief error messages to the user.
        """
        if path is None:
            path = self.import_req_path()
        try:
            self.run_unprotected(path, selectorname)
        except Exception as err:
            from Cheetah.Template import Template
            from cmpltmpl import error_message

            return_type = self._get_method_metadata(path[0], 'return_type')
            if not self.headers_sent:
                self._headers[''] = 'Status:HTTP/1.1 500 Internal Server Error'
                self.output_headers(return_type=return_type)
                self.headers_sent = True

            if settings.is_debug_mode() or type(err) is UserActionException:
                message = u'%s' % err
            elif type(err) is auth.AuthException:
                message = err.message
            else:
                message = _('Failed to process your request. Please try again later or contact system support.')

            if return_type == 'json':
                print(json.dumps({'error': self.rec_recode('%s' % err, 'utf-8', True)}))
            else:
                tpl_data = {
                    'message': message,
                    'corp_full_name': '?',
                    'corplist_size': '?',
                    'Corplist': [],
                    'corp_description': '',
                    'corp_size': '',
                    'mode_included': bool(getattr(err, 'tmpl', False)),
                    'method_name': getattr(err, 'methodname', '')
                }
                error_message.error_message(searchList=[tpl_data, self]).respond(CheetahResponseFile(sys.stdout))

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
                    self.call_method(method, pos_args, named_args, tpl_data))
        except Exception as e:
            logging.getLogger(__name__).error(''.join(self.get_traceback()))

            return_type = self._get_method_metadata(methodname, 'return_type')
            if return_type == 'json':
                if settings.is_debug_mode() or type(e) is UserActionException:
                    json_msg = u'%s' % e
                else:
                    json_msg = _('Failed to process your request. Please try again later or contact system support.')
                return (methodname, None,
                        {'error': json_msg})
            if not self.exceptmethod and self.is_template(methodname + '_form'):
                tpl_data['error'] = e.message if type(e.message) == unicode else e.message.decode('utf-8')
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
                if key in ['corp_full_name', 'Corplist']:
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
        if type(key_val_pairs) is UnicodeType: # urllib.quote does not support unicode
            key_val_pairs = key_val_pairs.encode("utf-8")
        if type(key_val_pairs) is StringType:
            # mapping strings
            return quote_plus(key_val_pairs)
        return urlencode([(k, self.rec_recode(v, enc, utf8_out=True))
                          for (k, v) in key_val_pairs])

    def output_headers(self, return_type='html', outf=sys.stdout):
        """
        Generates proper content-type signature and
        creates a cookie to store user's settings

        Returns
        -------
        bool : True if content should follow else False
        """
        has_body = True

        # The 'ui_settings' cookie is used only by JavaScript client-side code
        # which always expects the cookie to exists.
        if not 'ui_settings' in self._cookies:
            self._cookies['ui_settings'] = json.dumps({})
            self._cookies['ui_settings']['path'] = self.environ.get('SCRIPT_NAME', '/')

        if return_type == 'json':
            self._headers['Content-Type'] = 'text/x-json'

        if outf:
            if '' in self._headers:
                outf.write(self._headers[''])
            # Headers
            if 'Location' in self._headers:
                outf.write('Location: %s\n' % self._headers['Location'])
                has_body = False
            for k in sorted(self._headers.keys()):
                if self._headers[k]:
                    outf.write('%s: %s\n' % (k, self._headers[k]))
            # Cookies
            if self._cookies and outf:
                outf.write(self._cookies.output() + '\n')
            outf.write('\n')

        self.headers_sent = True
        return has_body

    def output_result(self, methodname, template, result, return_type, outf=sys.stdout,
                      return_template=False):
        from Cheetah.Template import Template
        # JSON
        if return_type == 'json':
            if type(result) != JsonEncodedData:
                json.dump(self.rec_recode(result, utf8_out=True), outf)
            else:
                print >> outf, result  # this is obsolete

        # Template
        elif type(result) is DictType:
            self._add_globals(result)
            self._add_undefined(result, methodname)
            result = self.rec_recode(result)
            custom_attributes = [a for a in CGIPublisher.__dict__.keys() if not a.startswith('__')
                                 and not a.endswith('__')]
            for attr in custom_attributes:  # recoding self
                setattr(self, attr, self.rec_recode(getattr(self, attr)))

            if template.endswith('.tmpl'):
                class_name = template[:-5]  # appropriate module import
                file, pathname, description = imp.find_module(class_name, [self._template_dir])
                module = imp.load_module(class_name, file, pathname, description)
                TemplateClass = getattr(module, class_name)
                result = TemplateClass(searchList=[result, self])
            else:
                result = Template(template, searchList=[result, self])
            if return_template:
                return result
            result.respond(CheetahResponseFile(outf))

        # Image
        elif hasattr(result, '__module__') and result.__module__ == 'Image':
            img_type = self._headers['Content-Type'].split('/')[1]
            result.save(outf, img_type)

        # Other (string)
        else:
            outf.write(str(result))

    def _user_is_anonymous(self):
        return not self._session_get('user', 'id')

    def nop(self):
        """
        Represents an empty operation. This is sometimes required
        to keep the controller in a consistent state. E.g. if a redirect
        is requested soon, some method must be set.
        """
        return None

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
