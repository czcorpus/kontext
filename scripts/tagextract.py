#!/usr/bin/python
import os
import sys
import json
import subprocess
import argparse

sys.path.insert(0, './lib')

import manatee

class TagExtractor(object):
    """
    General tag extractor. For normal use you want to use its descendant classes.
    """

    def create_struct(self, active_pos, num_flag_pos):
        lft = range(num_flag_pos + 1)[:active_pos]
        rgt =  range(num_flag_pos + 1)[active_pos + 1:num_flag_pos]
        return dict(zip(lft + rgt, [set() for i in range(num_flag_pos)]))

    def export_tag_relations(self, data, active_pos, num_flag_pos):
        """
        Returns all possible variants of other (according to active_pos) tag positions

        Parameters
        ----------
        data : list
          a list of all unique tag values
        active_pos : int
          tag position index
        num_flag_pos : int
          number of flag positions used within tags (in case of Czech National Corpus it is typically 16)

        Returns
        -------
        dict
          a dictionary of the following form:
          { 'active_pos_flag_letter' :
                  { 1 : [ ... list of unique characters on position 1 ],
                    2 : [ ... list of unique characters on position 2],... },
            'another_active_pos_flag_letter' : ...
          }
        """
        ans = {}

        for tag in data:
            tag += ''.join(['-' for i in range(num_flag_pos - len(tag))])
            key = tag[active_pos]
            if not key in ans:
                ans[key] = self.create_struct(active_pos, num_flag_pos)
            for i in range(num_flag_pos):
                if i != active_pos:
                    ans[key][i].add(tag[i])
        for key, value in ans.items():
            for key2 in value:
                value[key2] = tuple(value[key2])
        return ans


class CompiledCorpusTagExtractor(TagExtractor):
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



class SourceCorpusTagExtractor(TagExtractor):
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
                os.environ['MANATEE_REGISTRY'] = '/var/local/corpora/registry/'
            t = CompiledCorpusTagExtractor()
            tags = t.export_tags(args.corpus_id)
        else:
            raise Exception('Unknown source type: %s' % args.source_type)

        file_mask = '%s.tags.%s.json'
        for i in range (args.num_tag_pos):
            file_name = file_mask % (args.export_name, i)
            with open(file_name, 'w') as f:
                ans = t.export_tag_relations(tags, i, args.num_tag_pos)
                json_ans = json.dumps(ans)
                f.write(json_ans)
                f.close()
                print('Created file %s' % file_name)
    except Exception, e:
        print('ERROR: %s' % e)