import httplib


class AppBar(object):

    def __init__(self, settings):
        self.connection = httplib.HTTPConnection(settings.get('global', 'app_bar_url'), port=80, timeout=10)