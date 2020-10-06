# upgrade KonText v 0.13.x to 0.15
import sys
import os
import re
import shutil
try:
    from lxml import etree
    import pip
except ImportError as ex:
    print(ex)
    print('Please install pip3 (`sudo apt install python3-pip`) and lxml packages before you continue.')
    sys.exit(1)
import subprocess
from subprocess import Popen, PIPE

PYLIB_LOCATIONS = (
    '/usr/local/lib/python2.7',
    '/usr/lib/python2.7',
)

OKBLUE = '\033[94m'
FAIL = '\033[91m'
ENDC = '\033[0m'

MANATEE_VER = '2.167.10'


def print_em(s):
    print(f'{OKBLUE}{s}{ENDC}')


def print_err(s):
    print(f'{FAIL}{s}{ENDC}')


def stop_with_error(msg, err_code=1, ask_ignore=False):
    if type(msg) is not tuple:
        msg = (msg,)
    for item in msg:
        print(item)
    if ask_ignore:
        v = None
        while v not in ('y', 'n'):
            v = input('This issue can be ignored. Ignore? (y/n) ')
            if v == 'y':
                return
    sys.exit(err_code)


def ask_if_continue():
    v = None
    while v not in ('y', 'n'):
        v = input('Continue? (y/n) ')
        if v == 'y':
            return
    sys.exit(1)


def find_files_matching(root_dir, predicate, recursive=True, modifier=lambda x: x):
    ans = set()
    try:
        for item in os.listdir(root_dir):
            fpath = os.path.join(root_dir, item)
            if os.path.isfile(fpath) and predicate(fpath):
                ans.add(modifier(fpath))
            elif os.path.isdir(fpath) and recursive:
                ans = ans.union(find_files_matching(fpath, predicate, True))
    except FileNotFoundError:
        print(f'Failed to explore Python libraries search location {root_dir}. Skipping...')
    return ans


def find_old_gunicorn():
    print_em('About to check for existing Gunicorn instance')
    items = set()
    for loc in PYLIB_LOCATIONS:
        items = items.union(find_files_matching(
            loc, lambda p: 'gunicorn' in p.lower() and p.endswith('.py'),
            modifier=lambda p: os.path.dirname(p)))
    if len(items) > 0:
        print('It looks like you have a Gunicorn wsgi server for Python 2 installed.')
        print_em('About to remove old Gunicorn...')
        try:
            if list(items)[0].startswith('/usr/local/lib'):
                subprocess.check_call('sudo pip uninstall gunicorn', shell=True)
                print_em('...done')
            else:
                subprocess.check_call('sudo apt-get remove python-gunicorn', shell=True)
                print_em('...done')
        except Exception as ex:
            print_err(f'Failed to uninstall the recent Gunicorn: {ex}')
            print_err('Use either `sudo pip uninstall gunicorn` or `sudo apt-get remove python-gunicorn`')
            stop_with_error('Cannot continue.')


def find_old_celery():
    print_em('About to check for existing Celery instance')
    items = set()
    for loc in PYLIB_LOCATIONS:
        items = items.union(find_files_matching(loc, lambda p: 'celery' in p.lower() and p.endswith('.py'),
                                                modifier=lambda p: os.path.dirname(p)))
    if len(items) > 0:
        print('It looks like you have a Celery wsgi server for Python 2 installed.')
        print_em('About to remove old Celery...')
        try:
            if list(items)[0].startswith('/usr/local/lib'):
                subprocess.check_call('sudo pip uninstall celery', shell=True)
                print_em('...done')
            else:
                subprocess.check_call('sudo apt-get remove python-celery', shell=True)
                print_em('...done')
        except Exception as ex:
            print_err(f'Failed to uninstall the recent Celery: {ex}')
            print_err('Use either `sudo pip uninstall celery` or `sudo apt-get remove python-celery`')
            stop_with_error('')


