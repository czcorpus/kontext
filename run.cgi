#!/usr/bin/python
# -*- Python -*-

import cgitb; cgitb.enable()
import sys, os

sys.path.insert(0, './lib')

from conccgi import ConcCGI
from usercgi import UserCGI

import manatee
import settings
settings.load()

MANATEE_REGISTRY = settings.config.get('corpora', 'manatee_registry')

try:
    from wseval import WSEval
except:
    class WSEval(ConcCGI):
        pass

class BonitoCGI (WSEval, UserCGI):

    # UserCGI options
    _options_dir = settings.config.get('corpora', 'options_dir')

    # ConcCGI options
    cache_dir = settings.config.get('corpora', 'cache_dir')
    subcpath = [ settings.config.get('corpora', 'subcpath') ]
    gdexpath = [] # [('confname', '/path/to/gdex.conf'), ...]

	# set available corpora, e.g.: corplist = ['susanne', 'bnc', 'biwec']
    corplist = settings.get_corplist(os.getenv('REMOTE_USER'), MANATEE_REGISTRY)

    # set default corpus
    corpname = settings.get_default_corpus(corplist)


    helpsite = 'https://trac.sketchengine.co.uk/wiki/SkE/Help/PageSpecificHelp/'

    def __init__ (self, user=None):
        UserCGI.__init__ (self, user)
        ConcCGI.__init__ (self)

    def _user_defaults (self, user):
        if user is not self._default_user:
            self.subcpath.append ('%s/%s' % (settings.config.get('corpora', 'users_subcpath'), user))
        self._conc_dir = '%s/%s' % (settings.config.get('corpora', 'conc_dir'), user)
        self._wseval_dir = '%s/%s' % (settings.config.get('corpora', 'wseval_dir'), user)


if __name__ == '__main__':

    # logging setup
    import logging
    logger = logging.getLogger('') # root logger
    hdlr = logging.FileHandler(settings.config.get('logging', 'log_path'))
    formatter = logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    hdlr.setFormatter(formatter)
    logger.addHandler(hdlr)
    logger.setLevel(logging.INFO)

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
    else:
        BonitoCGI().run_unprotected (selectorname='corpname')
