# Copyright (c) 2013 Institute of formal and
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

"""
A simple module for tracking activities and reporting to piwik.
"""

import os
import re

from piwikapi.tracking import PiwikTracker
from piwikapi.tests.request import FakeRequest

def create_instance(conf):
    """
    This function must be always implemented. Bonito uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """

    tracking_api_url = None
    site_id = None
    rest_site_id = None
    methods_to_track = []
    auth_token = None
    context_path = '/'

    if conf.get('plugins', 'tracker').get('site_id'):
        site_id = conf.get('plugins', 'tracker').get('site_id').strip()

    if conf.get('plugins', 'tracker').get('rest_site_id'):
        rest_site_id = conf.get('plugins', 'tracker').get('rest_site_id').strip()

    if conf.get('plugins', 'tracker').get('tracking_api_url'):
        tracking_api_url = conf.get('plugins', 'tracker').get('tracking_api_url').strip()

    if conf.get('plugins', 'tracker').get('methods_to_track'):
        methods_to_track = re.split(' *, *', conf.get('plugins', 'tracker').get('methods_to_track').strip())

    if conf.get('plugins', 'tracker').get('auth_token'):
        auth_token = conf.get('plugins', 'tracker').get('auth_token').strip()

    #if conf.get('global', 'root_url_path'):
    #    context_path = conf.get('global', 'root_url_path').strip()

    if conf.get('global', 'action_path_prefix'):
        context_path = conf.get('global', 'action_path_prefix').strip()

    return Tracker(site_id, rest_site_id, tracking_api_url, context_path, methods_to_track, auth_token)


class Tracker():
    """
    Piwik tracker module
    """

    def __init__(self, site_id, rest_site_id, tracking_api_url, context_path, methods_to_track, auth_token):
        """
        Initializes the tracker by setting the site_id and tracking API URL
        """
        self.site_id = site_id
        self.rest_site_id = rest_site_id
        self.tracking_api_url = tracking_api_url
        self.context_path = context_path
        self.methods_to_track = frozenset(methods_to_track)
        self.rest_methods = frozenset(['fcs'])
        self.auth_token = auth_token

    def track(self, methodname, tmpl, result):
        """
        Sends the tracking information to the tracking backend
        """
        if not self.is_tracking_allowed(methodname):
            return

        server_names = os.environ.get('HTTP_X_FORWARDED_SERVER', '').split(', ')
        server_name = server_names[0] if server_names else ''
        https = os.environ.get('HTTP_X_FORWARDED_PROTOCOL', '') == 'https'
        remote_addrs = os.environ.get('HTTP_X_FORWARDED_FOR', os.environ.get('REMOTE_ADDR', '')).split(', ')
        remote_addr = remote_addrs[0] if remote_addrs else ''
        path_info = self.context_path.rstrip('/') + os.environ.get('PATH_INFO', '')
        title = '%s/%s' % (server_name, methodname)

        headers = {
            'HTTP_USER_AGENT': os.environ.get('HTTP_USER_AGENT', ''),
            'REMOTE_ADDR': remote_addr,
            'HTTP_REFERER': os.environ.get('HTTP_REFERER', ''),
            'HTTP_ACCEPT_LANGUAGE': os.environ.get('HTTP_ACCEPT_LANGUAGE', ''),
            'SERVER_NAME': server_name,
            'PATH_INFO': path_info,
            'QUERY_STRING': os.environ.get('QUERY_STRING', ''),
            'HTTPS': https,
        }

        request = FakeRequest(headers)
        site_id = self.get_site_id(methodname)
        piwiktracker = PiwikTracker(site_id, request)
        piwiktracker.set_api_url(self.tracking_api_url)
        piwiktracker.set_ip(remote_addr)

        if self.is_rest_call(methodname):
            piwiktracker.set_custom_variable(1, 'source', 'rest-python', 'page')

        if self.is_authentication_required():
            piwiktracker.set_token_auth(self.auth_token)

        piwiktracker.do_track_page_view(title)

    def is_tracking_allowed(self, methodname):
        return methodname in self.methods_to_track

    def is_rest_call(self, methodname):
        return methodname in self.rest_methods

    def is_authentication_required(self):
        return self.auth_token is not None

    def get_site_id(self, methodname):
        site_id = self.site_id
        if self.is_rest_call(methodname):
            site_id = self.rest_site_id
        return site_id