def check_version():
    v = sys.version_info
    if v.major != 3:
        stop_with_error('Only Python v 3 is supported')
    if v.minor < 6:
        stop_with_error('Only Python 3.6 and higher is supported')


def check_new_gunicorn():
    try:
        import gunicorn
    except ModuleNotFoundError:
        print_em('Cannot find Gunicorn module. About to install it...')
        try:
            subprocess.check_call('sudo pip3 install gunicorn', shell=True)
            print_em('   ...done')
        except Exception as ex2:
            print_err('   ...failed: {}'.format(ex2))
            stop_with_error((
                'Cannot continue',
                'Please install either with `pip3 install gunicorn` or via `apt-get install python3-gunicorn`'))


def check_new_celery():
    try:
        import celery
    except ModuleNotFoundError:
        print('Cannot find Celery module. About to install it...')
        try:
            subprocess.check_call('sudo pip3 install \'celery==4.4.*\'', shell=True)
            print_em('   ...done')
        except Exception as ex2:
            print_err('   ...failed: {}'.format(ex2))
            stop_with_error((
                'Cannot continue',
                'Please install either with `pip3 install \'celery==4.*.*\'` or via `apt-get install python3-celery`'))


def check_celery_confd():
    confs = find_files_matching(os.path.join('/', 'etc', 'conf.d'), lambda p: 'celery' in p.lower(), False)
    fpath = ''
    if len(confs) != 1:
        print_em('Found multiple possible celery config files in /etc/conf.d ({})'.format(', '.join(confs)))
        while not os.path.isfile(fpath):
            fpath = os.path.join('/', 'etc', 'conf.d', input('Please specify a proper Celery config file name: '))
    else:
        fpath = list(confs)[0]
    with open(fpath) as fr:
        for line in fr:
            if line.strip().startswith('CELERY_APP'):
                items = re.findall(r'CELERY_APP\s*=\s*["\'](.+)["\']', line.strip())
                if items[0] != 'worker.celery:app':
                    stop_with_error(f'The CELERY_APP in {fpath} should be "worker.celery:app". Please fix the issue.')


def check_celery_systemd_conf():
    print_em('About to check for Celery systemd configuration...')
    confs = find_files_matching(os.path.join('/', 'etc', 'systemd', 'system'), lambda p: 'elery' in p.lower(), False)
    fpath = ''
    if len(confs) != 1:
        print_em('Found multiple possible celery config files for SYSTEMD: {}'.format(', '.join(confs)))
        while not os.path.isfile(fpath):
            fpath = os.path.join('/', 'etc', 'systemd', 'system',
                                 input('Please specify your Celery configuration manually'))
    else:
        fpath = list(confs)[0]
    print()
    print('Please make sure the `-A $CELERY_APP` option is right after the binary (typically `${CELERY_BIN}`')
    print('Possible locations:')
    with open(fpath) as fr:
        for i, line in enumerate(fr):
            if 'Exec' in line and ('-A' in line or '--app' in line):
                print(f'{fpath}, line {i+1}')

    ask_if_continue()


def clear_jinja_cache(conf_xml):
    srch = conf_xml.find('/global/template_engine_cache_path')
    if srch is not None:
        print_em(f'About to remove {os.path.join(srch.text, "*")}')
        try:
            subprocess.check_call('sudo rm {}'.format(os.path.join(srch.text, '*')), shell=True)
            print('   ...done')
        except Exception as ex:
            print_err('   ...failed: {}'.format(ex))
            stop_with_error('   Please fix if necessary.', ask_ignore=True)
    else:
        stop_with_error(
            'Failed to find XML configuration element /global/template_engine_cache_path. Please fix the issue.')


def clear_node_modules(path):
    print_em(f'About to remove node_modules in {path}')
    try:
        subprocess.check_call('rm -rf {}'.format(os.path.join(path, 'node_modules')), shell=True)
        print_em('   ...done')
    except Exception as ex:
        print_err('   ...failed: {}'.format(ex))
        stop_with_error('Cannot continue. Please delete node_modules manually')


