# Copyright 2014 Institute of the Czech National Corpus
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
This module is intended to be used by shell scripts which rely on
properly configured KonText. It imports and loads KonText settings
and provides a function to setup a simple logging.

KonText settings are available as a module property 'settings'.
"""

import os
import sys
import logging

AUTOCONF_PATH = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
APP_PATH = os.path.realpath('%s/..' % AUTOCONF_PATH)
sys.path.insert(0, '%s/lib' % APP_PATH)

DEFAULT_LOG_FILE_SIZE = 1000000
DEFAULT_NUM_LOG_FILES = 5

import settings
settings.load('%s/config.xml' % APP_PATH)

logger = logging.getLogger('conc_archive')


def setup_logger(log_path=None):
    """
    Configures logging.

    arguments:
    log_path -- path to a file where log will be written; if omitted then stdout is used
    """
    if log_path is not None:
        handler = logging.handlers.RotatingFileHandler(log_path,
                                                       maxBytes=DEFAULT_LOG_FILE_SIZE,
                                                       backupCount=DEFAULT_NUM_LOG_FILES)
    else:
        handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)