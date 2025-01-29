# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandlk@gmail.com>
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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


import json
import os
import pathlib
import random
import re
import shutil
import string
import subprocess
import sys
from abc import ABC, abstractmethod
from typing import List, Tuple

WEBSERVER_USER = "www-data"


def create_directory(path: str, user: str = None, group: str = None, mode: int = 0o755):
    p = pathlib.Path(path)
    p.mkdir(parents=True, exist_ok=True, mode=mode)
    if user or group:
        shutil.chown(p, user, group)


def replace_string_in_file(path: str, old: str, new: str):
    with open(path, 'r', encoding='utf8') as f:
        config_text = f.read()
    with open(path, 'w', encoding='utf8') as f:
        f.write(re.sub(old, new, config_text))


def generate_random_password() -> Tuple[str, str]:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lib/plugin_types/auth'))
    from hash import mk_pwd_hash_default

    password = ''.join(random.choice(string.ascii_letters + string.digits) for n in range(8))
    return password, mk_pwd_hash_default(password)


def make_simlink(src: str, dst: str) -> None:
    try:
        pathlib.Path(dst).symlink_to(src)
    except FileExistsError:
        print(f'File = {dst} already exists!')


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

    def __init__(self, kontext_path: str, stdout: str, stderr: str):
        self.kontext_path = kontext_path
        self.stdout = stdout
        self.stderr = stderr

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

    def cmd(self, args, cwd, env=None):
        return subprocess.check_call(args, cwd=cwd, stdout=self.stdout, stderr=self.stderr, env=env)


def wget_cmd(url, no_cert_check):
    if no_cert_check:
        return ['wget', '--no-check-certificate', url, '-N']
    return ['wget', url, '-N']


class SetupBgCalc(InstallationStep):
    def __init__(self, kontext_path: str, stdout: str, stderr: str):
        super().__init__(kontext_path, stdout, stderr)

    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self):
        subprocess.check_call(['cp', os.path.join(
            self.kontext_path, 'scripts/install/conf/rq-all.target'), '/etc/systemd/system'], stdout=self.stdout)
        subprocess.check_call(['cp', os.path.join(
            self.kontext_path, 'scripts/install/conf/rq@.service'), '/etc/systemd/system'], stdout=self.stdout)
        replace_string_in_file('/etc/systemd/system/rq@.service',
                               '/opt/kontext', self.kontext_path)
        subprocess.check_call(['cp', os.path.join(
            self.kontext_path, 'scripts/install/conf/rqscheduler.service'), '/etc/systemd/system'], stdout=self.stdout)
        create_directory('/var/log/rq', 'www-data', 'root')
        subprocess.check_call(['systemctl', 'enable', 'rq-all.target'], stdout=self.stdout)
        subprocess.check_call(['systemctl', 'enable', 'rqscheduler'], stdout=self.stdout)

        subprocess.check_call(['systemctl', 'daemon-reload'], stdout=self.stdout)


class SetupNginx(InstallationStep):
    def __init__(self, kontext_path: str, stdout: str, stderr: str):
        super().__init__(kontext_path, stdout, stderr)

    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self):
        # config nginx
        print('Setting up nginx...')
        subprocess.check_call(['cp', os.path.join(self.kontext_path, 'scripts/install/conf/nginx'),
                               '/etc/nginx/sites-available/default'], stdout=self.stdout)


