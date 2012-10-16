import settings
import os
import re
import json

class TagGeneratorException(Exception):
    pass


class TagVariantLoader(object):
    """
    """

    def __init__(self, corp_name, num_tag_pos):
        """
        """
        self.corp_name = corp_name
        self.num_tag_pos = num_tag_pos
        self.tags_file = open('%s/%s' % (settings.get('corpora', 'tags_src_dir'), self.corp_name))
        self.cache_dir = '%s/%s' % (settings.get('corpora', 'tags_cache_dir'), self.corp_name)

    def get_variant(self, selected_tags):
        """
        """
        path = '%s/tag-%s.json' % (self.cache_dir, selected_tags)
        data = '{}'
        if not os.path.exists(path):
            data = json.dumps(self.calculate_variant(selected_tags))
            with open(path, 'w') as f:
                f.write(data)
                f.close()
        else:
            with open(path) as f:
                data = f.read()
                f.close()
        return data

    def get_fixed_positions(self, pattern):
        """
        """
        pass

    def get_unique_values_at_pos(self, position):
        """
        """
        path = '%s/position-%s.json' % (self.cache_dir, position)
        data = '[]'
        if not os.path.exists(path):
            ans = set()
            for line in self.tags_file:
                line = line.strip() + (self.num_tag_pos - len(line.strip())) * '-'
                if line[position] != '-':
                    ans.add(line[position])
            data = json.dumps(tuple(ans))
            with open(path, 'w') as f:
                f.write(data)
                f.close()
        else:
            with open(path, 'r') as f:
                data = f.read()
                f.close()
        return data

    def calculate_variant(self, selected_tags):
        """
        """
        patt = re.compile(selected_tags.replace('-', r'[\w\-]'))
        matching_tags = []
        for line in self.tags_file:
            line = line.strip() + (self.num_tag_pos - len(line.strip())) * '-'
            if patt.match(line):
                matching_tags.append(line)

        ans = {}
        #fixed_pos = [i for i in range(len(selected_tags)) if selected_tags[i] != '-']
        for item in matching_tags:
            for i in range(len(selected_tags)):
                if i not in ans:
                    ans[i] = set()
                if item[i] != '-':
                    ans[i].add(item[i])
        for key in ans:
            ans[key] = tuple(ans[key]) if ans[key] is not None else None
        return ans

    def cache_variant(self, selected_positions):
        """
        """
        pass