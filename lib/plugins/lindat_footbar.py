import httplib
import urllib
import logging


def create_instance(settings, ticket_id_provider):
    server = settings.get('plugins', 'footbar').get('server')
    path = settings.get('plugins', 'footbar').get('path', '')
    port = int(settings.get('plugins', 'footbar').get('port', 80))
    css_url = settings.get('plugins', 'footbar').get('css_url', None)
    css_url_ie = settings.get('plugins', 'footbar').get('css_url_ie', None)
    js_url = settings.get('plugins', 'footbar').get('js_url', None)
    root_url = settings.get_root_url()
    return FootBar(root_url=root_url, ticket_id_provider=ticket_id_provider, server=server, path=path, port=port,
                  css_url=css_url, css_url_ie=css_url_ie, js_url=js_url)


class FootBar(object):

    def __init__(self, ticket_id_provider, root_url, server, path, port, css_url, css_url_ie, js_url):
        self.ticket_id_provider = ticket_id_provider
        self.root_url = root_url
        self.server = server
        self.path = path
        self.port = port if port else 80
        self.css_url = css_url
        self.css_url_ie = css_url_ie
        self.js_url = js_url
        self.connection = None

    def get_contents(self, cookies, curr_lang, return_url=None):
        input_file = "../themes/lindat/footer.htm"
        if "cs_CZ" == curr_lang:
            input_file = "../themes/lindat/cs/footer.htm"
        with open(input_file, mode="rb") as fin:
            return fin.read().decode('utf-8')

