#!/usr/bin/python
# -*- Python -*-
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

import cgitb
import sys
import os
import re

sys.path.insert(0, './lib')

import settings
settings.load(os.getenv('REMOTE_USER'))

if settings.is_debug_mode():
    cgitb.enable()

manatee_dir = settings.get('global', 'manatee_path')
if manatee_dir and manatee_dir not in sys.path:
    sys.path.insert(0, manatee_dir)

import manatee

import CGIPublisher
from conccgi import ConcCGI
from usercgi import UserCGI

MANATEE_REGISTRY = settings.get('corpora', 'manatee_registry')

try:
    from wseval import WSEval
except:
    class WSEval(ConcCGI):
        pass

class BonitoCGI (WSEval, UserCGI):

    # UserCGI options
    _options_dir = settings.get('corpora', 'options_dir')

    # ConcCGI options
    cache_dir = settings.get('corpora', 'cache_dir')
    subcpath = [ settings.get('corpora', 'subcpath') ]
    gdexpath = [] # [('confname', '/path/to/gdex.conf'), ...]

	# set available corpora, e.g.: corplist = ['susanne', 'bnc', 'biwec']
    corplist = settings.get_corplist()

    # set default corpus
    corpname = settings.get_default_corpus(corplist)


    helpsite = 'https://trac.sketchengine.co.uk/wiki/SkE/Help/PageSpecificHelp/'

    def __init__ (self, user=None, environ=os.environ):
        UserCGI.__init__ (self, user)
        ConcCGI.__init__ (self, environ=environ)

    def _user_defaults (self, user):
        if user is not self._default_user:
            self.subcpath.append ('%s/%s' % (settings.get('corpora', 'users_subcpath'), user))
        self._conc_dir = '%s/%s' % (settings.get('corpora', 'conc_dir'), user)
        self._wseval_dir = '%s/%s' % (settings.get('corpora', 'wseval_dir'), user)

def get_uilang(locale_dir):
    lgs_string = os.environ.get('HTTP_ACCEPT_LANGUAGE','')
    if lgs_string == '':
        return '' # english
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

if __name__ == '__main__':
    import logging
    from logging import handlers
    import __builtin__
    import gettext
    import locale

    # logging setup
    logger = logging.getLogger('') # root logger
    hdlr = handlers.RotatingFileHandler(settings.get('global', 'log_path'), maxBytes=(1 << 20))
    formatter = logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    hdlr.setFormatter(formatter)
    logger.addHandler(hdlr)
    logger.setLevel(logging.INFO)

    # locale
    locale_dir = 'locale/' # TODO
    if not os.path.isdir (locale_dir):
        p = os.path.join (os.path.dirname (__file__), locale_dir)
        if os.path.isdir (p):
            locale_dir = p
        else:
            # This will set the system default locale directory as a side-effect:
            gettext.install(domain='ske', unicode=True)
            # hereby we retrieve the system default locale directory back:
            locale_dir = gettext.bindtextdomain('ske')

    os.environ['LANG'] = get_uilang(locale_dir)
    logger.info('lang: %s' % os.environ['LANG'])
    settings.set('session', 'lang', os.environ['LANG'] if os.environ['LANG'] else 'en')
    os.environ['LC_ALL'] = os.environ['LANG']
    formatting_lang = '%s.utf-8' % (os.environ['LANG'] if os.environ['LANG'] else 'en_US')
    locale.setlocale(locale.LC_ALL, formatting_lang)
    translat = gettext.translation('ske', locale_dir, fallback=True)
    try: translat._catalog[''] = ''
    except AttributeError: pass

    if CGIPublisher.has_cheetah_unicode_internals:
        __builtin__.__dict__['_'] = translat.ugettext
    else:
        __builtin__.__dict__['_'] = translat.gettext

    if ";prof=" in os.environ['REQUEST_URI'] or "&prof=" in os.environ['REQUEST_URI']:
        import cProfile, pstats, tempfile
        proffile = tempfile.NamedTemporaryFile()
        cProfile.run('''BonitoCGI().run_unprotected (selectorname="corpname",
                        outf=open(os.devnull, "w"))''', proffile.name)
        profstats = pstats.Stats(proffile.name)
        print "<pre>"
        profstats.sort_stats('time','calls').print_stats(50)
        profstats.sort_stats('cumulative').print_stats(50)
        print "</pre>"
    elif not settings.is_debug_mode():
        BonitoCGI(environ=os.environ).run(selectorname='corpname')
    else:
        BonitoCGI(environ=os.environ).run_unprotected(selectorname='corpname')
