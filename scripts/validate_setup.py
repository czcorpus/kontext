# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>

import os
import sys
from pwd import getpwuid
import argparse
from functools import wraps
from types import GeneratorType
from lxml import etree
import json
import platform
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../lib'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../scripts'))
import settings
from validate_xml import find_plugins, validate_main_config

TESTS = []
SCORE = []
APP_PATH = os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
MIN_MANATEE_VERSION = '2.167.8'


class Bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

    @staticmethod
    def colorize(s, color):
        return color + s + '\033[0m'


class UnsupportedValue(Exception):

    def __init__(self, path, value):
        self._path = path
        self._value = value

    def __str__(self):
        return 'Value "{0}" not supported in "{1}"'.format(self._value, self._path)


class PathNotExist(Exception):

    def __init__(self, path):
        self._path = path

    def __str__(self):
        return 'Path {path} does not exist or is wrong type (file/directory/link)'.format(path=self._path)


class PathPermissionsInvalid(Exception):

    def __init__(self, path, actual_perm, req_perm):
        self._path = path
        self._actual_perm = actual_perm
        self._req_perm = req_perm

    def __str__(self):
        return 'Permissions to {file} failed. Expected: {expect}, actual: {actual}'.format(file=self._path,
                                                                                           expect=self._actual_perm,
                                                                                           actual=self._actual_perm)


class OwnershipError(Exception):

    def __init__(self, path, owner, group, actual_owner, actual_group):
        self._path = path
        self._owner = owner
        self._group = group
        self._actual_owner = actual_owner
        self._actual_group = actual_group

    def __str__(self):
        return 'Ownership error. Expected {0}:{1}, actual: {2}:{3}'.format(self._owner, self._group,
                                                                           self._actual_owner, self._actual_group)


class GeneralConfigurationError(Exception):
    pass


class FileInfo(object):

    def __init__(self, test_setuid, webserver_user, webserver_group, config_path):
        self._test_setuid = test_setuid
        self._webserver_user = webserver_user
        self._webserver_group = webserver_group
        self._config_path = config_path

    @property
    def webserver_user(self):
        return self._webserver_user

    @property
    def webserver_group(self):
        return self._webserver_group

    @property
    def config_path(self):
        return self._config_path

    @staticmethod
    def owner(path):
        return getpwuid(os.stat(path).st_uid).pw_name

    @staticmethod
    def group(path):
        try:
            return getpwuid(os.stat(path).st_gid).pw_name
        except KeyError:
            return '??'

    def test_owner_and_group(self, path, owner=None, group=None):
        try:
            ans = True
            if owner:
                ans = ans and self.owner(path) == owner
            if group:
                ans = ans and group == self.group(path)
            if ans:
                return True, None
            else:
                return False, OwnershipError(path=path, owner=owner if owner else '*', group=group if group else '*',
                                             actual_owner=self.owner(path), actual_group=self.group(path))
        except Exception as e:
            return False, e

    def file_exists(self, path):
        if os.path.isfile(path):
            return True, None
        else:
            return False, PathNotExist(path)

    def dir_exists(self, path):
        if os.path.isdir(path):
            return True, None
        else:
            return False, PathNotExist(path)

    def permissions(self, path, match, ignore_suid=False):
        if not self._test_setuid or ignore_suid:
            if len(match) == 4:
                match = match[1:]
            offs = -3
        else:
            if len(match) == 3:
                match = '0' + match
            offs = -4
        try:
            actual_perm = oct(os.stat(path).st_mode)[offs:]
            if actual_perm == match:
                return True, None
            else:
                return False, PathPermissionsInvalid(path=path, actual_perm=actual_perm, req_perm=match)
        except Exception as e:
            return False, e


def _test_plugin_module(name):
    if not name:
        return False, UnsupportedValue('Empty module name', value=name)
    if (os.path.isfile(os.path.join(APP_PATH, 'lib/plugins', '{0}.py'.format(name))) or
            os.path.isdir(os.path.join(APP_PATH, 'lib/plugins', name)) and
            os.path.isfile(os.path.join(APP_PATH, 'lib/plugins', name, '__init__.py'))):
        return True, None
    else:
        return False, PathNotExist('[lib/plugins/{0}.py | lib/plugins/{0}/__init__.py]'.format(name))


def _test_plugin_common(ident, conf):
    if not conf:
        yield False, GeneralConfigurationError('Missing [{0}] plug-in'.format(ident))
        yield False, GeneralConfigurationError('Missing [{0}] plug-in module'.format(ident))
    else:
        yield True, None
        yield _test_plugin_module(conf.get('module'))


