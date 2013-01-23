#!/usr/bin/python
# -*- Python -*-

import os
from optparse import OptionParser

DEFAULT_APP_URL_DIR = '/bonito2'
DEFAULT_FILES_URL_DIRNAME = 'files'
DEFAULT_APP_DIR = os.path.abspath('%s/..' % os.curdir)

APACHE_CONF_TEMPLATE = """
Alias %(app_url_dir)s %(app_dir)s
<Directory %(app_dir)s>
    Options +ExecCGI
    AddHandler cgi-script .cgi
    SetEnv REMOTE_USER default
</Directory>

<Directory %(app_dir)s/files>%(allow_listing)s</Directory>
"""

parser = OptionParser(usage='usage: %prog [options]')
parser.add_option('-a', '--app-dir', dest='app_dir', help='directory where the application is installed (default is the directory of this app.)',
        default=DEFAULT_APP_DIR)
parser.add_option('-u', '--app-url-dir', dest='app_url_dir', help='directory path used to access the application (default is "bonito2")',
        default=DEFAULT_APP_URL_DIR)
parser.add_option('-i', '--allow-file-listing', dest='allow_file_listing', help='if used then Apache\'s configuration will allow directory listing (disabled by default)',
        action='store_true', default=False)
parser.add_option('-f', '--output-file', dest='output_file', help='file where to store the output')

(options, args) = parser.parse_args()

tpl_data = {
    'app_dir' : options.app_dir.rstrip('/'),
    'files_dir' : '%s/%s' % (options.app_dir.rstrip('/'), 'files'),
    'app_url_dir' : options.app_url_dir.rstrip('/')
}

if options.allow_file_listing:
    tpl_data['allow_listing'] = '\n    Options +Indexes\n'
else:
    tpl_data['allow_listing'] = '\n'

try:
    if options.output_file is not None:
        with open(options.output_file, 'w') as f:
            f.write((APACHE_CONF_TEMPLATE % tpl_data).strip())
        print('Configuration successfully written to %s' % options.output_file)
    else:
        print("-----------------------------")
        print((APACHE_CONF_TEMPLATE % tpl_data).strip())
        print("-----------------------------")
except Exception,e:
    print("ERROR: %s" % e)