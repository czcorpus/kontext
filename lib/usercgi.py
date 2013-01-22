# Copyright (c) 2004-2009  Pavel Rychly
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import CGIPublisher
import os

import settings

def load_opt_file (options, filepath):
    if not os.path.isfile (filepath):
        return
    for line in open (filepath).readlines():
        if line[0] == '#':
            continue
        a,v = line.split ('\t', 1)
        options [a.strip()] = v.strip('\n').decode('utf8')


class UserCGI (CGIPublisher.CGIPublisher):
    _ca_user_info = u''
    _options_dir = u''
    _email = u''
    _default_user = u'defaults'
    attrs2save = []

    def __init__ (self, user=None):
        CGIPublisher.CGIPublisher.__init__ (self)
        self._user = user

    def _user_defaults (self, user):
        pass

    def _get_ca_user_info(self, corpname=''):
        import Cookie, urllib, urllib2, simplejson
        ck = Cookie.SimpleCookie(self.environ.get('HTTP_COOKIE',''))
        self.session_id = getattr(ck.get('sessionid'), 'value', '')
        self.user_ip = os.getenv ('REMOTE_ADDR', '-')
        if self._login_address:
            self._login_address += '/?next=' + urllib.quote_plus(
                                                os.getenv ('REQUEST_URI', '-'))
        request = urllib2.Request(self._ca_user_info
                                  % (self.session_id, self.user_ip, corpname))
        file = urllib2.urlopen(request)
        data = file.read()
        file.close()
        user_info = simplejson.loads(data)
        if user_info.has_key('error'): self._has_access = False
            # set attributes (incl. these starting '_') and correct types
        corr_func = {type(0): int, type(0.0): float, type([]): lambda x: [x]}
        for k, v in user_info.items():
            try: setattr (self, k, corr_func[type(getattr(self, k))](v))
            except: setattr (self, k, v)
        if self._user: self._user = str(self._user)

    def _setup_user (self, corpname=''):
        if self._ca_user_info:
            self._has_access = 0
            self._get_ca_user_info(corpname)
        if not self._user:
            self._user = os.getenv ('REMOTE_USER','-')
            if self._user == '-':
                self._user = self._default_user
        user = self._user
        options = {}
        load_opt_file (options, os.path.join (self._options_dir,
                                              self._default_user))
        if user is not self._default_user:
            load_opt_file (options, os.path.join (self._options_dir, user))
        CGIPublisher.correct_types (options, self.clone_self(), selector=1)
        self._user_defaults (user)
        self.__dict__.update (options)

    def _save_options (self, optlist=[], selector=''):
        if selector:
            tosave = [(selector + ':' + opt, self.__dict__[opt])
                           for opt in optlist if self.__dict__.has_key (opt)]
        else:
            tosave = [(opt, self.__dict__[opt]) for opt in optlist
                           if self.__dict__.has_key (opt)]
        opt_filepath = os.path.join (self._options_dir, self._user)
        options = {}
        load_opt_file(options, opt_filepath)
        options.update(tosave)

        opt_lines = []
        for k, v in options.iteritems():
            if isinstance(v, unicode): v = v.encode('utf8')
            opt_lines.append(str(k) + '\t' + str(v))
        opt_lines.sort()
        opt_file = open(opt_filepath, 'w')
        opt_file.write('\n'.join(opt_lines))
        opt_file.close()

    def save_global_attrs(self):
        options = [a for a in self.attrs2save if not a.startswith('_')]
        self._save_options(options, '')

    def send_mail(self, subject, msg):
        import smtplib
        full_msg = "From: Sketch Engine <support@sketchengine.co.uk>" + \
                   "\nTo: " + self._email + \
                   "\nSubject: " + subject + \
                   "\n\nDear SketchEngine user,\n\n" + msg + \
                   "\n\nThis message was created automatically, do not " + \
                   "respond to it.\n\n" + \
                   "Sketch Engine <http://www.sketchengine.co.uk/>\n" + \
                   "Bringing Corpora to the Masses\n"
        server = smtplib.SMTP('localhost')
        server.sendmail('support@sketchengine.co.uk',
                        self._email, full_msg)
        server.quit()

    def user_password(self, curr_passwd='', new_passwd='', new_passwd2=''):
        import crypt
        import logging
        logging.getLogger(__name__).info('curr: %s, new: %s, new2: %s' % (curr_passwd, new_passwd, new_passwd2))
        user_data = settings.get_user_data()
        if not user_data:
            raise Exception(_('Unknown user'))
        if crypt.crypt(curr_passwd, user_data['pass']) == user_data['pass']:
            pass
        else:
            raise Exception(_('Invalid password'))

        if new_passwd != new_passwd2:
            raise Exception(_('New password and its confirmation do not match.'))

        settings.update_user_password(new_passwd)
        print('Location: %s' % settings.get_root_uri())

    user_password.template = 'user_password.tmpl'