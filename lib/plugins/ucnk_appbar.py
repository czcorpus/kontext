import httplib


def create_instance(settings):
    server = settings.get('plugins', 'appbar').get('server')
    path = settings.get('plugins', 'appbar').get('path', '')
    port = int(settings.get('plugins', 'appbar').get('port', 80))
    return AppBar(server=server, path=path, port=port)


class AppBar(object):

    def __init__(self, server, path, port):
        self.server = server
        self.path = path
        self.port = port if port else 80
        self.connection = httplib.HTTPConnection(self.server, port=self.port, timeout=3)

    def get_contents(self, id):
        self.connection.request('GET', self.path % id)
        response = self.connection.getresponse()
        # TODO test status etc.
        if response and response.status == 200:
            return response.read().decode('utf-8')
        else:
            import logging
            logging.getLogger(__name__).warning('Failed to load toolbar data from authentication server. Session: %s' % id)
            return None