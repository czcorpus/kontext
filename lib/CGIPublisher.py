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
from lib2to3.fixes.fix_urllib import FixUrllib

import os
import sys
import cgi
from types import MethodType, StringType, DictType, ListType, TupleType, UnicodeType
from inspect import isclass
import Cookie
import codecs
import imp
from urllib import urlencode, quote_plus, unquote, quote
import json
import logging

import settings


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


def choose_selector(args, selector):
    selector += ':'
    s = len(selector)
    for n, v in [(n[s:], v) for n, v in args.items() if n.startswith(selector)]:
        args[n] = v


def q_help(page, lang): # html code for context help
    return "<a onclick=\"window.open('http://www.sketchengine.co.uk/help.cgi?page=" \
           + page + ";lang=" + lang \
           + "','help','width=500,height=300,scrollbars=yes')\" class=\"help\">[?]</a>"


def load_user_settings_cookie(cookie_data):
    """
    Loads user settings from cookies

    Parameters
    ----------

    cookie_data : str
       raw cookie data

    Returns
    -------

    user_settings : dict
       a dictionary containing all values stored as a JSON string in user_settings cookie
    """
    ck = BonitoCookie(cookie_data)
    return json.loads(ck['user_settings'].value) if ck.has_key('user_settings') else {}


def log_request(user_settings, action_name):
    """
    Logs user's request by storing URL parameters, user settings and user name

    Parameters
    ----------
    user_settings: dict
        settings stored in user's cookie
    action_name: str
        name of the action
    """
    import json
    import datetime

    ans = {
        'date': datetime.datetime.today().strftime('%Y-%m-%d %H:%M:%S'),
        'action': action_name,
        'user': os.getenv('REMOTE_USER'),
        'params': dict([item.split('=', 1) for item in [x for x in os.getenv('QUERY_STRING').split('&') if x]]),
        'settings': user_settings
    }
    logging.getLogger('QUERY').info(json.dumps(ans))


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
        return self.data.get(key, None)

    def __setitem__(self, key, value):
        self.data[key] = value


class CheetahResponseFile:
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


class AuthException(UserActionException):
    pass


