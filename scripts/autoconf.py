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
This is an auto-configuration module for KonText shell scripts
relying on full KonText's configuration (= processed config.xml).

By importing autoconf module, config.xml is parsed into a 'settings'
module (autoconf.settings).

There is also a logging object available (autoconf.logger) but it
must be configured first via setup_logger() function.
"""

import os
import sys
import logging
import logging.handlers
from collections import OrderedDict

AUTOCONF_PATH = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
APP_PATH = os.path.realpath('%s/..' % AUTOCONF_PATH)
sys.path.insert(0, '%s/lib' % APP_PATH)

DEFAULT_LOG_FILE_SIZE = 1000000
DEFAULT_NUM_LOG_FILES = 5

# this specifies recommended argument values for setting logging level from command line
LOG_LEVELS = OrderedDict(
    [('debug', logging.DEBUG), ('info', logging.INFO), ('warning', logging.WARNING),
     ('error', logging.ERROR), ('critical', logging.CRITICAL)]
)

DEFAULT_LOG_OUT = sys.stderr

import settings
settings.load('%s/config.xml' % APP_PATH)

logger = logging.getLogger('kontext_script')


def setup_logger(log_path=None, logger_name=None, logging_level=None):
    """
    Configures logging (= module's logger variable).

    arguments:
    log_path -- path to a file where log will be written; if omitted then stdout is used
    logger_name -- a name to be used for logger (by default it is 'kontext_script')
    """
    if logger_name is not None:
        logger.name = logger_name

    if log_path is not None:
        handler = logging.handlers.RotatingFileHandler(log_path,
                                                       maxBytes=DEFAULT_LOG_FILE_SIZE,
                                                       backupCount=DEFAULT_NUM_LOG_FILES)
    else:
        handler = logging.StreamHandler(DEFAULT_LOG_OUT)
    handler.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(handler)
    if logging_level is None:
        logging_level = logging.INFO if not settings.is_debug_mode() else logging.DEBUG
    logger.setLevel(logging_level)