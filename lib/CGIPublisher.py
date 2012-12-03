# Copyright (c) 2003-2009  Pavel Rychly

import os, sys, cgi
from types import MethodType, TypeType, StringType, DictType, ListType, TupleType
from inspect import isclass
import Cookie
import codecs
import imp
import urllib
import simplejson

# According to Cheetag changelog, Cheetah should use Unicode in its internals since version 2.2.0
# If you experience it also in any previous version, change it here:
# NOTE: YOU MUST RECOMPILE TEMPLATES WHEN SWITCHING FROM A VERSION < 2.2.0 TO A VERSION >= 2.2.0 OR VICE VERSA
try:
    from Cheetah import VersionTuple
    major, minor, bugfix, _status, _statusNr = VersionTuple
except ImportError:
    from Cheetah import Version
    try: major, minor, bugfix = map(int, Version.split("."))
    except ValueError: major, minor, bugfix = 0, 0, 0 # 2.0rc8 ;-)
if (major, minor, bugfix) >= (2, 2, 0):
    has_cheetah_unicode_internals = True
else:
    has_cheetah_unicode_internals = False

def replace_dot_error_handler (err):
    return u'.', err.end

codecs.register_error ('replacedot', replace_dot_error_handler)

def function_defaults (fun):
    defs = {}
    if isclass (fun):
        fun = fun.__init__
    try:
        dl = fun.func_defaults or ()
    except AttributeError:
        return {}
    nl = fun.func_code.co_varnames
    for a,v in zip (nl [fun.func_code.co_argcount - len(dl):], dl):
        defs [a] = v
    return defs

def correct_types (args, defaults, del_nondef=0, selector=0):
    corr_func = {type(0): int, type(0.0): float, ListType: lambda x: [x]}
    for full_k, v in args.items():
        if selector:
            k = full_k.split(':')[-1] # filter out selector
        else:
            k = full_k
        if k.startswith('_') or type (defaults.get (k,None)) is MethodType:
            del args[full_k]
        elif defaults.has_key(k):
            default_type = type (defaults[k])
            if default_type is not ListType and type(v) is ListType:
                args[k] = v = v[-1]
            if type(v) is not default_type:
                try:
                    args[full_k] = corr_func[default_type](v)
                except: pass
        else:
            if del_nondef:
                del args[full_k]
    return args

def choose_selector (args, selector):
    selector += ':'
    s = len (selector)
    for n,v in [(n[s:],v) for n,v in args.items() if n.startswith (selector)]:
        args [n] = v

def q_help(page, lang): # html code for context help
   return "<a onclick=\"window.open('http://www.sketchengine.co.uk/help.cgi?page=" \
   + page + ";lang=" + lang \
   + "','help','width=500,height=300,scrollbars=yes')\" class=\"help\">[?]</a>"


class CheetahResponseFile:
    def __init__(self, outfile):
        if has_cheetah_unicode_internals:
            outfile = codecs.getwriter("utf-8")(outfile)
        self.outfile = outfile
    def response(self):
        return self.outfile

