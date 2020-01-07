from typing import List

import os
import sys
import subprocess
import inspect

KONTEXT_PATH = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))

REQUIREMENTS = [
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
    'npm',
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
    stdout = open(os.devnull, 'wb')
    print(sys.argv)
    if '-v' in sys.argv:
        stdout = None

    # install prerequisites
    print('Installing requirements...')
    subprocess.check_call(['locale-gen', 'en_US.UTF-8'], cwd=KONTEXT_PATH, stdout=stdout)
    subprocess.check_call(['apt-get', 'update', '-y'], cwd=KONTEXT_PATH, stdout=stdout)
    subprocess.check_call(['apt-get', 'install', '-y'] + REQUIREMENTS, cwd=KONTEXT_PATH, stdout=stdout)
    subprocess.check_call(['pip3', 'install', 'simplejson', 'celery', 'signalfd', '-r', 'requirements.txt'], cwd=KONTEXT_PATH, stdout=stdout)

    # import steps here, because some depend on packages installed by this script
    import steps
    # run installation steps
    steps.SetupManatee(KONTEXT_PATH, stdout).run()
    steps.SetupKontext(KONTEXT_PATH, stdout).run()
    steps.SetupDefaultUsers(KONTEXT_PATH, stdout).run()
    
    # finalize instalation
    print('Initializing celery and nginx services...')
    subprocess.check_call(['systemctl', 'start', 'celery'], stdout=stdout)
    subprocess.check_call(['systemctl', 'restart', 'nginx'], stdout=stdout)

    # print final messages
    print(inspect.cleandoc(f'''
        {steps.bcolors.BOLD}{steps.bcolors.OKGREEN}
        KonText installation successfully completed.
        To start KonText, enter the following command in the KonText install root directory (i.e. {KONTEXT_PATH}):
        
            sudo -u {steps.WEBSERVER_USER} python3 public/app.py --address 127.0.0.1 --port 8080

        (--address and --port parameters are optional; default serving address is 127.0.0.1:5000)
        {steps.bcolors.ENDC}{steps.bcolors.ENDC}
    '''))

    for message in steps.InstallationStep.final_messages:
        print(inspect.cleandoc(message))
