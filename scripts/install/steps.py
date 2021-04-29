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
import re
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lib/plugins/default_auth'))
from tools import mk_pwd_hash_default

WEBSERVER_USER = "www-data"

CELERY_CONFIG = """
<calc_backend>
    <type>celery</type>
    <task_time_limit>300</task_time_limit>
    <status_service_url />
    <celery_broker_url>redis://127.0.0.1:6379/2</celery_broker_url>
    <celery_result_backend>redis://127.0.0.1:6379/2</celery_result_backend>
    <celery_task_serializer>json</celery_task_serializer>
    <celery_result_serializer>json</celery_result_serializer>
    <celery_accept_content>
        <item>json</item>
    </celery_accept_content>
    <celery_timezone>Europe/Prague</celery_timezone>
</calc_backend>
"""

CELERY_SCHEDULER_CONFIG = """
<job_scheduler>
    <type>celery</type>
    <conf>/opt/kontext/conf/beatconfig.py</conf>
</job_scheduler>
"""


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

    def cmd(self, args, cwd):
        return subprocess.check_call(args, cwd=cwd, stdout=self.stdout, stderr=self.stderr)


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

    def run(self, celery_worker):
        try:
            subprocess.check_call(['useradd', '-r', '-s', '/bin/false',
                                   'celery'], stdout=self.stdout)
        except:
            pass

        if celery_worker:
            print('Setting up Celery...')
            subprocess.check_call(['adduser', 'celery', WEBSERVER_USER], stdout=self.stdout)
            create_directory('/etc/conf.d')
            subprocess.check_call(['cp', os.path.join(
                self.kontext_path, 'scripts/install/conf/celery-conf.d'), '/etc/conf.d/celery'], stdout=self.stdout)
            subprocess.check_call(['cp', os.path.join(
                self.kontext_path, 'scripts/install/conf/celery.service'), '/etc/systemd/system'], stdout=self.stdout)
            replace_string_in_file('/etc/systemd/system/celery.service',
                                   '/opt/kontext', self.kontext_path)
            subprocess.check_call(['cp', os.path.join(
                self.kontext_path, 'scripts/install/conf/celery.tmpfiles'), '/usr/lib/tmpfiles.d/celery.conf'], stdout=self.stdout)
            create_directory('/var/log/celery', 'celery', 'root')
            create_directory('/var/run/celery', 'celery', 'root')
            subprocess.check_call(['systemctl', 'enable', 'celery'], stdout=self.stdout)
        else:
            print('Setting up Rq...')
            subprocess.check_call(['cp', os.path.join(
                self.kontext_path, 'scripts/install/conf/rq-all.target'), '/etc/systemd/system'], stdout=self.stdout)
            subprocess.check_call(['cp', os.path.join(
                self.kontext_path, 'scripts/install/conf/rq@.service'), '/etc/systemd/system'], stdout=self.stdout)
            replace_string_in_file('/etc/systemd/system/rq@.service',
                                   '/opt/kontext', self.kontext_path)
            subprocess.check_call(['cp', os.path.join(
                self.kontext_path, 'scripts/install/conf/rqscheduler.service'), '/etc/systemd/system'], stdout=self.stdout)
            create_directory('/var/log/rq', 'celery', 'root')
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

    def __init__(self, kontext_path: str, stdout: str, stderr: str, no_cert_check: bool):
        super().__init__(kontext_path, stdout, stderr)
        self._ncc = no_cert_check

    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self, manatee_version: str, patch_path: str = None, make_symlinks: bool = True):
        # install manatee with ucnk patch
        print('Installing manatee...')

        # build manatee from source using patch
        subprocess.check_call(wget_cmd(
            f'http://corpora.fi.muni.cz/noske/src/manatee-open/manatee-open-{manatee_version}.tar.gz', self._ncc), cwd='/usr/local/src', stdout=self.stdout)
        subprocess.check_call(
            ['tar', 'xzvf', f'manatee-open-{manatee_version}.tar.gz'], cwd='/usr/local/src', stdout=self.stdout)

        if patch_path is not None:
            if os.path.isfile(os.path.join(self.kontext_path, patch_path)):
                subprocess.check_call(['cp', os.path.join(self.kontext_path, patch_path), './'],
                                      cwd=f'/usr/local/src/manatee-open-{manatee_version}', stdout=self.stdout)
                subprocess.check_call(['patch', '-p0', '-i', os.path.basename(patch_path)],
                                      cwd=f'/usr/local/src/manatee-open-{manatee_version}', stdout=self.stdout)
            else:
                raise FileNotFoundError(
                    f'Patch file `{os.path.join(self.kontext_path, patch_path)}` not found!')

        python_path = subprocess.check_output(['which', 'python3']).decode().split()[0]
        env_variables = os.environ.copy()
        env_variables['PYTHON'] = python_path
        subprocess.check_call(['./configure', '--with-pcre'],
                              cwd=f'/usr/local/src/manatee-open-{manatee_version}', stdout=self.stdout, env=env_variables)
        subprocess.check_call(
            ['make'], cwd=f'/usr/local/src/manatee-open-{manatee_version}', stdout=self.stdout)
        subprocess.check_call(
            ['make', 'install'], cwd=f'/usr/local/src/manatee-open-{manatee_version}', stdout=self.stdout)
        subprocess.check_call(['ldconfig'], stdout=self.stdout)

        if make_symlinks:
            lib_path = [path for path in sys.path if path.startswith(
                '/usr/local/lib/python3') and path.endswith('dist-packages')][0]
            make_simlink(os.path.join(lib_path, '../site-packages/manatee.py'),
                         os.path.join(lib_path, 'manatee.py'))
            make_simlink(os.path.join(lib_path, '../site-packages/_manatee.a'),
                         os.path.join(lib_path, '_manatee.a'))
            make_simlink(os.path.join(lib_path, '../site-packages/_manatee.la'),
                         os.path.join(lib_path, '_manatee.la'))
            make_simlink(os.path.join(lib_path, '../site-packages/_manatee.so'),
                         os.path.join(lib_path, '_manatee.so'))

        # install susanne corpus
        subprocess.check_call(wget_cmd('https://corpora.fi.muni.cz/noske/src/example-corpora/susanne-example-source.tar.bz2', self._ncc),
                              cwd='/usr/local/src', stdout=self.stdout)
        subprocess.check_call(['tar', 'xjvf', 'susanne-example-source.tar.bz2'],
                              cwd='/usr/local/src', stdout=self.stdout)

        create_directory('/var/lib/manatee/registry')
        create_directory('/var/lib/manatee/vert')
        create_directory('/var/lib/manatee/data/susanne')
        create_directory('/var/local/corpora/user_filter_files')

        replace_string_in_file('/usr/local/src/susanne-example-source/config',
                               'PATH susanne', 'PATH /var/lib/manatee/data/susanne')
        subprocess.check_call(['cp', './source', '/var/lib/manatee/vert/susanne.vert'],
                              cwd='/usr/local/src/susanne-example-source', stdout=self.stdout)
        subprocess.check_call(['cp', './config', '/var/lib/manatee/registry/susanne'],
                              cwd='/usr/local/src/susanne-example-source', stdout=self.stdout)

        subprocess.check_call(['encodevert', '-v', '-c', './config', '-p', '/var/lib/manatee/data/susanne',
                               './source'], cwd='/usr/local/src/susanne-example-source', stdout=self.stdout)


