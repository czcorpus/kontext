# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
This script provides a functionality to add/replace corpus within rdbms_corparch
plug-in.

To create a new database, use scripts/install.py. This script is also able to parse
your existing default_corparch XML corplist in case you want to migrate from default_corparch.

To mass import registry files, you can use scripts/regadd.py.

To install individual corpora, create a custom directory and put proper 'corpus installation'
JSON config files there (scripts/install.py can do this for your existing corpora in case you
use default_corparch).

The format is as follows:

{
    "ident": "syn2010",
    "web": "http://www.korpus.cz/syn2010.php",
    "use_safe_font": false,
    "reference": {
        "default": "Main article introducing the corpus",
        "articles": [
            "Some related paper",
        ],
        "other_bibliography": null
    },
    "collator_locale": "en_US",
    "kwic_connect": [],
    "speaker_id_attr": null,
    "group_name": "syn2010",
    "speech_segment": null,
    "version": 1,
    "speech_overlap_val": null,
    "tagset": "pp_tagset",
    "speech_overlap_attr": null,
    "token_connect": [],
    "sentence_struct": "s",
    "metadata": {
        "id_attr": "opus.id",
        "featured": 1,
        "database": "/var/local/corpora/metadata/syn2010.db",
        "keywords": [
            "SYN",
            "written",
            "synchronic"
        ],
        "label_attr": "opus.nazev",
        "desc": null,
        "default_virt_keyboard": "Czech"
    }
}

The installation directory may contain a special json file ".conf.json" with some configuration
info applicable for any corpus:

{
  "registry_dir_path": "/var/local/corpora/registry",
  "kontext_conf_path": "/var/www/korpus/kontext/conf/config.xml"
}

But these values can be also set directly as command line parameters (they overwrite the values from the file).
"""

import os
import argparse
import sys
import json
import logging
from lxml import etree
import manatee

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
import settings
from plugins.rdbms_corparch.backend.sqlite_w import WritableBackend
from plugins.rdbms_corparch.backend.input import InstallJson
from plugins.rdbms_corparch.registry.parser import Tokenizer, Parser, infer_encoding


logging.basicConfig(format='%(asctime)s %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S',
                    level=logging.INFO)


class Config(object):

    def __init__(self, registry_dir_path=None, kontext_conf_path=None):
        self.registry_dir_path = registry_dir_path
        self.kontext_conf_path = kontext_conf_path

    def update_missing(self, data):
        for k, v in list(self.__dict__.items()):
            if k in data and v is None:
                setattr(self, k, data[k])

    def __repr__(self):
        return self.__dict__.__repr__()


def parse_registry(infile, variant, backend, encoding):
    logging.getLogger(__name__).info(
        'Found registry. Parsing and importing file {0}'.format(infile.name))
    corpus_id = os.path.basename(infile.name)
    tokenize = Tokenizer(infile, encoding)
    tokens = tokenize()
    parse = Parser(corpus_id, variant, tokens, backend)
    items = parse()
    return items.save()


def get_corpus_size(corpus_id, reg_dir):
    corp = manatee.Corpus(os.path.join(reg_dir, corpus_id))
    return corp.size() if corp else 0


def process_corpora(conf_list, backend, reg_dir, variant, replace):
    for conf_file in conf_list:
        logging.getLogger(__name__).info('Processing {0}'.format(conf_file))
        with open(conf_file) as fr:
            conf = InstallJson()
            conf.update(fr)

            if replace:
                logging.getLogger(__name__).info(
                    'Removing existing record (including registry) for {0}.'.format(conf.ident))
                backend.remove_corpus(conf.ident)

            if backend.contains_corpus(conf.ident):
                logging.getLogger(__name__).info(
                    'Corpus {0} already present - skipping.'.format(conf.ident))
            else:
                backend.save_corpus_config(conf, reg_dir, get_corpus_size(conf.ident, reg_dir))
                logging.getLogger(__name__).info('Saved config for {0}.'.format(conf.ident))

            if variant:
                reg_path = os.path.join(reg_dir, variant, conf.ident)
            else:
                reg_path = os.path.join(reg_dir, conf.ident)

            if os.path.isfile(reg_path):
                enc = infer_encoding(reg_path)
                with open(reg_path) as fr2:
                    parse_registry(fr2, variant=variant, backend=backend, encoding=enc)


def get_conf_list(dir_path):
    return [os.path.join(dir_path, x) for x in os.listdir(dir_path) if x.endswith('.json') and not x.startswith('.')]


def load_default_conf(inp_path):
    p = os.path.join(os.path.dirname(inp_path), '.conf.json')
    if os.path.isfile(p):
        with open(p) as fr:
            data = json.load(fr)
            return data
    return {}


def find_db_reg_paths(conf_path):
    with open(conf_path) as fr:
        doc = etree.parse(fr)
        srch = doc.find('/plugins/corparch/file')
        if srch is not None:
            return srch.text
    return None


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Add a corpus to KonText corpus archive database')
    parser.add_argument('jsonpath', metavar='CORPUS_JSON_PATH', type=str,
                        help='Path to a single json file or to a directory with multiple json files of aligned corpora')
    parser.add_argument('-d', '--registry-dir', metavar='REG_DIR', type=str)
    parser.add_argument('-k', '--kontext-conf', metavar='KONTEXT_CONF', type=str)
    parser.add_argument('-a', '--variant', metavar='VARIANT', type=str,
                        help='Add corpus as a specified variant')
    parser.add_argument('-r', '--replace', metavar='REPLACE', action='store_const', const=True,
                        help='Remove possible existing record first')
    args = parser.parse_args()
    if args.kontext_conf:
        conf_path = args.kontext_conf
    else:
        conf_path = os.path.join(os.getcwd(), 'conf', 'config.xml')
        logging.getLogger(__name__).info(
            'No config.xml path specified - assuming ./conf/config.xml')
    conf = Config(registry_dir_path=args.registry_dir, kontext_conf_path=conf_path)
    settings.load(conf_path)
    jsonpath = args.jsonpath.rstrip('/')
    conf.update_missing(load_default_conf(jsonpath))
    db_path = find_db_reg_paths(conf.kontext_conf_path)
    backend = WritableBackend(db_path)
    if os.path.isfile(jsonpath):
        file_list = [jsonpath]
    elif os.path.isdir(jsonpath):
        file_list = get_conf_list(jsonpath)
    process_corpora(file_list, backend=backend, reg_dir=conf.registry_dir_path, variant=args.variant,
                    replace=args.replace)
    backend.commit()
