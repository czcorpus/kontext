# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
"""
This module contains a bunch of Luigi (see https://github.com/spotify/luigi)
tasks for installing a new corpus.
"""

import luigi
import pickle
import json
import os
import logging

import cmd_actions
import settings
settings.load(path=os.path.join(os.path.dirname(__file__), '../../conf/config.xml'))

WORKING_DIR = '/tmp/luigi'  # TODO


def open_vertical_file(path):
    """
    returns a file handler of either gzipped or plain vertical file

    arguments:
    path -- path to a vertical file
    """
    if path.endswith('.gz'):
        import gzip
        return gzip.open(path, 'rb')
    else:
        return open(path, 'rb')


class TagVariantsExtraction(luigi.Task):
    """
    Task for extracting all the unique PoS tag variants from a vertical file
    """
    vertical_file = luigi.Parameter()

    def _mk_output_path(self):
        return os.path.join(WORKING_DIR, '%s.tags' % (os.path.basename(self.vertical_file,)))

    def output(self):
        return luigi.LocalTarget(path=self._mk_output_path())

    def run(self):
        tags = cmd_actions.export_tags(self.vertical_file)
        with open(self._mk_output_path(), 'w') as fout:
            fout.writelines(s + '\n' for s in tags)


class CompileVerticalFileError(Exception):
    pass


class CompileVerticalFile(luigi.Task):
    """
    Task for compiling a vertical file into indexed Manatee binaries
    """
    vertical_file = luigi.Parameter()
    registry_file = luigi.Parameter()

    def _mk_output_path(self):
        return os.path.join(WORKING_DIR, '%s-encodevert.out' % os.path.basename(self.registry_file))

    def run(self):
        import regparser
        conf = regparser.parse_simple_values(self.registry_file)
        if 'PATH' not in conf:
            raise CompileVerticalFileError('Failed to find the PATH value in the registry file [%s]' % (
                self.registry_file,))
        return_code, err = cmd_actions.compile_vertical_file(vertical_file=self.vertical_file,
                                                             registry_file=self.registry_file,
                                                             memory_limit=500,  # TODO
                                                             target_dir=conf['PATH'])
        if return_code > 0:
            ex = CompileVerticalFileError('Encodevert failed to compile vertical file %s. Code: %s' % (
                self.vertical_file, return_code,))
            logging.getLogger(__name__).error(ex)
            raise ex
        with open(self._mk_output_path(), 'wb') as fout:
            fout.write(err)

    def output(self):
        return luigi.LocalTarget(path=self._mk_output_path())


class RegistryDataExtraction(luigi.Task):
    """
    Task for extracting structures&attributes data from a vertical file.
    """
    reg_path = luigi.Parameter()

    @staticmethod
    def _mk_output_path(reg_path):
        return os.path.join(WORKING_DIR, '%s.pkl' % os.path.basename(reg_path))

    def output(self):
        return luigi.LocalTarget(path=self._mk_output_path(self.reg_path))

    def run(self):
        from corp_build import regparser
        parser = regparser.RegistryParser()
        data = parser.parse(self.reg_path)
        with self.output().open('w') as fout:
            pickle.dump(data, fout)


class TextTypeExtractionError(Exception):
    pass