def install_node_modules(path):
    print_em(f'About to install node_modules from scratch')
    try:
        subprocess.check_call('npm install', shell=True, cwd=path)
        print('   ...done')
    except Exception as ex:
        print('   ...failed: {}'.format(ex))
        stop_with_error('Cannot continue. Please install node_modules manually (npm install)')


def remove_old_client_side(path):
    print_em(f'About to remove old client-side code')
    try:
        subprocess.check_call('rm -rf {}'.format(os.path.join(path, 'public', 'files', 'dist', '*')), shell=True,
                              cwd=path)
        print_em('   ...done')
    except Exception as ex:
        print_err('   ...failed: {}'.format(ex))
        stop_with_error('Cannot continue. Please remove old client-side code manually and try again')


def build_client_side(path):
    print_em(f'About to compile and build upgraded KonText version...')
    try:
        p = subprocess.Popen('make production', shell=True, cwd=path, stdout=PIPE, stderr=PIPE, stdin=PIPE)
        out, err = p.communicate()
        if p.returncode > 0:
            print_err(err)
            stop_with_error(f'...failed with code {p.returncode}')
        print_em('   ...done')
    except Exception as ex:
        print_em('   ...failed: {}'.format(ex))
        stop_with_error('Cannot continue. Please build project manually and try again.')


def install_py3_deps(path):
    req_path = os.path.join(path, 'requirements.txt')
    print_em(f'About to install Python 3 deps from {req_path}')
    try:
        subprocess.check_call(f'sudo pip3 install -r {req_path}', shell=True)
        subprocess.check_call('sudo pip3 install concurrent_log_handler', shell=True)
        print_em('   ...done')
    except Exception as ex:
        print_err('   ...failed: {}'.format(ex))
        stop_with_error('Cannot continue. Please build project manually and try again.')


def remove_current_node():
    try:
        p = Popen(['node', '-v'], stdin=PIPE, stdout=PIPE, stderr=PIPE)
        out, err = p.communicate()
        v = [int(x) for x in out.decode('utf-8')[1:].strip().split('.')]
        if v[0] < 10:
            print_em('Too old version of Node.JS detected: {}'.format('.'.join(str(x) for x in v)))
            print_em('The current stable LTS version 12.x.x will be installed.')
            print()
            print('Assuming the current Node is installed via package manager.')
            print('Otherwise, please remove your version of Node manually.')
            ask_if_continue()
            subprocess.check_call('sudo apt-get remove nodejs npm', shell=True)

    except Exception as ex:
        print_err(ex)
        stop_with_error(
            'Failed to detect/remove old Node.JS version. Please resolve manually by installing Node v >= 12')


def install_latest_node():
    print_em('About to install latest Node...')
    try:
        subprocess.check_call('curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -', shell=True)
        subprocess.check_call('sudo apt-get install -y nodejs', shell=True)
    except Exception as ex:
        print_err(f'Failed to install node: {ex}')
        print('Please resolve the issue manually.')
        print('Instructions: https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions-enterprise-linux-fedora-and-snap-packages')
        stop_with_error('')

def add_config_entry_for_qs(conf_doc, conf_path):
    """
    query suggest plugin entry
    """
    plugins = conf_doc.find('/plugins')
    if plugins is None:
        stop_with_error('Cannot continue. The config.xml looks invalid (no plugins section)')
    qs_elm = plugins.find('query_suggest')
    if qs_elm is None:
        print_em('About to add new plug-in entry: /plugins/query_suggest')
        new_elm = etree.Element('query_suggest')
        new_elm.tail = '\n        '
        plugins.append(new_elm)
        shutil.copyfile(conf_path, os.path.join(os.path.dirname(conf_path), 'config.xml.bak'))
        with open(conf_path, 'wb') as fw:
            result_xml = etree.tostring(conf_doc, encoding='utf-8', pretty_print=True)
            fw.write(result_xml)


