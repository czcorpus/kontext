#!/usr/bin/python
# Copyright (c) 2012 Czech National Corpus
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

import os
import sys
import json
import subprocess
import argparse

sys.path.insert(0, './lib')

import manatee


class CompiledCorpusTagExtractor(object):
    """
    Extracts unique tag position values using a compiled corpus.
    Instances are stateless so you can use a single one to export tags from multiple corpora.
    """

    def generate_kwiclines(self, query, corpus):
        """
        Parameters
        ----------
        query : str
          a query to be used to extract all tag values
        corpus : str
          a corpus name

        Returns
        -------
        set
          a set containing all unique tag values as found in the corpus
        """
        conc = manatee.Concordance(corpus, query, 0)
        kw = manatee.KWICLines (conc, '-1#', '1#', 'tag', 'tag', '', '#', 0)
        ans = set()
        for i in range(conc.size()):
            kw.nextline(i)
            ans.add(kw.get_kwic()[0].strip())
        return sorted(tuple(ans))

    def export_tags(self, corpname):
        """
        Parameters
        ----------
        corpname : str
          a name of the corpus we want to extract tags from

        Returns
        -------
        tuple
          unique list of all found tags
        """
        import corplib

        cm = corplib.CorpusManager()
        corpus = cm.get_Corpus(corpname)
        return self.generate_kwiclines('[tag=".*"]', corpus)



class SourceCorpusTagExtractor(object):
    """
    Instances are stateless so you can use a single one to export tags from multiple corpora.
    """

    def export_tags(self, src_path):
        """
        Loads all unique tags as found in provided corpus source

        Parameters
        ----------
        src_path : str
          path to a corpus source file

        Returns
        -------
        tuple
          unique list of all found tags
        """
        if src_path.endswith('.gz'):
            cat_type = 'zcat'
        else:
            cat_type = 'cat'
        p = subprocess.Popen("%s %s | grep -v '<' | awk 'BEGIN { FS = \"\\t\" } ; {print $3}' | sort | uniq" % (cat_type, src_path),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
        lines, err = p.communicate()
        if len(err) > 0:
            raise Exception(err)
        lines = lines.split('\n')
        ans = set()
        for line in lines:
            if len(line.strip()) > 0:
                ans.add(line.strip())
        return sorted(tuple(ans))


def dump(data):
    """
    """
    for key in data:
        print('[%s]:' % key)
        for k2 in data[key]:
            print('   %s -> %s' % (k2, ', '.join(sorted(data[key][k2]))))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Extracts tag position values relationships.')
    parser.add_argument('--source-type', default='plain',
            help='source to be analyzed (plain vs. compiled)')
    parser.add_argument('--export-name', default='untitled',
            help='a name to be used when exporting corpus tags data files')
    parser.add_argument('--registry-path', default='/var/local/corpora/registry/', help='path to the directory containing corpora registry files')
    parser.add_argument('corpus_id', metavar='CORPUS_ID', type=str,
        help='Corpus name or path (depends on the type of selected processing method')
    parser.add_argument('num_tag_pos', metavar='NUMBER_OF_TAG_POSITIONS', type=int,
        help='Number of positions within tags (typically, it is 16)')

    try:
        args = parser.parse_args()
        tags = []
        if args.source_type == 'plain':
            t = SourceCorpusTagExtractor()
            tags = t.export_tags(args.corpus_id)
        elif args.source_type == 'compiled':
            if not os.environ.has_key ('MANATEE_REGISTRY'):
                os.environ['MANATEE_REGISTRY'] = args.registry_path
            t = CompiledCorpusTagExtractor()
            tags = t.export_tags(args.corpus_id)
        else:
            raise Exception('Unknown source type: %s' % args.source_type)

        file_name = '%s.tags' % args.export_name
        with open(file_name, 'w') as f:
            for line in tags:
                f.write('%s\n' % line)
            f.close()
            print('Created file %s' % file_name)
    except Exception, e:
        import traceback
        err_type, err_value, err_trace = sys.exc_info()
        err_out = traceback.format_exception(err_type, err_value, err_trace)
        print('\n'.join(err_out))
        print('ERROR: %s' % e)