from typing import List

import os
import subprocess
import inspect
import argparse

KONTEXT_PATH = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))
MANATEE_VER='2.167.8'

REQUIREMENTS = [
    'python2', # reqiuired by the manatee-open package
    'python3-pip',
    'wget',
    'curl',
    'openssh-server',
    'net-tools',
    'redis-server',
    'build-essential',
    'openssl',
    'pkg-config',
    'swig',
    'nginx',
    'libltdl7',
    'libpcre3',
    'libicu-dev',
    'libpcre++-dev',
    'libxml2-dev',
    'libxslt1-dev',
    'libltdl-dev',
    # required by manatee packages
    'm4',
    'parallel',
    'locales-all'
]


if __name__ == "__main__":
    argparser = argparse.ArgumentParser('Kontext instalation script')
    argparser.add_argument('--gunicorn', dest='install_gunicorn', action='store_true', default=False, help='Install gunicorn to run web server')
    argparser.add_argument('--patch', dest='patch_path', action='store', default=None, help='Path to UCNK Manatee patch')
    argparser.add_argument('--manatee-version', dest='manatee_version', action='store', default=MANATEE_VER, help='Set Manatee version')
    argparser.add_argument('--no-safe-http', dest='no_cert_check', action='store_true', default=False, help='Do not verify HTTPS certificates when downloading packages')
    argparser.add_argument('-v', dest='verbose', action='store_true', default=False, help='Verbose mode')
    args = argparser.parse_args()

    stdout = None if args.verbose else open(os.devnull, 'wb')
    stderr = None

    subprocess.call(['systemctl', 'stop', 'celery'])
    subprocess.call(['systemctl', 'stop', 'gunicorn'])

    # install prerequisites
    print('Installing requirements...')
    try:
        subprocess.check_call(['locale-gen', 'en_US.UTF-8'], stdout=stdout)
        subprocess.check_call(['apt-get', 'update', '-y'], stdout=stdout)
        subprocess.check_call(['apt-get', 'install', '-y'] + REQUIREMENTS, stdout=stdout)
        subprocess.check_call(['python3', '-m', 'pip', 'install', 'pip', '--upgrade'], stdout=stdout)
        subprocess.check_call(['pip3 install simplejson \'celery==4.4.*\' signalfd -r requirements.txt'], cwd=KONTEXT_PATH, stdout=stdout, shell=True)
        subprocess.check_call('curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -', shell=True)
        subprocess.check_call('sudo apt-get install -y nodejs', shell=True)
    except Exception as ex:
        print(f'failed to install dependencies: {ex}')

    # import steps here, because some depend on packages installed by this script
    import steps
    # run installation steps
    steps.SetupManatee(KONTEXT_PATH, stdout, stderr, args.no_cert_check).run(args.manatee_version, args.patch_path)
    steps.SetupKontext(KONTEXT_PATH, stdout, stderr).run()
    steps.SetupDefaultUsers(KONTEXT_PATH, stdout, stderr).run()
    if args.install_gunicorn:
        steps.SetupGunicorn(KONTEXT_PATH, stdout, stderr).run()

    # finalize instalation
    print('Initializing celery and nginx services...')
    subprocess.check_call(['systemctl', 'start', 'celery'], stdout=stdout)
    subprocess.check_call(['systemctl', 'restart', 'nginx'], stdout=stdout)
    if args.install_gunicorn:
        print('Initializing gunicorn...')
        subprocess.check_call(['systemctl', 'start', 'gunicorn'], stdout=stdout)

    # print final messages
    print(inspect.cleandoc(f'''
        {steps.bcolors.BOLD}{steps.bcolors.OKGREEN}
        KonText installation successfully completed.
        To start KonText, enter the following command in the KonText install root directory (i.e. {KONTEXT_PATH}):
        
            sudo -u {steps.WEBSERVER_USER} python3 public/app.py --address 127.0.0.1 --port 8080

        (--address and --port parameters are optional; default serving address is 127.0.0.1:5000)
        or you can use Gunicorn instead.
        {steps.bcolors.ENDC}{steps.bcolors.ENDC}
    '''))

    for message in steps.InstallationStep.final_messages:
        print(inspect.cleandoc(message))