def test(*description):
    """
    A test wrapper function providing execution and output
    printing.
    """
    def decorator(fn):
        @wraps(wrapped=fn)
        def out_fn(*args, **kwargs):
            ans = fn(*args, **kwargs)
            if not isinstance(ans, GeneratorType):
                ans = [ans]

            messages = []
            i = 0
            for subtest in ans:
                status, err = subtest
                if status is False:
                    if err:
                        status_desc = str(err)
                    else:
                        status_desc = 'Test failed'
                    status_desc = '[ ' + Bcolors.colorize('ERROR',
                                                          Bcolors.FAIL) + ' ]\n    %s' % (status_desc, )
                    SCORE.append(False)
                elif status is None:
                    status_desc = '[ ' + Bcolors.colorize('SKIPPED', Bcolors.WARNING) + ' ]'
                else:
                    status_desc = '[ ' + Bcolors.colorize('OK', Bcolors.OKGREEN) + ' ]'
                    SCORE.append(True)
                desc = description[i] if i < len(description) else '...'
                messages.append(Bcolors.colorize('#', Bcolors.OKBLUE) +
                                ' ' + desc + ' ' + status_desc)
                i += 1
            return messages
        TESTS.append(out_fn)
        return out_fn
    return decorator

# -------------------------------------------------------------------------


@test('config.xml conforms config.rng')
def test_0_validate_xml(finfo):
    schema = etree.parse(os.path.join(APP_PATH, 'conf/config.rng'))
    conf = etree.parse(finfo.config_path)
    relax = etree.RelaxNG(schema)
    try:
        relax.assertValid(conf)
        yield True, None
    except etree.DocumentInvalid as e:
        yield False, e


@test('plug-ins XML configurations conform respective schemata')
def test_0_validate_plugin_xml(finfo):
    conf = etree.parse(finfo.config_path)
    plugins = find_plugins(conf)
    err2 = None
    for elm, schema_path in plugins:
        s, err2 = validate_main_config(elm, schema_path)
        if err2:
            yield False, s
            break
    if not err2:
        yield True, None


@test('<upload_cache_dir> is present',
      '...and has right permissions',
      '...and owner/group')
def test_1(finfo):
    upload_cache_dir = settings.get('global', 'upload_cache_dir')
    yield finfo.dir_exists(upload_cache_dir)
    yield finfo.permissions(upload_cache_dir, match='775')
    yield finfo.test_owner_and_group(upload_cache_dir, owner=finfo.webserver_user)


@test('Manatee path is correct (or empty and Manatee module is importable)',
      '... and Manatee has proper version')
def test_4(finfo):
    mp = settings.get('global', 'manatee_path')
    if mp:
        yield finfo.file_exists(os.path.join(mp, 'manatee.py'))
    else:
        try:
            import corplib   # corplib imports manatee
            yield True, None
            ver_ok = corplib.manatee_min_version(MIN_MANATEE_VERSION)
            yield ver_ok, None if ver_ok else Exception(f'The version must be at least {MIN_MANATEE_VERSION}')

        except Exception as e:
            yield False, e


@test('gettext translations are set-up and present')
def test_5(finfo):
    translations = settings.get_list('global', 'translations')
    for tr in translations:
        if tr != 'en-US':
            yield finfo.file_exists(os.path.join(APP_PATH, f'locale/{tr.replace("-", "_")}/LC_MESSAGES/kontext.mo'))


@test('<calc_backend> is set-up properly')
def test_6(finfo):
    bck_type = settings.get('calc_backend', 'type')
    conf = settings.get('calc_backend', 'conf')
    if conf:  # otherwise user uses direct configuration which is taken care of by RelaxNG validation
        if bck_type in ('celery', 'konserver', 'rq'):
            return finfo.file_exists(os.path.join(conf))
        else:
            return False, UnsupportedValue('/global/calc_backend', bck_type)
    return True, None


@test('<periodic_tasks> is set-up properly')
def test_6(finfo):
    bck_type = settings.get('periodic_tasks', 'type')
    conf = settings.get('periodic_tasks', 'conf')
    if bck_type in ('celery', 'konserver', 'rq'):
        return finfo.file_exists(os.path.join(conf))
    elif bck_type:
        return False, UnsupportedValue('/global/periodic_tasks', bck_type)
    return True, None


# TODO - test writeability
@test('logging path exists',
      'logging path has proper permissions')
def test_7(finfo):
    path = settings.get('logging', 'path')
    yield finfo.dir_exists(os.path.dirname(path))
    yield finfo.test_owner_and_group(os.path.dirname(path), owner=finfo.webserver_user, group=None)


@test('Manatee registry directory exists')
def test_8(finfo):
    return finfo.dir_exists(settings.get('corpora', 'manatee_registry'))


@test('user sub-corpora directory exists',
      '... and the directory has a proper owner and group',
      '... and the directory has a proper permissions')
def test_9(finfo):
    path = settings.get('corpora', 'users_subcpath')
    yield finfo.dir_exists(path)
    yield finfo.test_owner_and_group(path, owner=finfo.webserver_user, group=finfo.webserver_group)
    yield finfo.permissions(path, match='2775')


@test('<freqs_precalc_dir> exists',
      '... and has proper ownership')
