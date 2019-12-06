from typing import List

import os
import sys
import subprocess
import inspect
import steps

KONTEXT_PATH = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))
INSTALL_PATH = '/opt/kontext'

APT_REQUIREMENTS = [
    'ca-certificates',
    'curl',
    'nodejs',
    'npm',
    'openssh-server',
    'net-tools',
    'nginx',
    'redis-server',
    'build-essential',
    'openssl',
    'libssl-dev',
    'pkg-config',
    'wget',
    # 'python',
    # 'python-dev',
    # 'python-pip',
    # 'python-lxml',
    # 'python-jinja2',
    # 'python-simplejson',
    'libltdl7',
    'libpcre3',
    'swig',
    'libpcre++-dev',
    'libxml2-dev',
    'libxslt-dev',
    'libltdl-dev'
]

PYTHON_PACKAGES = [
    'lxml',
    'jinja2',
    'simplejson',
    'redis',
    'gunicorn',
    'celery',
    'signalfd'
]
PYTHON_REQUIREMENTS = [
    os.path.join(KONTEXT_PATH, 'requirements.txt')
]


def install_apps(apps: List[str]):
    try:
        subprocess.check_call(['apt-get', 'update', '-y'])
        subprocess.check_call(['locale-gen', 'en_US.UTF-8'])
        for app in apps:
            subprocess.check_call(['apt-get', 'install', '-y', app])
    except subprocess.CalledProcessError as e:
        print(e.output)
        raise e


def install_python_packages(pkgs: List[str], req_files: List[str]):
    try:
        subprocess.check_call(['pip3', 'install', *pkgs])
        subprocess.check_call(['pip3', 'install', *[item for req_file in req_files for item in ['-r', req_file]]])
    except subprocess.CalledProcessError as e:
        print(e.output)
        raise e


if __name__ == "__main__":
    # install prerequisites
    install_apps(APT_REQUIREMENTS)
    install_python_packages(PYTHON_PACKAGES, PYTHON_REQUIREMENTS)
    
    # installation steps
    steps.SetupManatee(KONTEXT_PATH).run()
    steps.SetupKontext(KONTEXT_PATH).run()
    steps.SetupDefaultUsers(KONTEXT_PATH).run()
    
    # finalize instalation
    subprocess.check_call(['systemctl', 'start', 'celery'])
    subprocess.check_call(['systemctl', 'restart', 'nginx'])
    for message in steps.InstallationStep.final_messages:
        print(inspect.cleandoc(message))
