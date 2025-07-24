# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Department of Linguistics
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


import argparse
import inspect
import os
import sys
import subprocess
import venv

KONTEXT_PATH = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))
KONTEXT_INSTALL_CONF = os.environ.get('KONTEXT_INSTALL_CONF', 'config.default.xml')
SCHEDULER_INSTALL_CONF = os.environ.get('SCHEDULER_INSTALL_CONF', 'rq-schedule-conf.sample.json')
MANATEE_VER = '2.225.8'
NODE_VERSION = '22.13.0'

REQUIREMENTS = [
    'python3-pip',
    'python3-venv',
    'wget',
    'curl',
    'openssh-server',
    'net-tools',
    'redis-server',
    'build-essential',
    'autoconf-archive',
    'openssl',
    'pkg-config',
    'swig',
    'nginx',
    'libltdl7',
    'libicu-dev',
    'libpcre2-dev',
    'libxml2-dev',
    'libxslt1-dev',
    'libltdl-dev',
    # required by manatee packages
    'm4',
    'parallel',
    'locales-all',
    'sox',
    'bison',
    'libcairo2',
]


if __name__ == "__main__":
    argparser = argparse.ArgumentParser('Kontext instalation script')
    argparser.add_argument('--ucnk', action='store_true', help='Use UCNK sources')
    argparser.add_argument('--no-venv', action='store_true', help='Do not create virtualenv automatically')
    argparser.add_argument('--patch', dest='patch_paths', action='append',
                           default=[], help='Path to UCNK Manatee patch')
    argparser.add_argument('--manatee-version', dest='manatee_version',
                           action='store', default=MANATEE_VER, help='Set Manatee version')
    argparser.add_argument('--no-safe-http', dest='no_cert_check', action='store_true',
                           help='Do not verify HTTPS certificates when downloading packages')
    argparser.add_argument('-v', dest='verbose', action='store_true',
                           help='Verbose mode')
    args = argparser.parse_args()

    stdout = None if args.verbose else open(os.devnull, 'wb')
    stderr = None

    subprocess.call(['systemctl', 'stop', 'rq-all.target'])
    subprocess.call(['systemctl', 'stop', 'rqscheduler'])

    # install prerequisites
    print('Installing requirements...')
    try:
        subprocess.check_call(['locale-gen', 'en_US.UTF-8'], stdout=stdout)
        subprocess.check_call(['apt-get', 'update', '-y'], stdout=stdout)
        subprocess.check_call(['apt-get', 'install', '-y'] + REQUIREMENTS, stdout=stdout)

        # create virtual environment
        venv_path, venv_bin_path = None, ''
        if not args.no_venv:
            venv_path = os.path.join(KONTEXT_PATH, 'venv')
            venv.create(venv_path, with_pip=True, symlinks=True)
            venv_bin_path = os.path.join(venv_path, 'bin')

        # install python packages
        subprocess.check_call([os.path.join(venv_bin_path, 'python3'), '-m', 'pip', 'install', 'pip' '--upgrade'],
                              stdout=stdout)
        subprocess.check_call([os.path.join(venv_bin_path, 'pip3'), 'install', 'simplejson', 'signalfd', '-r', 'requirements.txt'],
                              cwd=KONTEXT_PATH, stdout=stdout)

        # install node.js
        env_variables = os.environ.copy()
        nvm_dir = env_variables['NVM_DIR'] = "/usr/local/nvm"
        os.makedirs(nvm_dir, exist_ok=True)
        subprocess.check_call(
            'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash', shell=True, env=env_variables)
        subprocess.check_call(f'[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh" && nvm install {NODE_VERSION}', shell=True, env=env_variables)
        npm_path = os.path.join(nvm_dir, 'versions/node', f'v{NODE_VERSION}', 'bin')

    except Exception as ex:
        print(f'failed to install dependencies: {ex}')
        sys.exit(1)

    # import steps here, because some depend on packages installed by this script
    import steps

    # run installation steps
    steps.SetupBgCalc(KONTEXT_PATH, stdout, stderr).run()
    steps.SetupNginx(KONTEXT_PATH, stdout, stderr).run()
    steps.SetupManatee(KONTEXT_PATH, stdout, stderr, args.no_cert_check, venv_path).run(
        args.manatee_version, args.patch_paths, ucnk_manatee=args.ucnk)
    steps.SetupKontext(
        kontext_path=KONTEXT_PATH, kontext_conf=KONTEXT_INSTALL_CONF,
        scheduler_conf=SCHEDULER_INSTALL_CONF, stdout=stdout, stderr=stderr, npm_path=npm_path).run()

    # redis is installed in virtual environment
    if args.no_venv:
        steps.SetupDefaultUsers(KONTEXT_PATH, stdout, stderr).run()
    else:
        subprocess.check_call([os.path.join(venv_bin_path, 'python3'), steps.__file__, 'SetupDefaultUsers'])


    # finalize instalation
    print('Initializing Rq...')
    subprocess.check_call(['systemctl', 'start', 'rq-all.target'], stdout=stdout)
    subprocess.check_call(['systemctl', 'start', 'rqscheduler'], stdout=stdout)

    print('Initializing Nginx...')
    subprocess.check_call(['systemctl', 'restart', 'nginx'], stdout=stdout)

    # print final messages
    relative_python_path = os.path.join(venv_bin_path.replace(KONTEXT_PATH, '.'), 'python3')
    print(inspect.cleandoc(f'''
        {steps.bcolors.BOLD}{steps.bcolors.OKGREEN}
        KonText installation successfully completed.
        To start KonText, enter the following command in the KonText install root directory (i.e. {KONTEXT_PATH}):

            sudo -u {steps.WEBSERVER_USER} {relative_python_path} public/app.py --address 127.0.0.1 --port 8080

        (--address and --port parameters are optional; default serving address is 127.0.0.1:5000)
        {steps.bcolors.ENDC}{steps.bcolors.ENDC}
    '''))

    for message in steps.InstallationStep.final_messages:
        print(inspect.cleandoc(message))