def test_11(finfo):
    path = settings.get('corpora', 'freqs_precalc_dir')
    yield finfo.dir_exists(path)
    yield finfo.test_owner_and_group(path, owner=finfo.webserver_user, group=finfo.webserver_group)


@test('<freqs_cache_dir> exists',
      '... and has proper ownership')
def test_12(finfo):
    path = settings.get('corpora', 'freqs_cache_dir')
    yield finfo.dir_exists(path)
    yield finfo.test_owner_and_group(path, owner=finfo.webserver_user, group=finfo.webserver_group)


@test('<colls_cache_dir> exists',
      '... ans has proper ownership')
def test_13(finfo):
    path = settings.get('corpora', 'colls_cache_dir')
    yield finfo.dir_exists(path)
    yield finfo.test_owner_and_group(path, owner=finfo.webserver_user, group=finfo.webserver_group)

# --- plug-ins ------------------------------------


@test('[db] plug-in is present',
      '... and a respective module is set and exists')
def test_14(finfo):
    conf = settings.get('plugins', 'db')
    return _test_plugin_common('db', conf)


@test('[redis] module (if applicable)',
      '... and has working server connection')
def test_14_b(finfo):
    conf = settings.get('plugins', 'db')
    if conf.get('module') == 'redis_db':
        try:
            import redis
            yield True, None
        except ImportError as e:
            yield False, e
        try:
            redis.StrictRedis(host=conf['default:host'], port=int(conf['default:port']),
                              db=int(conf['default:id']))
            yield True, None
        except Exception as e:
            yield False, e
    else:
        yield None, None


@test('[auth] plug-in is present',
      '... and a respective module is set and exists')
def test_15(finfo):
    conf = settings.get('plugins', 'auth')
    return _test_plugin_common('auth', conf)


@test('[sessions] is present',
      '... and a respective module is set and exists')
def test_16(finfo):
    conf = settings.get('plugins', 'sessions')
    return _test_plugin_common('sessions', conf)


@test('[settings_storage] is present',
      '... and a respective module is set and exists')
def test_17(finfo):
    conf = settings.get('plugins', 'settings_storage')
    return _test_plugin_common('settings_storage', conf)


@test('[conc_persistence] is present',
      '... and a respective module is set and exists')
def test_18(finfo):
    conf = settings.get('plugins', 'conc_persistence')
    return _test_plugin_common('conc_persistence', conf)


@test('[conc_cache] is present',
      '... and a respective module is set and exists')
def test_19(finfo):
    conf = settings.get('plugins', 'conc_cache')
    return _test_plugin_common('conc_cache', conf)


@test('[user_items] is present',
      '... and a respective module is set and exists')
def test_21(finfo):
    conf = settings.get('plugins', 'user_items')
    return _test_plugin_common('user_items', conf)


@test('[menu_items] is present',
      '... and a respective module is set and exists')
def test_22(finfo):
    conf = settings.get('plugins', 'menu_items')
    return _test_plugin_common('menu_items', conf)


@test('[menu_items] data JSON file exists (if applicable)',
      '... and is loadable')
def test_22_b(finfo):
    conf = settings.get('plugins', 'menu_items')
    if conf['module'] == 'default_menu_items':
        path = conf['default:data_path']
        yield finfo.file_exists(path)
        try:
            with open(path, 'rb') as f:
                json.load(f)
                yield True, None
        except Exception as e:
            yield False, e
    else:
        yield None, None


if __name__ == '__main__':
    platf = platform.platform()
    if "centos" in platf:
        def_usr = "apache"
    else:
        def_usr = "www-data"

    parser = argparse.ArgumentParser(description='KonText set-up validation')
    parser.add_argument('config_file', metavar='CONF_FILE', type=str,
                        help='a path to config.xml')
    parser.add_argument('-s', '--test-setuid', action='store_true', default=False,
                        help='test setuid for files/directories')
    parser.add_argument('-u', '--webserver-user', type=str, default=def_usr,
                        help='A system user a webserver runs under.')
    parser.add_argument('-g', '--webserver-group', type=str, default=def_usr,
                        help='A system group a webserver runs under.')
    args = parser.parse_args()
    settings.load(args.config_file)
    finfo = FileInfo(args.test_setuid, webserver_user=args.webserver_user, webserver_group=args.webserver_group,
                     config_path=args.config_file)
    print('--------------------------------------')
    for test in TESTS:
        print('')
        print(('\n'.join(test(finfo))))
    print('\n--------------------------------------')
    total_errs = len([x for x in SCORE if x is False])
    print('Total number of tests: {0}'.format(len(SCORE)))
    status = Bcolors.colorize(
        'ERROR', Bcolors.FAIL) if total_errs > 0 else Bcolors.colorize('OK', Bcolors.OKGREEN)
    print('Summary: {}'.format(status))
    if total_errs > 0:
        print('{} error(s)'.format(total_errs))
    print('')