class SetupManatee(InstallationStep):

    def __init__(self, kontext_path: str, stdout: str, stderr: str, no_cert_check: bool, venv_path: str = None):
        super().__init__(kontext_path, stdout, stderr)
        self._ncc = no_cert_check
        self._venv_path = venv_path

    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self, manatee_version: str, patch_paths: List[str], make_symlinks: bool = True, ucnk_manatee: bool = False):
        # install manatee with ucnk patch
        print('Installing Manatee-Open...')
        src_working_dir = f'/usr/local/src/manatee-open-{manatee_version}'

        version_found = False
        if ucnk_manatee:
            cwd, dir = '/usr/local/src', f'manatee-open-{manatee_version}'
            if not os.path.exists(os.path.join(cwd, dir)):
                subprocess.check_call(['git', 'clone', 'https://github.com/czcorpus/manatee-open.git', dir], cwd=cwd, stdout=self.stdout)

            try:
                subprocess.check_call(
                    ['git', 'checkout', f'release-{manatee_version}'], cwd=src_working_dir, stdout=self.stdout)
                version_found = True
            except subprocess.CalledProcessError:
                pass

            if version_found:
                subprocess.check_call(['autoreconf', '--install', '--force'],
                                      cwd=src_working_dir, stdout=self.stdout)

        if not ucnk_manatee or not version_found:
            if manatee_version == '2.225.8':
                url = 'https://corpora.fi.muni.cz/noske/current/src/manatee-open-2.225.8.tar.gz'
            else:
                url = f'https://corpora.fi.muni.cz/noske/archive/src/manatee-open/manatee-open-{manatee_version}.tar.gz'
            # build manatee from source using patch
            subprocess.check_call(wget_cmd(url, self._ncc),
                                  cwd='/usr/local/src', stdout=self.stdout)
            subprocess.check_call(
                ['tar', 'xzvf', f'manatee-open-{manatee_version}.tar.gz'], cwd='/usr/local/src', stdout=self.stdout)

            for patch_path in patch_paths:
                if os.path.isfile(os.path.join(self.kontext_path, patch_path)):
                    subprocess.check_call(['cp', os.path.join(self.kontext_path, patch_path), './'],
                                          cwd=src_working_dir, stdout=self.stdout)
                    subprocess.check_call(['patch', '-p0', '-i', os.path.basename(patch_path)],
                                          cwd=src_working_dir, stdout=self.stdout)
                else:
                    raise FileNotFoundError(
                        f'Patch file `{os.path.join(self.kontext_path, patch_path)}` not found!')

        # get python path related to used environment
        if self._venv_path is not None:
            python_path = os.path.join(self._venv_path, 'bin', 'python3')
        else:
            python_path = subprocess.check_output(['which', 'python3']).decode().split()[0]

        # build manatee
        env_variables = os.environ.copy()
        env_variables['PYTHON'] = python_path
        subprocess.check_call(['./configure --with-pcre2'],
                              cwd=src_working_dir, stdout=self.stdout, env=env_variables, shell=True)
        subprocess.check_call(
            ['make'], cwd=src_working_dir, stdout=self.stdout)
        subprocess.check_call(
            ['make', 'install'], cwd=src_working_dir, stdout=self.stdout)
        subprocess.check_call(['ldconfig'], stdout=self.stdout)

        # for some reason newer versions of python manatee libs are installed in wrong path
        if os.path.exists("/usr/local/local/lib"):
            subprocess.check_call(['cp', '-r', '/usr/local/local/lib',
                                   '/usr/local'], stdout=self.stdout)

        # manatee always installs to system site-packages
        # we need to make link to system dist-packages or venv site-packages
        if make_symlinks:
            package_path = subprocess.check_output([f'{python_path} -c "import sysconfig; print(sysconfig.get_paths()[\'purelib\'])"'], shell=True).decode().strip()
            system_package_path = subprocess.check_output(['/usr/bin/python3 -c "import sysconfig; print(sysconfig.get_paths()[\'purelib\'])"'], shell=True).decode().strip()
            manatee_package_path = os.path.join(system_package_path, '../site-packages')
            print(f'Creating symlinks from {manatee_package_path} to {package_path}')
            make_simlink(os.path.join(manatee_package_path, 'manatee.py'),
                        os.path.join(package_path, 'manatee.py'))
            make_simlink(os.path.join(manatee_package_path, '_manatee.a'),
                        os.path.join(package_path, '_manatee.a'))
            make_simlink(os.path.join(manatee_package_path, '_manatee.la'),
                        os.path.join(package_path, '_manatee.la'))
            make_simlink(os.path.join(manatee_package_path, '_manatee.so'),
                        os.path.join(package_path, '_manatee.so'))

        # install susanne corpus
        subprocess.check_call(wget_cmd('https://corpora.fi.muni.cz/noske/src/example-corpora/susanne-example-source.tar.bz2', self._ncc),
                              cwd='/usr/local/src', stdout=self.stdout)
        subprocess.check_call(['tar', 'xjvf', 'susanne-example-source.tar.bz2'],
                              cwd='/usr/local/src', stdout=self.stdout)

        create_directory('/var/lib/manatee/registry')
        create_directory('/var/lib/manatee/vert')
        create_directory('/var/lib/manatee/data/susanne')

        replace_string_in_file('/usr/local/src/susanne-example-source/config',
                               'PATH susanne', 'PATH /var/lib/manatee/data/susanne')
        subprocess.check_call(['cp', './source', '/var/lib/manatee/vert/susanne.vert'],
                              cwd='/usr/local/src/susanne-example-source', stdout=self.stdout)
        subprocess.check_call(['cp', './config', '/var/lib/manatee/registry/susanne'],
                              cwd='/usr/local/src/susanne-example-source', stdout=self.stdout)

        subprocess.check_call(['encodevert', '-v', '-c', './config', '-p', '/var/lib/manatee/data/susanne',
                               './source'], cwd='/usr/local/src/susanne-example-source', stdout=self.stdout)


