from typing import Tuple, List
from abc import ABC, abstractmethod

import sys
import os
import subprocess
import pathlib
import shutil
import json

import redis
import random
import string
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lib'))
from plugins.default_auth import mk_pwd_hash_default

WEBSERVER_USER="www-data"
MANATEE_VER='2.167.8'


def create_directory(path: str, user: str = None, group: str = None, mode: int = 0o755):
    p = pathlib.Path(path)
    p.mkdir(parents=True, exist_ok=True, mode = mode)
    if user or group:
        shutil.chown(p, user, group)


def replace_string_in_file(path: str, old: str, new: str):
    with open(path, 'r', encoding='utf8') as f:
        config_text = f.read()
    with open(path, 'w', encoding='utf8') as f:
        f.write(config_text.replace(old, new))


def generate_random_password() -> Tuple[str, str]:
    password = ''.join(random.choice(string.ascii_letters + string.digits) for n in range(8))
    return password, mk_pwd_hash_default(password)



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

    def __init__(self, kontext_path: str, stdout: str):
        self.kontext_path = kontext_path
        self.stdout = stdout

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
        print('Setting up celery...')
        try:
            subprocess.check_call(['useradd', '-r', '-s', '/bin/false', 'celery'], stdout=self.stdout)
        except:
            pass
        subprocess.check_call(['adduser', 'celery', WEBSERVER_USER], stdout=self.stdout)
        create_directory('/etc/conf.d')
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/celery-conf.d'), '/etc/conf.d/celery'], stdout=self.stdout)
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/celery.service'), '/etc/systemd/system'], stdout=self.stdout)
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/celery.tmpfiles'), '/usr/lib/tmpfiles.d/celery.conf'], stdout=self.stdout)
        create_directory('/var/log/celery', 'celery', 'root')
        create_directory('/var/run/celery', 'celery', 'root')
        subprocess.check_call(['systemctl', 'enable', 'celery'], stdout=self.stdout)
        subprocess.check_call(['systemctl', 'daemon-reload'], stdout=self.stdout)

        # config nginx
        print('Setting up nginx...')
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/nginx'), '/etc/nginx/sites-available/default'], stdout=self.stdout)
        
        # install manatee with ucnk patch
        print('Installing manatee...')
        if os.path.isfile(os.path.join(self.kontext_path, f'scripts/install/ucnk-manatee-{MANATEE_VER}.patch')):
            # build manatee from source using patch
            subprocess.check_call(['wget', f'http://corpora.fi.muni.cz/noske/src/manatee-open/manatee-open-{MANATEE_VER}.tar.gz', '-N'], cwd = '/usr/local/src', stdout=self.stdout)
            subprocess.check_call(['tar', 'xzvf', f'manatee-open-{MANATEE_VER}.tar.gz'], cwd = '/usr/local/src', stdout=self.stdout)

            subprocess.check_call(['cp', os.path.join(self.kontext_path, f'scripts/install/ucnk-manatee-{MANATEE_VER}.patch'), './'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}', stdout=self.stdout)
            subprocess.check_call(['patch', '-p0', '<', f'ucnk-manatee-{MANATEE_VER}.patch'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}', stdout=self.stdout)
        
            subprocess.check_call(['./configure', '--with-pcre'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}', stdout=self.stdout)
            subprocess.check_call(['make'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}', stdout=self.stdout)
            subprocess.check_call(['make', 'install'], cwd = f'/usr/local/src/manatee-open-{MANATEE_VER}', stdout=self.stdout)
            subprocess.check_call(['ldconfig'], stdout=self.stdout)

            # install susanne corpus
            subprocess.check_call(['wget', 'https://corpora.fi.muni.cz/noske/src/example-corpora/susanne-example-source.tar.bz2', '-N'], cwd = '/usr/local/src', stdout=self.stdout)
            subprocess.check_call(['tar', 'xjvf', 'susanne-example-source.tar.bz2'], cwd = '/usr/local/src', stdout=self.stdout)
            
            create_directory('/var/lib/manatee/registry')
            create_directory('/var/lib/manatee/vert')
            create_directory('/var/lib/manatee/data/susanne')
            create_directory('/var/local/corpora/user_filter_files')

            replace_string_in_file('/usr/local/src/susanne-example-source/config', 'PATH susanne', 'PATH /var/lib/manatee/data/susanne')
            subprocess.check_call(['cp', './source', '/var/lib/manatee/vert/susanne.vert'], cwd = '/usr/local/src/susanne-example-source', stdout=self.stdout)
            subprocess.check_call(['cp', './config', '/var/lib/manatee/registry/susanne'], cwd = '/usr/local/src/susanne-example-source', stdout=self.stdout)

            subprocess.check_call(['encodevert', '-v', '-c', './config', '-p', '/var/lib/manatee/data/susanne', './source'], cwd = '/usr/local/src/susanne-example-source', stdout=self.stdout)

            # install manatee python3 support
            subprocess.check_call(['wget', f'https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open-python3_{MANATEE_VER}-1ubuntu1_amd64.deb', '-N'], cwd = '/usr/local/bin', stdout=self.stdout)
            subprocess.check_call(['dpkg', '-i', f'manatee-open-python3_{MANATEE_VER}-1ubuntu1_amd64.deb'], cwd = '/usr/local/bin', stdout=self.stdout)
        else:
            # install manatee python3 support (must be installed before manatee itself)
            subprocess.check_call(['wget', f'https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open-python3_{MANATEE_VER}-1ubuntu1_amd64.deb', '-N'], cwd = '/usr/local/bin', stdout=self.stdout)
            subprocess.check_call(['dpkg', '-i', f'manatee-open-python3_{MANATEE_VER}-1ubuntu1_amd64.deb'], cwd = '/usr/local/bin', stdout=self.stdout)
            # install manatee from package
            subprocess.check_call(['wget', f'https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open_{MANATEE_VER}-1ubuntu1_amd64.deb', '-N'], cwd = '/usr/local/bin', stdout=self.stdout)
            subprocess.check_call(['dpkg', '-i', f'manatee-open_{MANATEE_VER}-1ubuntu1_amd64.deb'], cwd = '/usr/local/bin', stdout=self.stdout)
            # install susanne corpus
            subprocess.check_call(['wget', f'https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open-susanne_{MANATEE_VER}-1ubuntu1_amd64.deb', '-N'], cwd = '/usr/local/bin', stdout=self.stdout)
            subprocess.check_call(['dpkg', '-i', f'manatee-open-susanne_{MANATEE_VER}-1ubuntu1_amd64.deb'], cwd = '/usr/local/bin', stdout=self.stdout)

            self.add_final_message(f'''
                {bcolors.BOLD}{bcolors.FAIL}
                UCNK patch not available. Manatee was installed without it.
                {bcolors.ENDC}{bcolors.ENDC}
            ''')



class SetupKontext(InstallationStep):
    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self):
        print('Installing kontext...')
        subprocess.check_call(['cp', 'config.default.xml', 'config.xml'], cwd = os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)
        subprocess.check_call(['cp', 'corplist.default.xml', 'corplist.xml'], cwd = os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)
        subprocess.check_call(['cp', 'beatconfig.sample.py', 'beatconfig.py'], cwd = os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)

        # update config.xml with current install path
        replace_string_in_file(os.path.join(self.kontext_path, 'conf/config.xml'), '/opt/kontext', self.kontext_path)

        # create directories, set permissions
        create_directory('/var/local/corpora/registry', WEBSERVER_USER, WEBSERVER_USER)
        create_directory('/var/local/corpora/cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/subcorp', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/freqs-precalc', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/freqs-cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/colls-cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)

        create_directory('/var/log/kontext', WEBSERVER_USER, None)
        create_directory('/tmp/kontext-upload', WEBSERVER_USER, None, 0o775)

        subprocess.check_call(['npm', 'install'], cwd = self.kontext_path, stdout=self.stdout)
        subprocess.check_call(['make', 'production'], cwd = self.kontext_path, stdout=self.stdout)



class SetupDefaultUsers(InstallationStep):
    def __init__(self, kontext_path: str, stdout: str):
        super().__init__(kontext_path, stdout)
        self.redis_client = redis.Redis(host='localhost', port=6379, db=1)

    def is_done(self):
        redis_keys = self.redis_client.keys()
        return all(key in redis_keys for key in ['user:1', 'corplist:user:1', 'user:2', 'corplist:user:2', 'user_index'])

    def abort(self):
        self.redis_client.flushdb()

    def run(self):
        print('Setting up Kontext users...')
        
        # set up anonymous user in Redis
        self.redis_client.set('user:1', json.dumps({'id': 1, 'username': 'anonymous', 'firstname': 'Anonymous', 'lastname': None, 'email': None, 'pwd_hash': None}))
        self.redis_client.set('corplist:user:1', json.dumps(['susanne']))
        
        # set up kontext user in Redis
        password, password_hash = generate_random_password()
        self.redis_client.set('user:2', json.dumps({'id': 2, 'username': 'kontext', 'firstname': 'Kontext', 'lastname': 'Test', 'pwd_hash': password_hash, 'email': 'test@example.com'}))
        self.redis_client.set('corplist:user:2', json.dumps(['susanne']))
        self.redis_client.hset('user_index', 'kontext', '"user:2"')

        self.add_final_message(f'''
            {bcolors.BOLD}{bcolors.OKGREEN}
            To login as a test user, please use the following credentials:
                username: kontext
                password: {password}
            {bcolors.ENDC}{bcolors.ENDC}
        ''')