def _download_file(url, target):
    with open(target, 'wb') as fw:
        p = subprocess.Popen(['curl', '-fL', '--insecure', url], stdout=fw, stderr=PIPE)
        out, err = p.communicate()
        if p.returncode > 0:
            print(err)
    return p.returncode


def _unpack_archive(path):
    p = subprocess.Popen(['tar', 'xzf', path, '-C', '/tmp'])
    p.wait()
    return p.returncode


def fix_manatee_location():
    try:
        for item in find_files_matching('/usr/local/lib', lambda p: 'python3' in p and 'manatee' in p and '__pycache__' not in p):
            if '/site-packages/' in item:
                target = os.path.dirname(item.replace('/site-packages/', '/dist-packages/'))
                subprocess.check_call(f'sudo mv -f {item} {target}', shell=True)
    except Exception as ex:
        print(f'Failed to move manatee to dist-packages: {ex}. Please resolve this issue manually')
        stop_with_error('The error can be ignored for now.', ask_ignore=True)


def download_manatee_src(version):
    out_file = '/tmp/manatee-open-{0}.tar.gz'.format(version)
    print('\nLooking for {0} ...'.format(os.path.basename(out_file)))
    if os.path.exists(out_file) and os.path.getsize(out_file) == 0:
        os.unlink(out_file)
    if not os.path.exists(out_file):
        url = 'https://corpora.fi.muni.cz/noske/src/manatee-open/manatee-open-{0}.tar.gz'.format(version)
        ans = _download_file(url, out_file)
        if ans > 0:
            url = 'https://corpora.fi.muni.cz/noske/src/manatee-open/archive/manatee-open-{0}.tar.gz'.format(version)
            ans = _download_file(url, out_file)
        if ans > 0:
            url = 'http://corpora.fi.muni.cz/noske/current/src/manatee-open-{0}.tar.gz'.format(version)
            ans = _download_file(url, out_file)
    else:
        print_em('...found in /tmp')
        ans = 0
    if ans == 0:
        ans = _unpack_archive(out_file)
    if ans == 0:
        return '/tmp/manatee-open-{0}'.format(version)
    else:
        raise Exception('Failed to download and extract manatee. Please do this manually (use /tmp)')
    return ans


def install_manatee(path):
    subprocess.call('make clean', shell=True, cwd=path)
    subprocess.check_call('./configure PYTHON=python3 --with-pcre', shell=True, cwd=path)
    subprocess.check_call('make', shell=True, cwd=path)
    subprocess.check_call('sudo make install', shell=True, cwd=path)
    subprocess.check_call('sudo ldconfig', shell=True, cwd=path)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('The usage is `python3 upgrade.py [path to config.xml]')
        sys.exit(1)
    with open(sys.argv[1]) as fr:
        conf = etree.parse(fr)
    project_path = os.path.realpath(os.path.join(os.path.dirname(sys.argv[1]), '..'))

    print('This script will upgrade your Ubuntu-based installation of KonText v0.13.x to the version 0.15.0.')
    print('The script will need to remove and install some system packages so a sudo prompt may occur for some steps.')
    print('Please note that the script will require your interaction from time to time.')
    print('We recommend stopping both Gunicorn an Celery services before continuing.')
    print()
    cont = None
    while cont not in ('y', 'n'):
        cont = input('Continue? (y/n) ')
    if cont == 'n':
        print_em('Aborted by user')
        sys.exit(1)

    check_version()
    find_old_gunicorn()
    find_old_celery()
    check_new_gunicorn()
    check_new_celery()
    check_celery_confd()
    check_celery_systemd_conf()
    clear_jinja_cache(conf)
    install_py3_deps(project_path)
    add_config_entry_for_qs(conf, sys.argv[1])
    clear_node_modules(project_path)
    remove_current_node()
    install_latest_node()
    install_node_modules(project_path)
    remove_old_client_side(project_path)
    build_client_side(project_path)
    m_src = download_manatee_src(MANATEE_VER)
    install_manatee(m_src)
    fix_manatee_location()
