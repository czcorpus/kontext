import os
import sys
APP_PATH = os.path.realpath('%s/../..' % os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '%s/lib' % APP_PATH)
import settings
from celery import Celery
settings.load('%s/conf/config.xml' % APP_PATH)
import imp

_, conf = settings.get_full('global', 'periodic_tasks')
conf_mod = imp.load_source('beatconfig', conf['conf'])
app = Celery('kontext', config_source=conf_mod)