class CGIPublisher:

    _headers = {'Content-Type': 'text/html; charset=utf-8'}
    _keep_blank_values = 0
    _cookieattrs = []
    _template_dir = 'cmpltmpl'
    _tmp_dir = '/tmp'
    _corpus_architect = 0
    exceptmethod = None
    debug = None
    precompile_template = 1
    format = ''

    def __init__ (self, environ=os.environ):
        self.environ = environ

        # correct _template_dir
        if not os.path.isdir (self._template_dir):
            self._template_dir = imp.find_module('cmpltmpl')[1]
        
    def is_template (self, template):
        try:
            imp.find_module(template, [self._template_dir])
            return True
        except ImportError:
            return False

    def preprocess_values(self, form):
        pass

    def self_encoding(self):
        return 'iso-8859-1'

    def _set_defaults (self):
        pass

    def _correct_parameters (self):
        pass

    def add_undefined (self, result, methodname):
        pass

    def _add_globals(self, result):
        ppath = self.environ.get ('REQUEST_URI','/')
        try:
            ppath = ppath [:ppath.index ('?')]
            ppath = ppath [:ppath.rindex ('/')]
        except ValueError:
            pass
        result ['hrefbase'] = self.environ.get ('HTTP_HOST', '') + ppath

    def call_method (self, method, args, named_args):
        na = named_args.copy()
        correct_types (na, function_defaults (method), 1)
        #print >> sys.stderr, 'CGIPublisher: call_method %s %s %s' % \
        #      (method, args[1:], na)
        return apply (method, args[1:], na)
        
    def call_function (self, func, args, **named_args):
        na = self.clone_self()
        na.update (named_args)
        correct_types (na, function_defaults (func), 1)
        #print >> sys.stderr, 'CGIPublisher: call_function %s %s %s %i' % \
        #      (func, args, na, isclass(func))
        return apply (func, args, na)

    def clone_self (self):
        na = {}
        for a in dir(self) + dir(self.__class__):
            if not a.startswith('_') and not callable (getattr (self, a)):
                na[a] = getattr (self, a)
        return na


    def parse_parameters (self, selectorname=None, cookies=None, 
                          environ=os.environ, post_fp=None):
        self.environ = environ
        named_args = {}
        if cookies:
            named_args.update(cookies)
        else:
            ck = Cookie.SimpleCookie(self.environ.get('HTTP_COOKIE',''))
            for k,v in ck.items():
                named_args[k] = v.value
        form = cgi.FieldStorage(keep_blank_values=self._keep_blank_values,
                                environ=self.environ, fp=post_fp)
        return self.finish_parse_parameters(form, selectorname, named_args)


    def parse_parameters_django (self, selectorname=None, request=None):
        self.environ = request.META
        named_args = {}
        named_args.update(request.COOKIES)

        class FakeFieldStorage(dict):
            def keys(self):
                for key in super(FakeFieldStorage, self).keys():
                    if self[key] != []:
                        yield key
            def getvalue(self, key, default=None):
                if not self.has_key(key) or self[key] == []:
                    return default
                elif len(self[key]) == 1:
                    return self[key][0]
                else:
                    return self[key]

        form = FakeFieldStorage()
        if request:
            for get_post in (request.GET, request.POST):
                for k,l in get_post.lists():
                    str_k = str(k)
                    form[str_k] = []
                    for x in l:
                        if x in ['', u'']: continue
                        if isinstance(x, unicode):
                            form[str_k].append(x.encode('utf-8'))
                        else:
                            form[str_k].append(x)
            for k,fp in request.FILES.iteritems():
                form[str(k)] = [fp.read()]
        return self.finish_parse_parameters(form, selectorname, named_args)


    def finish_parse_parameters(self, form, selectorname, named_args):
        self.preprocess_values(form) # values needed before recoding
        if form.has_key ('json'):
            json_data = simplejson.loads(form.getvalue('json')) # in utf8
            for k, l in json_data.iteritems():
                str_k = str(k)
                named_args[str_k] = []
                if isinstance(l, ListType):
                    for x in l:
                        if x in ['', u'']: continue
                        if isinstance(x, unicode):
                            named_args[str_k].append(self.recode_input(
                                                                 x, decode=0))
                        else:
                            named_args[str_k].append(self.recode_input(
                                                                 x, decode=0))
                elif isinstance(l, unicode):
                    named_args[str_k].append(self.recode_input(l, decode=0))
                else:
                    named_args[str_k].append(self.recode_input(l, decode=0))
        for k in form.keys():
            named_args[str(k)] = self.recode_input(form.getvalue(k))
        if self._corpus_architect:
            try: del named_args['corpname']
            except KeyError: pass
        na = named_args.copy()
        correct_types (na, self.clone_self())
        self.__dict__.update (na)
        if selectorname:
            choose_selector (self.__dict__, getattr (self, selectorname))
        self._set_defaults()
        self.__dict__.update (na)
        self._correct_parameters()