class TextTypeExtraction(luigi.Task):
    """
    Task for extracting information about available text type information.
    """

    conf = luigi.Parameter()
    corpus_id = luigi.Parameter()

    def _mk_output_path(self):
        return os.path.join(WORKING_DIR, '%s.db' % self.corpus_id)

    def get_conf(self, key, default=None):
        return self.conf[self.corpus_id].get(key, default)

    def requires(self):
        return RegistryDataExtraction(reg_path=self.get_conf('registryFile'))

    def output(self):
        return luigi.LocalTarget(path=self._mk_output_path())

    def run(self):
        from tt_extract import DatabaseOps, open_db, parse_file

        with self.input().open('r') as fin:
            data = pickle.load(fin)
        atom_struct = self.get_conf('atomStructure')
        try:
            astruct = next(struct for struct in data if struct.name == atom_struct)
            db = open_db(self.output().path)
            table_creator = DatabaseOps(db=db, atom_structure=astruct, uniq_attr=self.get_conf('uniqAttr'))
            table_creator.create_schema()

            with open_vertical_file(self.conf[self.corpus_id]['verticalFile']) as f:
                item_gen = parse_file(in_file=f, item_tag=self.get_conf('atomStructure'),
                                      corpname=self.corpus_id, encoding=self.get_conf('encoding'),
                                      virtual_tags=self.get_conf('virtualTags', []))
                i = 0
                for div in item_gen:
                    table_creator.insert_record(div)
                    i += 1
                table_creator.finish()
                logging.getLogger(__name__).info('Processed %d <%s> elements' % (i, self.get_conf('atomStructure')))
        except StopIteration:
            raise TextTypeExtractionError('Failed to find atom structure %s' % (atom_struct,))


class ClearBuild(luigi.Task):
    """
    Remove whole task working directory. This can be used
    to reset whole processing.
    """
    def __init__(self):
        super(ClearBuild, self).__init__()
        self._finished = False

    def run(self):
        import shutil
        shutil.rmtree(WORKING_DIR)
        self._finished = True

    def complete(self):
        return self._finished


class DryInstallCorpus(luigi.Task):
    """
    Task for a full installation of new corpus
    """
    corpus_id = luigi.Parameter()
    conf_path = luigi.Parameter()

    @staticmethod
    def _mk_output_path():
        return os.path.join(WORKING_DIR, 'result.txt')

    def load_conf(self):
        with open(self.conf_path, 'rb') as fin:
            return json.load(fin)

    def requires(self):
        conf = self.load_conf()
        vertical_file = conf[self.corpus_id]['verticalFile']
        registry_file = conf[self.corpus_id]['registryFile']
        return [
            TextTypeExtraction(conf=conf, corpus_id=self.corpus_id),
            TagVariantsExtraction(vertical_file=vertical_file),
            CompileVerticalFile(vertical_file=vertical_file, registry_file=registry_file)
        ]

    def tag_install_args(self):
        tag_conf = settings.get('plugins', 'taghelper', {})
        if 'default:tags_src_dir' in tag_conf:
            return self.input()[1].path, os.path.join(tag_conf['default:tags_src_dir'], self.corpus_id)
        return None

    def tt_install_args(self, conf):
        return self.input()[0].path, conf['dbFile']

    def check_indices(self):
        return 'produced %s index files' % (self.input()[2],)

    def create_conf_snippet(self, conf):
        return '\n'.join(('<corpus ident="%s">' % self.corpus_id,
                          '<metadata>',
                          '<database>%s</database>' % (conf['dbFile']),
                          '<label_attr>%s.%s</label_attr>' % (conf['atomStructure'], conf['uniqAttr'],),
                          '<id_attr>%s.%s</id_attr>' % (conf['atomStructure'], conf['uniqAttr'],),
                          '</metadata>',
                          '</corpus>'))

    def run(self):
        conf = self.load_conf()[self.corpus_id]
        outp = (
            'install: %s' % self.create_conf_snippet(conf),
            'move %s --> %s' % self.tag_install_args(),
            'move %s --> %s' % self.tt_install_args(conf),
            self.check_indices()
        )
        with open(self._mk_output_path(), 'wb') as fout:
            fout.writelines(x + '\n' for x in outp)
        print('\n')
        print('>>>>>>>>>>>>>>>>>>>> DRY RUN <<<<<<<<<<<<<<<<<<<<<<<<<<<<')
        print('\n'.join(outp))
        print('---------------------------------------------------------')
        print('\n')

    def output(self):
        return luigi.LocalTarget(path=self._mk_output_path())


class InstallCorpus(DryInstallCorpus):
    def run(self):
        pass


