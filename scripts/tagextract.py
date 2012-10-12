import os
import sys
import json

sys.path.insert(0, './lib')

import manatee
import corplib

class TagExtractor(object):
    """
    """

    def __init__(self, corpname, num_flag_pos, tag_flags1):
        """
        """
        self.corpname = corpname
        self.num_flag_pos = num_flag_pos
        self.tag_flags1 = tag_flags1

    def generate_kwiclines(self, query, corpus):
        """
        Returns
        -------
        a set of all unique tags
        """
        conc = manatee.Concordance(corpus, query, 0)
        kw = manatee.KWICLines (conc, '-1#', '1#', 'tag', 'tag', '', '#', 0)
        data = set()
        for i in range(conc.size()):
            kw.nextline(i)
            data.add(kw.get_kwic()[0].strip())
        return data

    def find_unique_subflags(self, data):
        """
        """
        ans = {}
        for key, value in data.items():
            ans[key] = dict(zip(range(self.num_flag_pos + 1)[1:], [set() for i in range(self.num_flag_pos + 1)[1:]]))
            for tag in value:
                i = 1
                for s in tag[1:]:
                    ans[key][i].add(s)
                    i += 1
        for key, value in ans.items():
            for key2 in value:
                value[key2] = tuple(value[key2])
        return ans


    def extract(self):
        """
        """
        cm = corplib.CorpusManager()
        corpus = cm.get_Corpus(self.corpname)
        ans = {}
        for flag in self.tag_flags1:
            ans[flag] = self.generate_kwiclines('[tag="%s.*"]' % flag, corpus)
        final_ans = self.find_unique_subflags(ans)
        return final_ans

if __name__ == '__main__':
    if not os.environ.has_key ('MANATEE_REGISTRY'):
        os.environ['MANATEE_REGISTRY'] = '/var/local/corpora/registry/'

    ### syn.... etc ###
    #flags = ['A', 'C', 'D', 'I', 'J', 'N', 'P', 'R', 'T', 'V', 'X', 'Z']
    #num_flag_pos = 16

    ### susanne ###
    flags = ['N', 'J', 'V', 'R', 'I']
    num_flag_pos = 6
    t = TagExtractor(sys.argv[1], num_flag_pos, flags)
    print('test: %s' % t.corpname)
    ans = t.extract()
    json_ans = json.dumps(ans)
    print(json_ans)