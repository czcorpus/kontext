# Copyright (c) 2012 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2012 Tomas Machalek <tomas.machalek@gmail.com>
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
import time
import json
from collections import defaultdict
import re
from lxml import etree
from plugins.abstract.taghelper import AbstractTagsetInfoLoader


class PositionalTagVariantLoader(AbstractTagsetInfoLoader):
    """
    A backend for tag writing auto-complete, interactive tag writing widgets etc.
    Please note that values in config.xml/corpora/tags_cache_dir are cached without
    specific expiration time. It means that any data update must be followed by
    manual cache clean-up.
    """

    SPEC_CHAR_REPLACEMENTS = (
        ('-', r'.'),
        ('*', r'\*'),
        ('^', r'\^'),
        ('?', r'\?'),
        ('}', r'\}'),
        ('!', r'\!')
    )

    def __init__(self, corpus_name, tagset_name, cache_dir, variants_file_path, cache_clear_interval,
                 taglist_path):
        """
        """
        self.corpus_name = corpus_name
        self.tagset_name = tagset_name
        self.variants_file_path = variants_file_path
        self.cache_dir = os.path.join(cache_dir, self.corpus_name)
        self.cache_clear_interval = cache_clear_interval
        self.taglist_path = taglist_path
        self.initial_values = {}

    def get_variant(self, user_selection, lang):
        """
        """
        return self.calculate_variant(user_selection, lang)

    def get_initial_values(self, lang):
        if lang not in self.initial_values:
            self.initial_values[lang] = self._get_initial_values(lang)
        return self.initial_values[lang]

    def is_enabled(self):
        return len(self.get_initial_values('en_US')) > 0

    def _get_initial_values(self, lang):
        """
        Loads all values as needed to initialize tag-builder widget for the current corpus.
        It means for any tag position all possible values must be returned. Collected
        data are cached forever as a JSON file.

        returns:
        a JSON string with the following structure:
        {
            "labels" : [label-0, label-1,..., label-N],
            "tags" : [
                [ [value-0-0, label-0-0], [value-0-1, label-0-1], ...],
                [ [value-1-0, label-1-0], [value-1-0, label-1-1], ...],
                ...
            ]
        }
        """
        path = '%s/initial-values.%s.json' % (self.cache_dir, lang)
        char_replac_tab = dict(self.SPEC_CHAR_REPLACEMENTS)
        tagset = self._load_tag_descriptions(self.tagset_name, lang)
        if tagset is None:
            return {}
        item_sequences = tuple([tuple([item[0] for item in position])
                                for position in tagset['values']])

        translation_table = [dict(tagset['values'][i]) for i in range(tagset['num_pos'])]

        if os.path.exists(path) \
                and time.time() - os.stat(path).st_ctime > self.cache_clear_interval:
            os.unlink(path)

        if not os.path.exists(path):
            cache_path_items = os.path.dirname(path).split('/')
            if cache_path_items[0] == '':
                cache_path_items[0] = '/'
            else:
                cache_path_items.insert(0, './')
            tst_path = ''
            for s in cache_path_items:
                tst_path += '%s/' % s
                if not os.path.exists(tst_path):
                    os.mkdir(tst_path, 0775)
            ans = [set() for i in range(tagset['num_pos'])]
            with open(self.variants_file_path) as fr:
                for line in fr:
                    line = line.strip() + (tagset['num_pos'] - len(line.strip())) * '-'
                    for i in range(tagset['num_pos']):
                        value = ''.join(map(lambda x: char_replac_tab.get(x, x), line[i]))
                        if line[i] == '-':
                            ans[i].add(('-', ''))
                        elif i < len(tagset['values']):
                            if line[i] in translation_table[i]:
                                ans[i].add((value, '%s - %s' %
                                            (line[i], translation_table[i][line[i]])))

            ans_sorted = []
            for i in range(len(ans)):
                def cmp_by_seq(x, y): return (cmp(item_sequences[i].index(x[0]), item_sequences[i].index(y[0]))
                                              if x[0] in item_sequences[i] and y[0] in item_sequences[i] else 0)
                ans_sorted.append(sorted(ans[i], cmp=cmp_by_seq))

            for i in range(len(ans_sorted)):
                if len(ans_sorted[i]) == 1 and ans_sorted[i][0] == '-':
                    ans_sorted[i] = ()
            data = {'tags': ans_sorted, 'labels': tagset['labels']}
            with open(path, 'w') as f:
                json.dump(data, f)
        else:
            with open(path, 'r') as f:
                data = json.load(f)
        return data

    def calculate_variant(self, required_pattern, lang):
        """
        Returns all tag variants in unspecified positions for a provided tag pattern.
        I.e. - if you enter 'A.B..' then all vectors 'v' with v[0] = A and v[2] = B
        will be returned.

        arguments:
        required_pattern -- searched tag pattern (regular expression)

        returns:
        a dictionary where keys represent tag-string position and values are lists of
        tuples (ID, description)
        """
        tagset = self._load_tag_descriptions(self.tagset_name, lang)
        item_sequences = tuple([tuple(['-'] + [item[0] for item in position])
                                for position in tagset['values']])
        required_pattern = required_pattern.replace('-', '.')
        char_replac_tab = dict(self.__class__.SPEC_CHAR_REPLACEMENTS)
        patt = re.compile(required_pattern)
        matching_tags = []
        with open(self.variants_file_path) as fr:
            for line in fr:
                line = line.strip() + (tagset['num_pos'] - len(line.strip())) * '-'
                if patt.match(line):
                    matching_tags.append(line)

        ans = defaultdict(lambda: set())
        tag_elms = re.findall(r'\\[\*\?\^\.!]|\[[^\]]+\]|[^-]|-', required_pattern)
        translation_tables = [dict(tagset['values'][i]) for i in range(len(tag_elms))]

        for item in matching_tags:
            for i in range(len(tag_elms)):
                value = ''.join(
                    map(lambda x: char_replac_tab[x] if x in char_replac_tab else x, item[i]))
                if item[i] == '-':
                    ans[i].add(('-', ''))
                elif item[i] in translation_tables[i]:
                    ans[i].add((value, '%s - %s' % (item[i], translation_tables[i][item[i]])))
                else:
                    ans[i].add((value, '%s - %s' % (item[i], item[i])))

        for key in ans:
            i = int(key)
            used_keys = [x[0] for x in ans[key]]
            if '-' in used_keys:
                # in only '-' is available it actaually means there is no need to choose anything
                if len(used_keys) == 1:
                    ans[key] = ()

            def cmp_by_seq(x, y): return cmp(item_sequences[i].index(x[0]), item_sequences[i].index(y[0])) \
                if x[0] in item_sequences[i] and y[0] in item_sequences[i] else 0
            ans[key] = sorted(ans[key], cmp=cmp_by_seq) if ans[key] is not None else None
        return {'tags': ans, 'labels': []}

    def _load_tag_descriptions(self, tagset_name, lang):
        """
        arguments:
        path -- path to an XML file containing tag descriptions
        tagset_name -- an identifier of a tagset (as used in <tagset name="...">)
        lang -- requested language (if not found then EN version is returned)

        returns:
        a dictionary containing three keys:
          * 'values' : [a list (= positions) of lists (= possible values) of 2-tuples (value and description)]
          * 'labels' : [a list of labels for all the positions]
          * 'num_pos' : [number of tagset positions]
        """
        lang = lang.split('_')[0]
        with open(self.taglist_path) as fr:
            xml = etree.parse(fr)
        root = xml.find('/tagsets/tagset[@ident="%s"]' % tagset_name)
        if root is None:
            return None

        num_tag_pos = int(root.attrib['num_pos'])
        values = [None] * num_tag_pos
        labels = [None] * num_tag_pos
        undefined_indices = set(range(num_tag_pos))

        for item in root:
            idx = int(item.attrib['index'])
            undefined_indices.remove(idx)
            values[idx] = []
            for v in item:
                if v.tag == 'value':
                    translations = {}
                    for d in v:
                        translations[d.attrib['lang']] = d.text
                    if lang in translations:
                        values[idx].append((v.attrib['ident'], translations[lang]))
                    elif 'en' in translations:
                        values[idx].append((v.attrib['ident'], translations['en']))
                    else:
                        values[idx].append((v.attrib['ident'], '[%s]' % _('no description')))
                elif v.tag == 'label':
                    translations = {}
                    for d in v:
                        translations[d.attrib['lang']] = d.text
                    if lang in translations:
                        labels[idx] = translations[lang]
                    elif 'en' in translations:
                        labels[idx] = translations['en']
                    else:
                        labels[idx] = None
        for item in undefined_indices:
            values[item] = []
            labels[item] = None
        return dict(values=values, labels=labels, num_pos=num_tag_pos)
