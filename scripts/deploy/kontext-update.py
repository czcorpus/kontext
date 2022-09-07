#!/usr/bin/env python3
# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

#   http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Required config:
{
    'appDir': '/path/to/the/web/application',
    'workingDir': '/path/to/working/dir/for/git/repo',
    'archiveDir': '/path/to/store/all/the/installed/versions',
    'appConfigDir': '/path/to/kontext/conf/dir',
    'gitUrl': 'git_repository_URL',
    'gitBranch': 'used_git_branch',
    'gitRemote': 'git_remote_identifier'
}
"""

import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from functools import wraps
from io import IOBase
from textwrap import dedent

from lxml import etree

GIT_URL_TEST_TIMEOUT = 5
DEFAULT_DATETIME_FORMAT = '%Y-%m-%d-%H-%M-%S'
FILES = ('templates', 'lib', 'locale', 'public', 'scripts', 'package.json', 'worker')
DEPLOY_MESSAGE_FILE = '.deploy_info'
INVALIDATION_FILE = '.invalid'
APP_DIR = 'appDir'
WORKING_DIR = 'workingDir'
ARCHIVE_DIR = 'archiveDir'
APP_CONFIG_DIR = 'appConfigDir'
GIT_URL = 'gitUrl'
GIT_BRANCH = 'gitBranch'
GIT_REMOTE = 'gitRemote'
KONTEXT_CONF_ALIASES = 'kontextConfAliases'
KONTEXT_CONF_CUSTOM = 'kontextConfCustom'
TARGET_SYMLINKS = 'targetSymlinks'
GLOBAL_CONF_PATH = os.environ.get('GLOBAL_CONF_PATH', '/usr/local/etc/kontext-deploy.json')
KONTEXT_CONF_FILES = ('config.xml', 'main-menu.json', 'tagsets.xml')


class InvalidatedArchiveException(Exception):
    pass


class InvalidConfigException(Exception):
    pass


class PackageInfoException(Exception):
    pass


class VersionInfoException(Exception):
    pass


class JSAppVersionInfo(object):
    """
    A helper class to work with semantic
    version identifiers. Please note that
    this does not support full "semver"
    specification.
    """

    def __init__(self, name, ver):
        self._name = name
        self._prefix = ''
        self._pre_release_id = None
        if type(ver) is tuple:
            self._ver = ver
        elif type(ver) is str:
            self._parse_ver(ver)
        else:
            raise VersionInfoException('Failed to use version info of type {0}'.format(ver))

    def _parse_ver(self, s):
        items = s.split('.', 2)
        if not items[0][0].isdigit():
            self._prefix = items[0][0]
            major = int(items[0][1:])
        else:
            major = int(items[0])
        minor = int(items[1])

        tmp = items[2].split('-')
        patch = int(tmp[0])
        if len(tmp) > 1:
            self._pre_release_id = tmp[1]
        self._ver = (major, minor, patch)

    def __repr__(self):
        return '{5} {0}{1}.{2}.{3}{4}'.format(
            self._prefix, self._ver[0], self._ver[1], self._ver[2],
            '-{0}'.format(self._pre_release_id) if self._pre_release_id else '', self._name)

    def __getitem__(self, item):
        return self._ver[item]

    @property
    def name(self):
        return self._name

    @property
    def is_prerelease(self):
        return self._pre_release_id is not None

    def cmp(self, other_ver):
        if other_ver is None:
            return 3
        for i in range(3):
            if self[i] > other_ver[i]:
                return 3 - i
            elif self[i] < other_ver[i]:
                return i - 3
        if self.is_prerelease and not other_ver.is_prerelease:
            return -1
        elif not self.is_prerelease and other_ver.is_prerelease:
            return 1
        return 0


class NPMPackageInfo(object):
    """
    A helper class to analyze NPM dependencies
    in package.json. Please note that this does
    support only features needed for this deploy
    script (i.e. it does not conform full package.json
    specification).
    """

    def __init__(self, data):
        if type(data) is dict:
            self._data = data
        elif type(data) is str:
            self._data = json.loads(data)
        elif isinstance(data, IOBase):
            self._data = json.load(data)
        else:
            raise PackageInfoException('Unknown data source: {0}'.format(type(data)))

    @property
    def dependencies(self):
        return (JSAppVersionInfo(x[0], x[1]) for x in self._data['dependencies'].items())

    @property
    def dev_dependencies(self):
        return (JSAppVersionInfo(x[0], x[1]) for x in self._data['devDependencies'].items())

    def get_dependency(self, name):
        for d in self.dependencies:
            if d.name == name:
                return d
        return None

    def get_dev_dependency(self, name):
        for d in self.dev_dependencies:
            if d.name == name:
                return d
        return None


def get_required_npm_update(old_ver_path, new_ver_path):
    if not os.path.exists(old_ver_path):
        return ('npm', 'install')
    with open(old_ver_path, 'rb') as fr1, open(new_ver_path, 'rb') as fr2:
        p1 = NPMPackageInfo(fr1)
        p2 = NPMPackageInfo(fr2)
        deps_cmd = None
        for d1 in p1.dependencies:
            d2 = p2.get_dependency(d1.name)
            if d1.cmp(d2) != 0:
                deps_cmd = ('npm', 'update')
        if deps_cmd is None:
            for d2 in p2.dependencies:
                d1 = p1.get_dependency(d2.name)
                if d2.cmp(d1) != 0:
                    deps_cmd = ('npm', 'update')
        # dev dependencies
        for d1 in p1.dev_dependencies:
            d2 = p2.get_dev_dependency(d1.name)
            if d1.cmp(d2) != 0:
                deps_cmd = ('npm', 'update', '--dev')
        if deps_cmd is None or deps_cmd[-1] != '--dev':
            for d2 in p2.dev_dependencies:
                d1 = p1.get_dev_dependency(d2.name)
                if d2.cmp(d1) != 0:
                    deps_cmd = ('npm', 'update', '--dev')
        return deps_cmd


class Configuration(object):
    """
    Args:
        data (dict): deserialized JSON configuration data
    """

    @staticmethod
    def _is_forbidden_dir(path):
        tmp = os.path.realpath(path).split('/')
        return len(tmp) == 2 and tmp[0] == ''

    @staticmethod
    def _test_git_repo_url(url):
        try:
            ans = urllib.request.urlopen(url, timeout=GIT_URL_TEST_TIMEOUT)
            if ans.code != 200:
                raise ConfigError(f'Unable to validate git repo url {url}')
        except urllib.error.URLError:
            raise ConfigError(f'Unable to validate git repo url {url}')

    @staticmethod
    def _is_abs_path(s):
        # Windows detection is just for an internal testing
        # (the script is still only for Linux, BSD and the like)
        if platform.system() != 'Windows':
            return s.startswith('/')
        else:
            return re.match(r'[a-zA-Z]:\\', s) is not None

    def __init__(self, data, skip_remote_checks=False):
        keys = [APP_CONFIG_DIR, WORKING_DIR, ARCHIVE_DIR, APP_DIR]
        for item in keys:
            p = os.path.realpath(data[item])
            if self._is_forbidden_dir(p):
                raise ConfigError(f'{item} cannot be set to forbidden value {p}')
            elif not self._is_abs_path(p):
                raise ConfigError(f'{item} path must be absolute')
            elif not os.path.isdir(p):
                raise ConfigError(f'Path {p} ({item}) does not exist.')
        if not skip_remote_checks:
            self._test_git_repo_url(data[GIT_URL])
        self._kc_aliases = data.get(KONTEXT_CONF_ALIASES, {})
        self._kc_custom = data.get(KONTEXT_CONF_CUSTOM, [])
        self._target_symlinks = data.get(TARGET_SYMLINKS, {})
        self._data = data

    @property
    def kontext_conf_files(self):
        conf_files = KONTEXT_CONF_FILES + tuple(self._kc_custom)
        return [self._kc_aliases[k] if k in self._kc_aliases else k for k in conf_files]

    @property
    def app_dir(self):
        return os.path.realpath(self._data[APP_DIR])

    @property
    def working_dir(self):
        return os.path.realpath(self._data[WORKING_DIR])

    @property
    def archive_dir(self):
        return os.path.realpath(self._data[ARCHIVE_DIR])

    @property
    def app_config_dir(self):
        return os.path.realpath(self._data[APP_CONFIG_DIR])

    @property
    def git_url(self):
        return self._data[GIT_URL]

    @property
    def git_branch(self):
        return self._data[GIT_BRANCH]

    @property
    def git_remote(self):
        return self._data[GIT_REMOTE]

    @property
    def target_symlinks(self):
        return self._target_symlinks


class ConfigError(Exception):
    pass


class ShellCommandError(Exception):
    pass


class InputError(Exception):
    pass


def description(text):
    def decor(fn):
        @wraps(fn)
        def wrapper(*args, **kw):
            try:
                has_err = False
                print('\n')
                print(70 * '-')
                print('| {}{}|'.format(text, max(0, 67 - len(text)) * ' '))
                print(70 * '-')
                return fn(*args, **kw)
            except Exception as ex:
                has_err = True
                print(u'[ ERROR ]: {0}'.format(ex))
                raise ex
            finally:
                if not has_err:
                    print('[ OK ]')
        return wrapper
    return decor


class Deployer(object):
    """
    Args:
        conf (Configuration): deployment configuration
    """

    def __init__(self, conf: Configuration):
        self._conf = conf

    def shell_cmd(self, *args, **kw):
        """
        Args:
            args(list of str): command line arguments
        Returns:
            subprocess.Popen
        """
        p = subprocess.Popen(args, cwd=self._conf.working_dir, env=os.environ.copy(), **kw)
        if p.wait() != 0:
            raise ShellCommandError('Failed to process action: {}'.format(' '.join(args)))
        return p

    @description('Creating archive directory for the new version')
    def create_archive(self, date):
        """

        Args:
            date(datetime):

        Returns:
            str: path to the current archive item
        """
        arch_path = os.path.join(self._conf.archive_dir, date.strftime(DEFAULT_DATETIME_FORMAT))
        if not os.path.isdir(arch_path):
            os.makedirs(arch_path)
        os.makedirs(os.path.join(arch_path, 'conf'))
        return arch_path

    @description('Copying built project to the archive')
    def copy_app_to_archive(self, arch_path):
        """
        Args:
            arch_path (str): path to archive subdirectory

        Returns:
            None

        Raises:
            ShellCommandError
        """
        for item in FILES:
            src_path = os.path.join(self._conf.working_dir, item)
            self.shell_cmd('cp', '-r', '-p', src_path, arch_path)

    @description('Updating working config.xml')
    def update_working_conf(self, update_confxml):
        """
        Raises:
            ShellCommandError
        """
        source_conf = os.path.join(self._conf.app_config_dir, 'config.xml')
        if update_confxml:
            try:
                shutil.copy(source_conf, os.path.join(
                    os.path.dirname(source_conf), 'config.xml.bak'))
            except Exception as ex:
                print('\U0001F44E Failed to create a backup copy of config.xml: {ex}')
                print('... ignoring and continuing')
        doc = etree.parse(source_conf)
        srch = doc.find('global/deployment_id')
        srch.text = str(uuid.uuid1())
        result_xml = etree.tostring(doc, encoding='utf-8', pretty_print=True)
        with open(source_conf, 'wb') as fw:
            fw.write(result_xml)

        # config.xml is required in building process
        working_conf = os.path.join(self._conf.working_dir, 'conf', 'config.xml')
        shutil.copy(source_conf, working_conf)

    @description('Copying configuration to the archive')
    def copy_configuration(self, arch_path):
        """
        Args:
            arch_path (str): path to archive subdirectory
        Raises:
            ShellCommandError
        """
        for item in self._conf.kontext_conf_files:
            src_path = os.path.join(self._conf.app_config_dir, item)
            dst_path = os.path.join(arch_path, 'conf', item)
            self.shell_cmd('cp', '-p', src_path, dst_path)

    @description('Updating data from repository')
    def update_from_repository(self):
        working_dir = self._conf.working_dir
        if not os.path.isdir(working_dir):
            os.makedirs(working_dir)

        if not os.path.isdir(os.path.join(working_dir, '.git')):
            self.shell_cmd('git', 'clone', self._conf.git_url, '.')
        else:
            self.shell_cmd('git', 'reset', '--hard', 'HEAD')
            self.shell_cmd('git', 'checkout', self._conf.git_branch)
            self.shell_cmd('git', 'fetch', self._conf.git_remote)
            self.shell_cmd('git', 'merge', '-Xtheirs',
                           f'{self._conf.git_remote}/{self._conf.git_branch}')

    @description('Writing information about used GIT commit')
    def record_deployment_info(self, arch_path, message):
        """
        Args:
            arch_path (str): path to an archive
        """
        p = self.shell_cmd('git', 'log', '-1', '--oneline', stdout=subprocess.PIPE)
        commit_info = p.stdout.read().strip()
        with open(os.path.join(arch_path, DEPLOY_MESSAGE_FILE), 'w') as fw:
            if message:
                fw.write(message + '\n\n')
            fw.write(commit_info.decode('utf-8') + '\n')

    @description('Building project using Webpack')
    def build_project(self):
        self.shell_cmd('npm', 'start', 'build:production')

    @description('Removing current deployment')
    def remove_current_deployment(self):
        self.shell_cmd('rm -rf {}'.format(os.path.join(self._conf.app_dir, '*')), shell=True)
        self.shell_cmd('rm -rf {}'.format(os.path.join(self._conf.app_dir, '.[a-z]*')), shell=True)

    @description('Deploying new version')
    def deploy_new_version(self, arch_path):
        """
        Args:
            arch_path (str): path to an archive
        """
        for item in FILES + (DEPLOY_MESSAGE_FILE, 'conf'):
            self.shell_cmd('cp', '-r', '-p', os.path.join(arch_path, item), self._conf.app_dir)

    @description('Validating actual config.xml')
    def validate_configuration(self):
        validator_script = os.path.join(self._conf.working_dir, 'scripts', 'validate_xml.py')
        conf_path = os.path.join(self._conf.app_config_dir, 'config.xml')
        p = self.shell_cmd(validator_script, conf_path)
        if p.returncode > 0:
            raise InvalidConfigException('Invalid app configuration')

    @description('Comparing current and new package.json for changed dependencies')
    def update_npm_deps(self):
        """
        """
        if not os.path.isdir(os.path.join(self._conf.working_dir, 'node_modules')):
            self.shell_cmd('npm', 'install')
        else:
            curr_pkg_path = os.path.join(self._conf.app_dir, 'package.json')
            new_pkg_path = os.path.join(self._conf.working_dir, 'package.json')
            upd = get_required_npm_update(curr_pkg_path, new_pkg_path)
            if upd is not None:
                self.shell_cmd(*upd)

    @description('Creating custom symbolic links')
    def create_custom_symlinks(self):
        for source, target in self._conf.target_symlinks.items():
            os.symlink(source, target)

    def run_all(self, date, message, update_confxml: bool):
        """
        Args:
            date (datetime): a date used to create a new archive
        """
        self.update_from_repository()
        self.update_working_conf(update_confxml)
        self.update_npm_deps()
        self.validate_configuration()
        self.build_project()
        arch_path = self.create_archive(date)
        self.copy_configuration(arch_path)
        self.record_deployment_info(arch_path, message)
        self.copy_app_to_archive(arch_path)
        self.remove_current_deployment()
        self.deploy_new_version(arch_path)
        self.create_custom_symlinks()

    def from_archive(self, archive_id):
        """
        Args:
            archive_id (str): an ID of an archived item to be deployed
        """
        arch_path = os.path.join(self._conf.archive_dir, archive_id)
        self.remove_current_deployment()
        self.deploy_new_version(arch_path)
        with open(os.path.join(arch_path, DEPLOY_MESSAGE_FILE), 'rb') as fr:
            print('\nDeployment information:\n{}'.format(fr.read()))


def list_archive(conf):
    """
    Args:
        conf (Configuration): script conf
    """
    print('archived deployments:')
    print(conf.archive_dir)
    for item in os.listdir(conf.archive_dir):
        print('\t{0}'.format(item))


def invalidate_archive(conf, archive_id, message):
    if not message:
        raise ValueError('A message must be specified (-m)')
    archive_id = find_matching_archive(conf, archive_id)
    arch_path = os.path.join(conf.archive_dir, archive_id)
    with open(os.path.join(arch_path, INVALIDATION_FILE), 'w') as fw:
        fw.write(message + '\n')


def _test_archive_validity(conf, archive_id):
    flag_file_path = os.path.join(conf.archive_dir, archive_id, INVALIDATION_FILE)
    if os.path.isfile(flag_file_path):
        with open(flag_file_path, 'r') as fr:
            raise InvalidatedArchiveException(
                'Archive marked as invalid. Reason: {}'.format(fr.read()))


def find_matching_archive(conf, arch_id):
    """
    Args:
        conf (Configuration): script configuration
        arch_id: an archive ID (even partial prefix)

    Returns:
        str: an ID of matching archive or None

    Raises:
        InputError: in case of ambiguous search (one exact match is accepted only)

    """
    avail_archives = os.listdir(conf.archive_dir)
    ans = None
    for item in avail_archives:
        if item.startswith(arch_id):
            if ans is None:
                ans = item
            else:
                raise InputError(
                    'Ambiguous archive ID search. Please specify a more concrete value.')
    return ans


if __name__ == '__main__':
    if os.getuid() == 0:
        print('Please do not run the script as root')
        sys.exit(2)
    argp = argparse.ArgumentParser(
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
        description=dedent('''\
            A simple KonText deployment script.

            Note: only core configuration files are installed by default:

            [ {} ]

            To add more files, please configure "kontextConfCustom" item
            in your deployment config file.'''.format(', '.join(KONTEXT_CONF_FILES))))
    argp.add_argument('action', metavar='ACTION',
                      help='Action to perform (deploy, list, invalidate, show_conf)')
    argp.add_argument('archive_id', metavar='ARCHIVE_ID', nargs='?',
                      default='new', help='Archive identifier (default is *new*)')
    argp.add_argument('-c', '--config-path', type=str,
                      help='Path to a JSON config file (default is *deploy.json* in script\'s directory)')
    argp.add_argument('-b', '--no-configxml-backup', default=False, action='store_true')
    argp.add_argument('-m', '--message', type=str,
                      help='A custom message stored in generated archive (.deployinfo)')
    argp.add_argument('-h', '--help', default=False, action='store_true', help='show help and exit')
    args = argp.parse_args()
    if args.help:
        argp.print_help()
        sys.exit(1)
    try:
        if args.config_path is None:
            if os.path.isfile(GLOBAL_CONF_PATH):
                conf_path = GLOBAL_CONF_PATH
            else:
                conf_path = os.path.join(os.path.dirname(__file__), './deploy.json')
        else:
            conf_path = args.config_path
        conf_path = os.path.realpath(conf_path)
        print(f'\n\U0001F440 Using deployment configuration {conf_path}')

        if args.action == 'show_conf':
            with open(conf_path) as cf:
                conf = json.load(cf)
                print('\nKonText deployment configuration:\n')
                print(json.dumps(conf, indent=2))
                print('\n')
            sys.exit(1)

        with open(conf_path, 'rb') as fr:
            conf = Configuration(json.load(fr))

        if args.action == 'deploy':
            d = Deployer(conf)
            if args.archive_id == 'new':
                print(f'installing latest version from {conf.git_branch}')
                d.run_all(datetime.now(), args.message, args.no_configxml_backup)
            else:
                m = find_matching_archive(conf, args.archive_id)
                _test_archive_validity(conf, m)
                if m is not None:
                    print(f'installing from archive: {m}')
                    d.from_archive(m)
                else:
                    raise InputError(f'No matching archive for {args.archive_id}')
        elif args.action == 'list':
            list_archive(conf)
        elif args.action == 'invalidate':
            invalidate_archive(conf, args.archive_id, args.message)
        else:
            raise Exception(f'Unknown action "{args.action}" (use one of: deploy, list)')
    except ConfigError as e:
        print(f'\n\U0001F4A5 Configuration error: {e}\n')
        sys.exit(2)
    except Exception as e:
        print('\n\U0001F4A5 Failed to deploy latest version.\n')
        print('Reason: {}'.format(e))
        sys.exit(2)
    print('\n')
