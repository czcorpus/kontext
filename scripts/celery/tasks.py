import os
import sys

APP_PATH = os.path.realpath('%s/../..' % os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '%s/lib' % APP_PATH)
import settings
from celery import Celery

settings.load(os.path.join(APP_PATH, 'conf', 'config.xml'))
from importlib.machinery import SourceFileLoader

conf_mod = SourceFileLoader('beatconfig', settings.get('job_scheduler', 'conf')).load_module()
app = Celery('kontext', config_source=conf_mod)
