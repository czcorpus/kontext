import httplib
import urllib
import logging


def create_instance(settings, ticket_id_provider):
    server = settings.get('plugins', 'appbar').get('server')
    path = settings.get('plugins', 'appbar').get('path', '')
    port = int(settings.get('plugins', 'appbar').get('port', 80))
    css_urls = [settings.get('plugins', 'appbar').get('css_url', None)]
    css_urls.append(settings.get('plugins', 'appbar').get('css_url1', None))
    css_urls.append(settings.get('plugins', 'appbar').get('css_url2', None))
    css_url_ie = settings.get('plugins', 'appbar').get('css_url_ie', None)
    js_url = settings.get('plugins','appbar').get('js_url', None)
    root_url = settings.get_root_url()
    return AppBar(root_url=root_url, ticket_id_provider=ticket_id_provider, server=server, path=path, port=port,
                  css_urls=[x for x in css_urls if x is not None], css_url_ie=css_url_ie, js_url=js_url)


class AppBar(object):

    def __init__(self, ticket_id_provider, root_url, server, path, port, css_urls, css_url_ie, js_url):
        self.ticket_id_provider = ticket_id_provider
        self.root_url = root_url
        self.server = server
        self.path = path
        self.port = port if port else 80
        self.css_urls = css_urls
        self.css_url_ie = css_url_ie
        self.js_url = js_url
        self.connection = None

    def get_contents(self, cookies, curr_lang, return_url=None):
        input_file = "../themes/lindat/header.htm"
        if "cs_CZ" == curr_lang:
            input_file = "../themes/lindat/cs/header.htm"
        with open(input_file, mode="rb") as fin:
            html = fin.read().decode('utf-8')
        contents = html + """
<ul id="localization-bar" class="navbar-left pull-left list-unstyled" style="position: absolute; top: 0px;">
</ul>

<!-- AUTH BAR -->
<div class="lindat-auth-bar">
    <span class="user">$_("User"):
        #if not $_anonymous
            $user_info.fullname
            (<a href="$logout_url">$_('logout')</a>)
        #else
            $_('anonymous')
            (<a href="$login_url" class="signon" onclick="return false;">$_('login')</a>)
        #end if
    </span>
</div>
<!-- AUTH BAR END -->
"""
        return contents