class SetupKontext(InstallationStep):
    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self, use_celery, build_production=True):
        print('Installing kontext...')
        subprocess.check_call(['cp', 'config.default.xml', 'config.xml'],
                              cwd=os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)
        subprocess.check_call(['cp', 'corplist.default.xml', 'corplist.xml'],
                              cwd=os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)

        # celery config if required
        if use_celery:
            subprocess.check_call(['cp', 'beatconfig.sample.py', 'beatconfig.py'],
                                  cwd=os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)
            replace_string_in_file(os.path.join(self.kontext_path, 'conf/config.xml'),
                                   r'<calc_backend>[\s\S]*<\/calc_backend>', CELERY_CONFIG)
            replace_string_in_file(os.path.join(self.kontext_path, 'conf/config.xml'),
                                   r'<job_scheduler>[\s\S]*<\/job_scheduler>', CELERY_SCHEDULER_CONFIG)
        else:
            subprocess.check_call(['cp', 'rq-schedule-conf.sample.json', 'rq-schedule-conf.json'],
                                  cwd=os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)

        # update config.xml with current install path
        replace_string_in_file(os.path.join(self.kontext_path, 'conf/config.xml'),
                               '/opt/kontext', self.kontext_path)

        # create directories, set permissions
        create_directory('/var/local/corpora/registry', WEBSERVER_USER, WEBSERVER_USER)
        create_directory('/var/local/corpora/cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/subcorp', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/freqs-precalc', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/freqs-cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)
        create_directory('/var/local/corpora/colls-cache', WEBSERVER_USER, WEBSERVER_USER, 0o2775)

        create_directory('/var/log/kontext', WEBSERVER_USER, None)
        create_directory('/tmp/kontext-upload', WEBSERVER_USER, None, 0o775)

        if build_production:
            subprocess.check_call(['npm', 'install'], cwd=self.kontext_path, stdout=self.stdout)
            self.cmd(['npm', 'start', 'build:production'], cwd=self.kontext_path)


class SetupGunicorn(InstallationStep):
    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self):
        print('Installing gunicorn...')
        subprocess.check_call(['pip3', 'install', 'gunicorn'], stdout=self.stdout)

        subprocess.check_call(['cp', 'gunicorn-conf.sample.py', 'gunicorn-conf.py'],
                              cwd=os.path.join(self.kontext_path, 'conf'), stdout=self.stdout)
        subprocess.check_call(['cp', os.path.join(
            self.kontext_path, 'scripts/install/conf/gunicorn.service'), '/etc/systemd/system'], stdout=self.stdout)
        replace_string_in_file('/etc/systemd/system/gunicorn.service',
                               '/opt/kontext', self.kontext_path)
        create_directory('/var/log/gunicorn/kontext', WEBSERVER_USER, None)

        subprocess.check_call(['systemctl', 'enable', 'gunicorn'], stdout=self.stdout)


