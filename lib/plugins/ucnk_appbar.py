import httplib
import logging


def create_instance(settings, ticket_id_provider):
    server = settings.get('plugins', 'appbar').get('server')
    path = settings.get('plugins', 'appbar').get('path', '')
    port = int(settings.get('plugins', 'appbar').get('port', 80))
    css_url = settings.get('plugins', 'appbar').get('css_url', None)
    css_url_ie = settings.get('plugins', 'appbar').get('css_url_ie', None)
    root_url = settings.get_root_url()
    return AppBar(root_url=root_url, ticket_id_provider=ticket_id_provider, server=server, path=path, port=port,
                  css_url=css_url, css_url_ie=css_url_ie)


class AppBar(object):

    def __init__(self, ticket_id_provider, root_url, server, path, port, css_url, css_url_ie):
        self.ticket_id_provider = ticket_id_provider
        self.root_url = root_url
        self.server = server
        self.path = path
        self.port = port if port else 80
        self.css_url = css_url
        self.css_url_ie = css_url_ie
        self.connection = None

    def get_contents(self, cookies, curr_lang, return_url=None):
        if not curr_lang:
            curr_lang = 'en'
        curr_lang = curr_lang.split('_')[0]
        if hasattr(self.ticket_id_provider, 'get_ticket'):
            ticket_id = self.ticket_id_provider.get_ticket(cookies)
            try:
                self.connection = httplib.HTTPConnection(self.server, port=self.port, timeout=3)
                if return_url is None:
                    return_url = '%s%s' % (self.root_url, 'first_form')
                self.connection.request('GET', self.path % {
                    'id': ticket_id,
                    'lang': curr_lang,
                    'continue': return_url
                })
                response = self.connection.getresponse()
                
                if response and response.status == 200:
                    return response.read().decode('utf-8')
                else:
                    logging.getLogger(__name__).warning('Failed to load toolbar data from authentication server (%s %s). ticket: %s'
                                                        % (response.status, response.reason, ticket_id))
            except Exception as e:
                logging.getLogger(__name__).warning('Failed to load toolbar data from authentication server: %s' % (e, ))
        return None