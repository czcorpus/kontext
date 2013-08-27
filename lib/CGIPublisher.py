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
import cgi
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


def choose_selector(args, selector):
    selector += ':'
    s = len(selector)
    for n, v in [(n[s:], v) for n, v in args.items() if n.startswith(selector)]:
        args[n] = v


def q_help(page, lang): # html code for context help
    return "<a onclick=\"window.open('http://www.sketchengine.co.uk/help.cgi?page=" \
           + page + ";lang=" + lang \
           + "','help','width=500,height=300,scrollbars=yes')\" class=\"help\">[?]</a>"


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
    _user_settings = {}
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
    _login_address = u'' # e.g. 'http://beta.sketchengine.co.uk/login'
    menupos = ''
    user = None

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
        self._user = self._session['user']['user']

        if self._session['user']['id'] is not None:
            self._anonymous = 0
        else:
            self._user = None
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


    def get_user_settings(self):
        """
        Loads user settings from cookie

        Returns
        -------

        user_settings : dict
           a dictionary containing all values stored as a JSON string in user_settings cookie
        """
        return json.loads(self._cookies['user_settings'].value) if 'user_settings' in self._cookies else {}

    def get_uilang(self, locale_dir):
        """
        loads user language from user settings or from browser's configuration
        """
        user_settings = self.get_user_settings()
        if 'uilang' in user_settings:
            lgs_string = user_settings['uilang']
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
            if lg.startswith('en'): # english
                return ''
            for lgdir in lgdirs:
                if lgdir.lower().startswith(lg):
                    return lgdir
        return ''

    def init_locale(self):

        # locale
        locale_dir = '../locale/'  # TODO
        if not os.path.isdir (locale_dir):
            p = os.path.join (os.path.dirname (__file__), locale_dir)
            if os.path.isdir (p):
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

    def parse_parameters(self, selectorname=None,
                         environ=os.environ, post_fp=None):
        self.environ = environ

        named_args = self.get_user_settings()
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
                named_args[str(k)] = self.recode_input(form.getvalue(k))
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

    def redirect(self, url, code=303):
        self._headers.clear()
        self._headers['Location'] = url

    def get_http_method(self):
        return os.getenv('REQUEST_METHOD', '')

    def _pre_dispatch(self):
        """
        Allows some operations to be done before the action itself is processed
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

        if self._user is None and path[0] not in ('login', 'loginx'):
            self.redirect('login')

        try:
            self._pre_dispatch()

            named_args = self.parse_parameters(selectorname)
            methodname, tmpl, result = self.process_method(path[0], path, named_args)

            if hasattr(self, '_user_settings'):
                user_settings = getattr(self, '_user_settings')
            else:
                user_settings = {}
            log_request(user_settings, '%s' % methodname)

            return_type = self.get_method_metadata(methodname, 'return_type')
            cont = self.output_headers(return_type)
            if cont:
                self.output_result(methodname, tmpl, result, return_type)

            if plugins.has_plugin('sessions'):
                plugins.sessions.save(self._get_session_id(), self._session)

        except Exception as e:
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

            return_type = self.get_method_metadata(path[0], 'return_type')
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

            return_type = self.get_method_metadata(methodname, 'return_type')
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
        user_settings = {}
        for k in self._user_settings:
            if k in self.__dict__:
                user_settings[k] = self.__dict__[k]
        self._cookies['user_settings'] = json.dumps(user_settings)
        self._cookies['user_settings']['path'] = self.environ.get('SCRIPT_NAME', '/')

        if return_type == 'json':
            self._headers['Content-Type'] = 'text/x-json'

        if outf:
            # Headers
            if 'Location' in self._headers:
                outf.write('Location: %s\n' % self._headers['Location'])
                has_body = False
            for k in sorted(self._headers.keys()):
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
            self.add_undefined(result, methodname)
            result = self.rec_recode(result)
            custom_attributes = [a for a in CGIPublisher.__dict__.keys() if not a.startswith('__')
                                 and not a.endswith('__')]
            for attr in custom_attributes:  # recoding self
                setattr(self, attr, self.rec_recode(getattr(self, attr)))

            if template.endswith('.tmpl'):
                class_name = template[:-5]  # appropriate module import
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

    def methods(self, params=0):
        """
        Lists all the methods with a doc string
        """
        methodlist = []
        cldict = self.__class__.__dict__
        for m in [x for x in cldict.keys() if not x.startswith('_') and hasattr(cldict[x], '__doc__')
                  and callable(cldict[x])]:
            mm = {'name': m, 'doc': cldict[m].__doc__}
            if params:
                try:
                    mm['Params'] = [{'name': v}
                                    for v in cldict[m].func_code.co_varnames[1:]]
                except AttributeError:
                    pass
            methodlist.append(mm)
        return {'List': methodlist}

    methods.template = """<html><head><title>Methods</title></head><body><ul>
        #for $l in $List
           <li><b>$l.name</b>(
               #set $sep = ''
               #for $p in $l.get('Params',[])
                  $sep$p.name
                  #set $sep = ', '
               #end for
                )<br>$l.doc<br>
        #end for
        </ul></body></html>
        """
