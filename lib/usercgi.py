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
        options [a.strip()] = v.strip()


class UserCGI (CGIPublisher.CGIPublisher):
    _options_dir = ''
    _email = ''
    _default_user = 'defaults'

    def __init__ (self, user=None):
        CGIPublisher.CGIPublisher.__init__ (self)
        self._setup_user (user)

    def _user_defaults (self, user):
        pass
   
    def _setup_user (self, user=None):
        if user is None:
            user = os.getenv ('REMOTE_USER','-')
            if user == '-':
                user = self._default_user

        options = {}
        load_opt_file (options, os.path.join (self._options_dir,
                                              self._default_user))
        if user is not self._default_user:
            load_opt_file (options, os.path.join (self._options_dir, user))
        CGIPublisher.correct_types (options, self.clone_self(), selector=1)
        self._user_defaults (user)
        self.__dict__.update (options)
        self._user = user

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
            opt_lines.append(str(k) + '\t' + str(v))
        opt_lines.sort()
        opt_file = open(opt_filepath, 'w')
        opt_file.write('\n'.join(opt_lines))
        opt_file.close()

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