#        self.corpname = 'desam'
        return named_args

    def run_unprotected (self, path=None, selectorname=None):
        if path is None:
            path = os.getenv('PATH_INFO','').strip().split('/')[1:]
        if len (path) is 0 or path[0] is '':
            path = ['methods']
        else:
            if path[0].startswith ('_'):
                raise Exception('access denied')
        named_args = self.parse_parameters (selectorname)
        methodname, tmpl, result = self.process_method (path[0], path, named_args)
        self.output_headers()
        self.output_result (methodname, tmpl, result)

    def process_method (self, methodname, pos_args, named_args):
        reload = {'headers': 'wordlist_form'}
        if getattr (self, 'reload', None):
            self.reload = None
            if methodname != 'subcorp':
                reload_template = reload.get(methodname, methodname + '_form')
                if self.is_template (reload_template):
                    return self.process_method(reload_template,
                                               pos_args, named_args)

        if not hasattr (self, methodname):
            if methodname.endswith ('_form'):
                tpl_data = {}
                if methodname == 'first_form':
                    tpl_data['user_menu'] = True
                return (methodname[:-5], methodname + '.tmpl', tpl_data)
            else:
                raise Exception('unknown method: "%s" dict:%s' % (methodname,
                                                        self.__dict__))
        method = getattr (self, methodname)
        try:
            return (methodname,
                    getattr (method, 'template', methodname + '.tmpl'),
                    self.call_method (method, pos_args, named_args))
        except Exception, e:
            import logging
            import traceback
            err_type, err_value, err_trace = sys.exc_info()
            err_out = traceback.format_exception(err_type, err_value, err_trace)
            logging.getLogger(__name__).error(''.join(err_out))
            if self.format == 'json':
                return (methodname, None,
                        {'error': self.rec_recode(e.message, 'utf-8', True)})
            if not self.exceptmethod and self.is_template(methodname +'_form'):
                self.exceptmethod = methodname + '_form'
            if self.debug or not self.exceptmethod:
                raise e
            self.error = self.rec_recode(e.message, enc='utf-8') or str(e)
                # may be localized
            em, self.exceptmethod = self.exceptmethod, None
            return self.process_method (em, pos_args, named_args)

    def recode_input(self, x, decode=1): # converts query into corpencoding
        if self._corpus_architect and decode: return x
        if type(x) is ListType:
            return [self.recode_input(v, decode) for v in x]
        pom = x
        if decode:
            try: pom = x.decode('utf-8')
            except UnicodeDecodeError: pom = x.decode('latin1')
        pom = pom.encode(self.self_encoding(), 'replacedot')
        return pom

    def rec_recode(self, x, enc='', utf8_out=False):
        if not enc: enc = self.self_encoding()
        if isinstance(x, TupleType) or isinstance(x, ListType):
            return [self.rec_recode(e, enc, utf8_out) for e in x]
        if isinstance(x, DictType):
            d = {}
            for key, value in x.iteritems():
                if key in ['corp_full_name', 'Corplist']: d[key] = value
                else: d[key] = self.rec_recode(value, enc, utf8_out)
            return d
        elif type(x) is StringType:
            x = unicode(x, enc, 'replace')
            if utf8_out or not has_cheetah_unicode_internals:
                x = x.encode('utf-8')
            return x
        return x

    def urlencode (self, key_val_pairs):
        """
        """
        enc = self.self_encoding()
        if type(key_val_pairs) is StringType:
            return urllib.quote(self.rec_recode(key_val_pairs, enc, utf8_out=True))
        else:
            return urllib.urlencode([(k, self.rec_recode(v, enc, utf8_out=True))
                                                for (k,v) in key_val_pairs])
    
    def output_headers (self, outf=sys.stdout):
        # Cookies
        cookies = Cookie.SimpleCookie()
        for k in self._cookieattrs: 
            if self.__dict__.has_key (k):
                cookies [k] = self.__dict__[k]
                cookies [k]['expires'] = 5*24*3600
        if cookies and outf:
            outf.write(cookies.output() + '\n')

        # Headers
        if self.format == 'json':
            self._headers['Content-Type'] = 'text/x-json'
        if outf:
            for k,v in self._headers.items():
                outf.write('%s: %s\n' % (k, v))
            outf.write('\n')
        return cookies, self._headers

       
    def output_result (self, methodname, template, result, outf=sys.stdout,
                                                       return_template=False):
        from Cheetah.Template import Template

        # JSON
        if self.format == 'json':
            simplejson.dump(self.rec_recode(result, utf8_out=True), outf)

        # Template
        elif type(result) is DictType:
            self._add_globals (result)
            self.add_undefined (result, methodname)
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
            if return_template: return result
            result.respond(CheetahResponseFile(outf))
        
        # Image
        elif hasattr(result, '__module__') and result.__module__ == 'Image':
            img_type = self._headers['Content-Type'].split('/')[1]
            result.save(outf, img_type)

        # Other (string)
        else:
            outf.write(str(result))


    def run (self, path=None, selectorname=None):
        """
        This method wraps run_unprotected by try-except and presents
        only brief error messages to the user.
        """
        try:
            self.run_unprotected (path, selectorname)

        except Exception, e:
            from Cheetah.Template import Template
            from cmpltmpl import error_message

            self.output_headers()
            tpl_data = {
                'message' : _('Failed to process your request. Please try again later or contact system support.'),
                'corp_full_name' : '?',
                'corplist_size' : '?',
                'Corplist' : [],
                'corp_description' : '',
                'corp_size' : ''
            }
            error_message.error_message(searchList=[tpl_data, self]).respond(CheetahResponseFile(sys.stdout))


    def methods (self, params=0):
        """list all methods with a doc string"""
        methodlist = []
        cldict = self.__class__.__dict__
        for m in [x for x in cldict.keys()
                  if not x.startswith('_') and hasattr (cldict[x], '__doc__') \
                  and callable (cldict[x])]:
            mm = {'name': m, 'doc': cldict[m].__doc__}
            if params:
                try:
                    mm['Params'] = [{'name':v}
                                    for v in cldict[m].func_code.co_varnames[1:]]
                except AttributeError: pass
            methodlist.append (mm)
        return {'List': methodlist}
    
    methods.template = """<html><head><title>Methods</title></head><body><ul>
        #for $l in $List
           <li><b>$l['name']</b>(
               #set $sep = ''
               #for $p in $l.get('Params',[])
                  $sep$p['name']
                  #set $sep = ', '
               #end for
                )<br>$l['doc']<br>
        #end for
        </ul></body></html>
        """