class SetupKontext(InstallationStep):

    def __init__(self, kontext_path: str, kontext_conf: str, scheduler_conf: str, stdout: str, stderr: str, npm_path: str = None):
        super().__init__(kontext_path, stdout, stderr)
        self._kontext_conf = kontext_conf
        self._scheduler_conf = scheduler_conf
        self._npm_path = npm_path

    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self, build_production=True):
        print('Installing kontext...')
        subprocess.check_call(['cp', self._kontext_conf, 'config.xml'],
                              cwd=os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)
        subprocess.check_call(['cp', 'corplist.default.xml', 'corplist.xml'],
                              cwd=os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)
        subprocess.check_call(['cp', self._scheduler_conf, 'rq-schedule-conf.json'],
                              cwd=os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)

        # update config.xml with current install path
        replace_string_in_file(os.path.join(self.kontext_path, 'conf/config.xml'),
                               '/opt/kontext', self.kontext_path)

        # create directories, set permissions
        create_directory('/var/local/corpora', WEBSERVER_USER, WEBSERVER_USER)
        create_directory('/var/local/corpora/registry', WEBSERVER_USER, WEBSERVER_USER)
        create_directory('/var/local/corpora/cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/subcorp', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/freqs-precalc', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/freqs-cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/colls-cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/query_persistence',
                         WEBSERVER_USER, WEBSERVER_USER, 0o2775)

        create_directory('/var/log/kontext', WEBSERVER_USER, None)
        create_directory('/tmp/kontext-upload', WEBSERVER_USER, None, 0o775)

        if build_production:
            env_variables = os.environ.copy()
            if self._npm_path is not None:
                env_variables['PATH'] = f'{self._npm_path}:{env_variables["PATH"]}'
            subprocess.check_call(['npm', 'install'], cwd=self.kontext_path, stdout=self.stdout, env=env_variables)
            self.cmd(['npm', 'start', 'build:production'], cwd=self.kontext_path, env=env_variables)


class SetupDefaultUsers(InstallationStep):
    def __init__(self, kontext_path: str, stdout: str, stderr: str, redis_host: str = 'localhost', redis_port=6379):
        super().__init__(kontext_path, stdout, stderr)

        import redis
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, db=1)

    def is_done(self):
        redis_keys = self.redis_client.keys()
        return all(key in redis_keys for key in ['user:0', 'corplist:user:0', 'user:1', 'corplist:user:1', 'user_index'])

    def abort(self):
        self.redis_client.flushdb()

    def run(self):
        print('Setting up Kontext users...')

        # set up anonymous user in Redis
        self.redis_client.set('user:0', json.dumps(
            {'id': 0, 'username': 'anonymous', 'firstname': 'Anonymous', 'lastname': None, 'email': None, 'pwd_hash': None}))
        self.redis_client.set('corplist:user:0', json.dumps(['susanne']))

        # set up kontext user in Redis
        password, password_hash = generate_random_password()
        self.redis_client.set('user:1', json.dumps(
            {'id': 1, 'username': 'kontext', 'firstname': 'Kontext', 'lastname': 'Test', 'pwd_hash': password_hash, 'email': 'test@example.com'}))
        self.redis_client.set('corplist:user:1', json.dumps(['susanne']))
        self.redis_client.hset('user_index', 'kontext', '"user:1"')

        self.add_final_message(f'''
            {bcolors.BOLD}{bcolors.OKGREEN}
            To login as a test user, please use the following credentials:
                username: kontext
                password: {password}
            {bcolors.ENDC}{bcolors.ENDC}
        ''')


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser('Run step')
    parser.add_argument('step_name', metavar='NAME', type=str, help='Step name')
    parser.add_argument('--ucnk', action='store_true', default=False, help='Use UCNK sources')
    parser.add_argument('--step-args', metavar='ARGS', type=str,
                        nargs='+', help='Step arguments', default=[])
    args = parser.parse_args()

    kontext_path = os.path.abspath(os.path.join(
        os.path.dirname(os.path.abspath(__file__)), '../..'))
    init_step_args = (kontext_path, None, None)

    if args.step_name == 'SetupKontext':
        obj = SetupKontext(
            kontext_path=kontext_path, kontext_conf=os.environ.get(
                'KONTEXT_INSTALL_CONF', 'config.default.xml'),
            scheduler_conf=os.environ.get('SCHEDULER_INSTALL_CONF', 'rq-schedule-conf.sample.json'),
            stdout=None, stderr=None)
        obj.run(False)

    elif args.step_name == 'SetupDefaultUsers':
        try:
            obj = SetupDefaultUsers(*init_step_args, args.step_args[0], int(args.step_args[1]))
        except IndexError:
            obj = SetupDefaultUsers(*init_step_args)
        obj.run()

    elif args.step_name == 'SetupManatee':
        obj = SetupManatee(*init_step_args, True)
        obj.run(args.step_args[0], args.step_args[1:-1], bool(int(args.step_args[-1])), args.ucnk)

    else:
        raise Exception(f'Unknown action: {args.step_name}')

    for msg in obj.final_messages:
        print(msg)
