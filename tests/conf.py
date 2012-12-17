import sys
import os
import shutil
sys.path.insert(0, '../lib')
import settings
import __builtin__

def init():
    __builtin__.__dict__['_'] = lambda s : 'cs: %s' % s
    settings.load('default', './config.test.xml')
    if os.path.exists(settings.get('corpora', 'tags_cache_dir')):
        shutil.rmtree(settings.get('corpora', 'tags_cache_dir'))
    os.mkdir(settings.get('corpora', 'tags_cache_dir'))
    os.mkdir('%s/susanne' % settings.get('corpora', 'tags_cache_dir'))