class SetupFFMpeg(InstallationStep):
    def is_done(self):
        pass

    def abort(self):
        pass

    def run(self):
        print('Installing ffmpeg...')
        subprocess.check_call(['sh', os.path.join(
            self.kontext_path, 'scripts/install/install-min-ffmpeg.sh')], stdout=self.stdout)


class SetupDefaultUsers(InstallationStep):
    def __init__(self, kontext_path: str, stdout: str, stderr: str, redis_host: str = 'localhost', redis_port=6379):
        super().__init__(kontext_path, stdout, stderr)
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


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser('Run step')
    parser.add_argument('step_name', metavar='NAME', type=str, help='Step name')
    parser.add_argument('--step_args', metavar='ARGS', type=str,
                        nargs='+', help='Step arguments', default=[])
    args = parser.parse_args()

    kontext_path = os.path.abspath(os.path.join(
        os.path.dirname(os.path.abspath(__file__)), '../..'))
    init_step_args = (kontext_path, None, None)

    if args.step_name == 'SetupKontext':
        obj = SetupKontext(*init_step_args)
        obj.run(False, False)
    elif args.step_name == 'SetupDefaultUsers':
        obj = SetupDefaultUsers(*init_step_args, args.step_args[0], int(args.step_args[1]))
        obj.run()
    elif args.step_name == 'SetupManatee':
        obj = SetupManatee(*init_step_args, True)
        obj.run(args.step_args[0], args.step_args[1], bool(int(args.step_args[2])))
    elif args.step_name == 'SetupFFMpeg':
        obj = SetupFFMpeg(*init_step_args)
        obj.run()
    else:
        raise Exception(f'Unknown action: {args.step_name}')

    for msg in obj.final_messages:
        print(msg)