class CGIPublisher:
    """
    This object serves as a controller of the application. It handles action->method mapping,
    target method processing, result rendering, generates required http headers etc.
    """
    _headers = {'Content-Type': 'text/html; charset=utf-8'}
    _keep_blank_values = 0
    _user_settings = {}
    _template_dir = u'../cmpltmpl/'
    _locale_dir = u'../locale/'
    _tmp_dir = u'/tmp'
    _corpus_architect = 0
    _url_parameters = []
    exceptmethod = None
    debug = None
    precompile_template = 1
    format = u''
    uilang = u''
    reload = 0
    _has_access = 1
    _anonymous = 0
    _authenticated = 0
    _login_address = u'' # e.g. 'http://beta.sketchengine.co.uk/login'
    menupos = ''

    def __init__(self, environ=os.environ):
        self.environ = environ
        self.headers_sent = False

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

    def is_template(self, template):
        try:
            imp.find_module(template, [self._template_dir])
            return True
        except ImportError:
            return False

    def preprocess_values(self, form):
        pass

    def _setup_user(self, user=None, corpname=''):
        pass

    def self_encoding(self):
        return 'iso-8859-1'

    def _set_defaults(self):
        pass

    def _correct_parameters(self):
        pass

    def add_undefined(self, result, methodname):
        pass

    def _add_globals(self, result):
        ppath = self.environ.get('REQUEST_URI', '/')
        try:
            ppath = ppath[:ppath.index('?')]
            ppath = ppath[:ppath.rindex('/')]
        except ValueError:
            pass
        result['hrefbase'] = self.environ.get('HTTP_HOST', '') + ppath

    def call_method(self, method, args, named_args, tpl_data=None):
        na = named_args.copy()
        correct_types(na, function_defaults(method), 1)
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

    def parse_parameters(self, selectorname=None,
                         environ=os.environ, post_fp=None):
        self.environ = environ
        named_args = load_user_settings_cookie(environ.get('HTTP_COOKIE', ''))
        self._user_settings.update(named_args)
        form = cgi.FieldStorage(keep_blank_values=self._keep_blank_values,
                                environ=self.environ, fp=post_fp)
        self.preprocess_values(form)  # values needed before recoding
        self._setup_user(self.corpname)
        if 'json' in form:
            json_data = json.loads(form.getvalue('json'))
            named_args.update(json_data)
        for k in form.keys():
            self._url_parameters.append(k)
            # must remove empty values, this should be achieved by
            # keep_blank_values=0, but it does not work for POST requests
            if len(form.getvalue(k)) > 0 and not self._keep_blank_values:
                key = str(k)
                val = self.recode_input(form.getvalue(k))
                if key.startswith('sca_') and val == settings.get('corpora', 'empty_attr_value_placeholder'):
                    val = ''
                named_args[key] = val
        if self._corpus_architect:
            try:
                del named_args['corpname']
            except KeyError:
                pass
        na = named_args.copy()
        correct_types(na, self.clone_self())
        if selectorname:
            choose_selector(self.__dict__, getattr(self, selectorname))
        self._set_defaults()
        self.__dict__.update(na)
        self._correct_parameters()
        return named_args

    def get_method_metadata(self, method_name, data_name):
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
            path = ['methods']
        elif path[0].startswith('_'):
            raise Exception('access denied')
        return path

    def run_unprotected(self, path=None, selectorname=None):
        """
        Runs an HTTP-mapped action in a mode which may throw an exception.
        """
        tmpl = None
        methodname = None
        try:
            if len(self.corplist) == 0 or not self.corplist:
                raise AuthException(_('You do not have an access to any corpus.'))

            if path is None:
                path = self.import_req_path()
            named_args = self.parse_parameters(selectorname)
            methodname, tmpl, result = self.process_method(path[0], path, named_args)

            if hasattr(self, '_user_settings'):
                user_settings = getattr(self, '_user_settings')
            else:
                user_settings = {}
            log_request(user_settings, '%s' % methodname)

            return_type = self.get_method_metadata(methodname, 'return_type')
            self.output_headers(return_type)
            self.output_result(methodname, tmpl, result, return_type)
        except Exception as e:
            logging.getLogger(__name__).error(u'%s\n%s' % (e, ''.join(self.get_traceback())))
            raise RequestProcessingException(e.message, tmpl=tmpl, methodname=methodname, parent_err=e)

    def run(self, path=None, selectorname=None):
        """
        This method wraps run_unprotected by try-except clause and presents
        only brief error messages to the user.
        """
        if path is None:
            path = self.import_req_path()
        try:
            self.run_unprotected(path, selectorname)
        except RequestProcessingException as err:
            from Cheetah.Template import Template
            from cmpltmpl import error_message

            return_type = self.get_method_metadata(path[0], 'return_type')
            if not self.headers_sent:
                self.output_headers(return_type=return_type)
                self.headers_sent = True
            import logging
            logging.getLogger(__name__).info(err.__class__)
            if settings.is_debug_mode() or isinstance(err['parent_err'], UserActionException):
                message = u'%s' % err
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
                    'mode_included': bool(err['tmpl']),
                    'method_name': err['methodname']
                }
                error_message.error_message(searchList=[tpl_data, self]).respond(CheetahResponseFile(sys.stdout))

    def process_method(self, methodname, pos_args, named_args, tpl_data=None):
        """
        This method handles mapping between HTTP actions and CGIPublisher's methods
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

            return_type = self.get_method_metadata(methodname, 'return_type')
            if return_type == 'json':
                if settings.is_debug_mode() or isinstance(e, UserActionException):
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

    def recode_input(self, x, decode=1):  # converts query into corpencoding
        if self._corpus_architect and decode: return x
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
        """
        cookies = BonitoCookie()
        user_settings = {}
        for k in self._user_settings:
            if k in self.__dict__:
                user_settings[k] = self.__dict__[k]
        cookies['user_settings'] = json.dumps(user_settings)
        cookies['user_settings']['path'] = self.environ.get('SCRIPT_NAME', '/')
        if cookies and outf:
            outf.write(cookies.output() + '\n')
            pass

        # Headers
        if return_type == 'json':
            self._headers['Content-Type'] = 'text/x-json'
        if outf:
            for k, v in self._headers.items():
                outf.write('%s: %s\n' % (k, v))
            outf.write('\n')
        self.headers_sent = True
        return cookies, self._headers

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
            self.add_undefined(result, methodname)
            result = self.rec_recode(result)
            for attr in dir(self): # recoding self
                setattr(self, attr, self.rec_recode(getattr(self, attr)))

            if template.endswith('.tmpl'):
                class_name = template[:-5] # appropriate module import
                file, pathname, description = \
                    imp.find_module(class_name, [self._template_dir])
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

    def get_traceback(self):
        """
        Returns python-generated traceback information
        """
        import traceback

        err_type, err_value, err_trace = sys.exc_info()
        return traceback.format_exception(err_type, err_value, err_trace)