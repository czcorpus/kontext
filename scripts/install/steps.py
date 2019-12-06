from typing import Tuple, List
from abc import ABC, abstractmethod

import sys
import os
import subprocess
import runpy

import random
import string
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lib'))
from plugins.default_auth import mk_pwd_hash_default

def generate_random_password() -> Tuple[str, str]:
    password = ''.join([random.choice(string.ascii_letters + string.digits) for n in range(8)])
    return password, mk_pwd_hash_default(password)


WEBSERVER_USER="www-data"
MANATEE_VER='2.167.8'



class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'



class InstallationStep(ABC):
    final_messages: List[str] = []

    def __init__(self, kontext_path: str):
        self.kontext_path = kontext_path

    @abstractmethod
    def is_done(self) -> bool:
        pass

    @abstractmethod
    def run(self) -> None:
        pass

    @abstractmethod
    def abort(self) -> None:
        pass

    def add_final_message(self, message: str):
        self.final_messages.append(message)



class SetupManatee(InstallationStep):
    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self):
        # config celery
        try:
            subprocess.check_call(['useradd', '-r', '-s', '/bin/false', 'celery'])
        except:
            pass
        subprocess.check_call(['adduser', 'celery', WEBSERVER_USER])
        subprocess.check_call(['mkdir', '-p', '/etc/conf.d'])
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/celery-conf.d'), '/etc/conf.d/celery'])
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/celery.service'), '/etc/systemd/system'])
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/celery.tmpfiles'), '/usr/lib/tmpfiles.d/celery.conf'])
        subprocess.check_call(['mkdir', '-p', '/var/log/celery'])
        subprocess.check_call(['chown', 'celery:root', '/var/log/celery'])
        subprocess.check_call(['mkdir', '-p', '/var/run/celery'])
        subprocess.check_call(['chown', 'celery:root', '/var/run/celery'])
        subprocess.check_call(['systemctl', 'enable', 'celery'])
        subprocess.check_call(['systemctl', 'daemon-reload'])

        # config nginx
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/nginx'), '/etc/nginx/sites-available/default'])

        # install manatee with ucnk patch
        subprocess.check_call(['wget', f'http://corpora.fi.muni.cz/noske/src/manatee-open/manatee-open-{MANATEE_VER}.tar.gz'], cwd = '/usr/local/src')
        subprocess.check_call(['tar', 'xzvf', f'manatee-open-{MANATEE_VER}.tar.gz'], cwd = '/usr/local/src')
        
        # apply patch if available
        if os.path.isfile(os.path.join(self.kontext_path, f'scripts/install/ucnk-manatee-{MANATEE_VER}.patch')):
            subprocess.check_call(['cp', os.path.join(self.kontext_path, f'scripts/install/ucnk-manatee-{MANATEE_VER}.patch'), './'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}')
            subprocess.check_call(['patch', '-p0', '<', f'ucnk-manatee-{MANATEE_VER}.patch'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}')
        
        subprocess.check_call(['./configure', '--with-pcre'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}')
        subprocess.check_call(['make'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}')
        subprocess.check_call(['make', 'install'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}')
        subprocess.check_call(['ldconfig'])

        # setup Susanne corpus
        subprocess.check_call(['wget', 'https://corpora.fi.muni.cz/noske/src/example-corpora/susanne-example-source.tar.bz2'], cwd = '/usr/local/src')
        subprocess.check_call(['tar', 'xjvf', 'susanne-example-source.tar.bz2'], cwd = '/usr/local/src')
        
        subprocess.check_call(['mkdir', '-p', '/var/lib/manatee/registry'])
        subprocess.check_call(['mkdir', '-p', '/var/lib/manatee/vert'])
        subprocess.check_call(['mkdir', '-p', '/var/lib/manatee/data/susanne'])
        subprocess.check_call(['mkdir', '-p', '/var/local/corpora/user_filter_files'])

        subprocess.check_call(['sed', '-i', 's%PATH susanne%PATH "/var/lib/manatee/data/susanne"%', './config'], cwd = '/usr/local/src/susanne-example-source')
        subprocess.check_call(['cp', './source', '/var/lib/manatee/vert/susanne.vert'], cwd = '/usr/local/src/susanne-example-source')
        subprocess.check_call(['cp', './config', '/var/lib/manatee/registry/susanne'], cwd = '/usr/local/src/susanne-example-source')

        subprocess.check_call(['encodevert', '-v', '-c', './config', '-p', '/var/lib/manatee/data/susanne', './source'], cwd = '/usr/local/src/susanne-example-source')

        # install python3 support
        subprocess.check_call(['wget', f'https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open-python3_{MANATEE_VER}-1ubuntu1_amd64.deb'], cwd = '/usr/local/bin')
        subprocess.check_call(['dpkg', '-i', f'manatee-open-python3_{MANATEE_VER}-1ubuntu1_amd64.deb'], cwd = '/usr/local/bin')



class SetupKontext(InstallationStep):
    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self):
        subprocess.check_call(['cp', 'config.default.xml', 'config.xml'], cwd = os.path.join(self.kontext_path, 'conf'))
        subprocess.check_call(['cp', 'corplist.default.xml', 'corplist.xml'], cwd = os.path.join(self.kontext_path, 'conf'))
        subprocess.check_call(['cp', 'beatconfig.sample.py', 'beatconfig.py'], cwd = os.path.join(self.kontext_path, 'conf'))

        # update config.xml with current install path
        subprocess.check_call(['sed', '-i', f's%/opt/kontext%{self.kontext_path}%', 'config.xml'], cwd = os.path.join(self.kontext_path, 'conf'))

        # create directories, set permissions
        subprocess.check_call(['mkdir', '-p', '/var/local/corpora/registry'])
        subprocess.check_call(['mkdir', '-p', '/var/local/corpora/cache'])
        subprocess.check_call(['mkdir', '-p', '/var/local/corpora/subcorp'])
        subprocess.check_call(['mkdir', '-p', '/var/local/corpora/freqs-precalc'])
        subprocess.check_call(['mkdir', '-p', '/var/local/corpora/freqs-cache'])
        subprocess.check_call(['mkdir', '-p', '/var/local/corpora/colls-cache'])
        subprocess.check_call(['chown', f'{WEBSERVER_USER}:{WEBSERVER_USER}', '/var/local/corpora/cache'])
        subprocess.check_call(['chown', f'{WEBSERVER_USER}:{WEBSERVER_USER}', '/var/local/corpora/subcorp'])
        subprocess.check_call(['chown', f'{WEBSERVER_USER}:{WEBSERVER_USER}', '/var/local/corpora/freqs-precalc'])
        subprocess.check_call(['chown', f'{WEBSERVER_USER}:{WEBSERVER_USER}', '/var/local/corpora/freqs-cache'])
        subprocess.check_call(['chown', f'{WEBSERVER_USER}:{WEBSERVER_USER}', '/var/local/corpora/colls-cache'])
        subprocess.check_call(['chmod', 'g+ws', '/var/local/corpora/cache'])
        subprocess.check_call(['chmod', 'g+ws', '/var/local/corpora/subcorp'])
        subprocess.check_call(['chmod', 'g+ws', '/var/local/corpora/freqs-precalc'])
        subprocess.check_call(['chmod', 'g+ws', '/var/local/corpora/freqs-cache'])
        subprocess.check_call(['chmod', 'g+ws', '/var/local/corpora/colls-cache'])
        subprocess.check_call(['chmod', '-R', '775', '/var/local/corpora/subcorp'])

        subprocess.check_call(['mkdir', '-p', '/var/log/kontext'])
        subprocess.check_call(['chown', f'{WEBSERVER_USER}:', '/var/log/kontext'])

        subprocess.check_call(['mkdir', '-p', '/tmp/kontext-upload'])
        subprocess.check_call(['chown', f'{WEBSERVER_USER}:', '/tmp/kontext-upload'])
        subprocess.check_call(['chmod', '-R', '775', '/tmp/kontext-upload'])

        # TODO
        # subprocess.check_call(['python3', 'scripts/validate_setup.py', 'conf/config.xml'], cwd = self.kontext_path)
        subprocess.check_call(['npm', 'install'], cwd = self.kontext_path)
        subprocess.check_call(['make', 'production'], cwd = self.kontext_path)



class SetupDefaultUsers(InstallationStep):
    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self):
        import redis, json
        redis_client = redis.Redis(host='localhost', port=6379, db=1)
        
        # set up anonymous user in Redis
        redis_client.set('user:0', json.dumps({'id': 0, 'username': 'anonymous', 'firstname': 'Anonymous', 'lastname': None, 'email': None, 'pwd_hash': None}))
        redis_client.set('corplist:user:0', json.dumps(['susanne']))
        
        # set up kontext user in Redis
        password, password_hash = generate_random_password()
        redis_client.set('user:1', json.dumps({'id': 1, 'username': 'kontext', 'firstname': 'Kontext', 'lastname': 'Test', 'pwd_hash': password_hash, 'email': 'test@example.com'}))
        redis_client.set('corplist:user:1', json.dumps(['susanne']))
        redis_client.hset('user_index', 'kontext', '\\"user:1\\"')

        self.add_final_message(f'''
            {bcolors.BOLD}{bcolors.OKGREEN}
            KonText installation successfully completed.
            To start KonText, enter the following command in the KonText install root directory (i.e. {self.kontext_path}):
            
                sudo -u {WEBSERVER_USER} python public/app.py --address 127.0.0.1 --port 8080

            (--address and --port parameters are optional; default serving address is 127.0.0.1:5000)
            --------------------
            To login as a test user, please use the following credentials:
                username: kontext
                password: {password}
            {bcolors.ENDC}{bcolors.ENDC}
        ''')
