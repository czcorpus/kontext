# -*- coding: utf-8 -*-
#
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

import settings
import os
import re
import json
import logging
import time
from lxml import etree

from translation import ugettext as _


class TagGeneratorException(Exception):
    """
    General error for taghelper module
    """
    pass


def create_tag_variants_file_path(corpus_name):
    """
    Generates full path (full = as defined in the main configuration file)
    to the file listing all existing tag variants within for provided corpus name

    Parameters
    ----------
    corpus_name : str

    Returns
    -------
    path : str
    """
    if not corpus_name:
        raise TagGeneratorException('Empty corpus name')
    return '%s/%s' % (settings.get('corpora', 'tags_src_dir'), corpus_name)


def tag_variants_file_exists(corpus_name):
    """
    Tests whether the path to the provided corpus_name exists

    Parameters
    ----------
    corpus_name : str

    Returns
    -------
    answer : bool
    """
    if corpus_name:
        return os.path.exists(create_tag_variants_file_path(corpus_name))
    return False


def load_tag_descriptions(path, tagset_name, lang):
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
    xml = etree.parse(open(path))
    root = xml.find('corpora/tagsets/tagset[@name="%s"]' % tagset_name)
    if root is None:
        raise TagGeneratorException('Failed to find tagset %s' % tagset_name)

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
                    values[idx].append((v.attrib['id'], translations[lang]))
                elif 'en' in translations:
                    values[idx].append((v.attrib['id'], translations['en']))
                else:
                    values[idx].append((v.attrib['id'], '[%s]' % _('no description')))
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


class TagVariantLoader(object):
    """
    """

    spec_char_replacements = (
        ('-', r'.'),
        ('*', r'\*'),
        ('^', r'\^'),
        ('?', r'\?'),
        ('}', r'\}'),
        ('!', r'\!')
    )

    def __init__(self, corpus_name, tagset_name, lang):
        """
        arguments:
        corpus_name -- name/id of a corpus
        tagset_name -- name/id of a tagset
        lang -- two-letter language code (cs, en, de,...)
        """
        self.corpus_name = corpus_name
        self.tagset_name = tagset_name
        self.variants_file = open(create_tag_variants_file_path(self.corpus_name))
        self.metadata_file = settings.conf_path()  # TODO
        self.cache_dir = '%s/%s' % (settings.get('corpora', 'tags_cache_dir'), self.tagset_name)
        self.lang = lang

    def get_variant(self, selected_tags):
        """
        """
        return json.dumps(self.calculate_variant(selected_tags))

    def get_initial_values(self):
        """
        Loads all values as needed to initialize tag-builder widget.
        Values are cached forever into a JSON file.
        """
        path = '%s/initial-values.%s.json' % (self.cache_dir, self.lang)
        char_replac_tab = dict(self.__class__.spec_char_replacements)
        tagset = load_tag_descriptions(settings.conf_path(), self.tagset_name, self.lang)
        item_sequences = tuple([tuple([item[0] for item in position]) for position in tagset['values']])

        translation_table = [dict(tagset['values'][i]) for i in range(tagset['num_pos'])]

        if os.path.exists(path) \
                and time.time() - os.stat(path).st_ctime > settings.get_int('cache', 'clear_interval'):
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
            for line in self.variants_file:
                line = line.strip() + (tagset['num_pos'] - len(line.strip())) * '-'
                for i in range(tagset['num_pos']):
                    value = ''.join(map(lambda x: char_replac_tab[x] if x in char_replac_tab else x, line[i]))
                    if line[i] == '-':
                        ans[i].add(('-', ''))
                    elif i < len(tagset['values']):
                        if line[i] in translation_table[i]:
                            ans[i].add((value, '%s - %s' % (line[i], translation_table[i][line[i]])))

            ans_sorted = []
            for i in range(len(ans)):
                cmp_by_seq = lambda x, y: cmp(item_sequences[i].index(x[0]), item_sequences[i].index(y[0])) \
                    if x[0] in item_sequences[i] and y[0] in item_sequences[i] else 0
                ans_sorted.append(sorted(ans[i], cmp=cmp_by_seq))

            for i in range(len(ans_sorted)):
                if len(ans_sorted[i]) == 1 and ans_sorted[i][0] == '-':
                    ans_sorted[i] = ()
            data = json.dumps({'tags': ans_sorted, 'labels': tagset['labels']})
            with open(path, 'w') as f:
                f.write(data)
                f.close()
        else:
            with open(path, 'r') as f:
                data = f.read()
                f.close()
        return data

    def calculate_variant(self, required_pattern):
        """
        Returns all tag variants in empty positions for a provided tag pattern.
        I.e. - if you enter 'A.B..' then all vectors 'v' with v[0] = A and v[2] = B
        will be returned.

        Parameters
        ----------
        required_pattern : str
                           tag pattern (regular expression)

        Returns
        -------
        variants : dict
                   a dictionary where keys represent tag-string position and values are lists of
                   tuples containing pairs 'ID, description'
        """
        tagset = load_tag_descriptions(settings.conf_path(), self.tagset_name, self.lang)
        item_sequences = tuple([tuple(['-'] + [item[0] for item in position]) for position in tagset['values']])
        required_pattern = required_pattern.replace('-', '.')
        char_replac_tab = dict(self.__class__.spec_char_replacements)
        patt = re.compile(required_pattern)
        matching_tags = []
        for line in self.variants_file:
            line = line.strip() + (tagset['num_pos'] - len(line.strip())) * '-'
            if patt.match(line):
                matching_tags.append(line)

        ans = {}
        for item in matching_tags:
            tag_elms = re.findall(r'\\[\*\?\^\.!]|\[[^\]]+\]|[^-]|-', required_pattern)
            for i in range(len(tag_elms)):
                value = ''.join(map(lambda x: char_replac_tab[x] if x in char_replac_tab else x, item[i]))
                translation_table = dict(tagset['values'][i])
                if i not in ans:
                    ans[i] = set()
                if item[i] == '-':
                    ans[i].add(('-', ''))
                elif item[i] in translation_table:
                    ans[i].add((value, '%s - %s' % (item[i], translation_table[item[i]])))
                else:
                    ans[i].add((value, '%s - %s' % (item[i], item[i])))

        for key in ans:
            i = int(key)
            used_keys = [x[0] for x in ans[key]]
            if '-' in used_keys:
                if len(used_keys) == 1:
                    ans[key] = ()
                elif len(used_keys) == 2:
                    ans[key].remove(('-', ''))
            elif len(used_keys) > 1:
                ans[key].add(('-', ''))
            cmp_by_seq = lambda x, y: cmp(item_sequences[i].index(x[0]), item_sequences[i].index(y[0])) \
                if x[0] in item_sequences[i] and y[0] in item_sequences[i] else 0
            ans[key] = sorted(ans[key], cmp=cmp_by_seq) if ans[key] is not None else None
        return { 'tags' : ans, 'labels' : [] }