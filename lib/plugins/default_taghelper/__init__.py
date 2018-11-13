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

"""
A 'taghelper' plug-in implementation. It provides a data-driven, interactive way
how to create a tag query. Please note that this works only with tag formats with
fixed positions for defined categories (e.g.: part of speech = character 0,
gender = character 1, case = character 2,...)

Please note that this module requires a proper Corptree plug-in configuration and data.

Required XML:

element taghelper {
  element module { "default_taghelper" }
  element clear_interval {
    attribute extension-by { "default" }
    text # TTL - number of seconds
  }
  element tags_cache_dir {
    attribute extension-by { "default" }
    text #  a path to a dir where files are cached
  }
}
"""

import os
import re
import json
import time
from collections import defaultdict
from lxml import etree

from translation import ugettext as _
from controller import exposed
from controller.errors import UserActionException
import plugins
from plugins.abstract.taghelper import AbstractTaghelper
from actions import corpora


@exposed(return_type='json')
def ajax_get_tag_variants(ctrl, request):
    """
    """
    pattern = request.args.get('pattern', '')
    try:
        tag_loader = plugins.runtime.TAGHELPER.instance.loader(
            ctrl.args.corpname,
            ctrl.get_corpus_info(ctrl.args.corpname)['tagset'],
            ctrl.ui_lang)
    except IOError:
        raise UserActionException(
            _('Corpus %s is not supported by this widget.') % ctrl.args.corpname)

    if len(pattern) > 0:
        ans = tag_loader.get_variant(pattern)
    else:
        ans = tag_loader.get_initial_values()
    return ans


class TagHelperException(Exception):
    """
    General error for the module
    """
    pass


class Taghelper(AbstractTaghelper):

    def __init__(self, conf):
        self._conf = conf

    def loader(self, corpus_name, tagset_name, lang):
        return TagVariantLoader(self, self._conf, corpus_name, tagset_name, lang)

    def create_tag_variants_file_path(self, corpus_name):
        """
        Generates a full path (full = as defined in the main configuration file)
        to the file which contains all the existing tag variants for the passed
        corpus name

        arguments:
        corpus_name -- str

        returns:
        a path to a specific cached file
        """
        if not corpus_name:
            raise TagHelperException('Empty corpus name')
        return '%s/%s' % (self._conf['default:tags_src_dir'], corpus_name)

    def tags_enabled_for(self, corpus_name):
        """
        Tests whether the path to the provided corpus_name exists

        arguments:
        corpus_name -- str

        returns:
        a boolean value
        """
        if corpus_name:
            return os.path.exists(self.create_tag_variants_file_path(corpus_name))
        return False

    def load_tag_descriptions(self, tagset_name, lang):
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
        xml = etree.parse(open(self._conf['default:taglist_path']))
        root = xml.find('/tagsets/tagset[@ident="%s"]' % tagset_name)
        if root is None:
            raise TagHelperException('Failed to find tagset %s' % tagset_name)

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

    def export_actions(self):
        return {corpora.Corpora: [ajax_get_tag_variants]}


class TagVariantLoader(object):
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

    def __init__(self, taghelper, conf, corpus_name, tagset_name, lang):
        """
        arguments:
        taghelper -- a Taghelper instance
        conf -- a dict containing plug-in configuration
        corpus_name -- name/id of a corpus
        tagset_name -- name/id of a tagset
        lang -- two-letter language code (cs, en, de,...)
        """
        self._taghelper = taghelper
        self._conf = conf
        self.corpus_name = corpus_name
        self.tagset_name = tagset_name
        self.variants_file = open(self._taghelper.create_tag_variants_file_path(self.corpus_name))
        self.cache_dir = '%s/%s' % (self._conf['default:tags_cache_dir'], self.corpus_name)
        self.lang = lang

    def get_variant(self, selected_tags):
        """
        """
        return self.calculate_variant(selected_tags)

    def get_initial_values(self):
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
        path = '%s/initial-values.%s.json' % (self.cache_dir, self.lang)
        char_replac_tab = dict(self.SPEC_CHAR_REPLACEMENTS)
        tagset = self._taghelper.load_tag_descriptions(self.tagset_name, self.lang)
        item_sequences = tuple([tuple([item[0] for item in position])
                                for position in tagset['values']])

        translation_table = [dict(tagset['values'][i]) for i in range(tagset['num_pos'])]

        if os.path.exists(path) \
                and time.time() - os.stat(path).st_ctime > self._conf['default:clear_interval']:
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
                    value = ''.join(map(lambda x: char_replac_tab.get(x, x), line[i]))
                    if line[i] == '-':
                        ans[i].add(('-', ''))
                    elif i < len(tagset['values']):
                        if line[i] in translation_table[i]:
                            ans[i].add((value, '%s - %s' %
                                        (line[i], translation_table[i][line[i]])))

            ans_sorted = []
            for i in range(len(ans)):
                def cmp_by_seq(x, y): return cmp(item_sequences[i].index(x[0]), item_sequences[i].index(y[0])) \
                    if x[0] in item_sequences[i] and y[0] in item_sequences[i] else 0
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

    def calculate_variant(self, required_pattern):
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
        tagset = self._taghelper.load_tag_descriptions(self.tagset_name, self.lang)
        item_sequences = tuple([tuple(['-'] + [item[0] for item in position])
                                for position in tagset['values']])
        required_pattern = required_pattern.replace('-', '.')
        char_replac_tab = dict(self.__class__.SPEC_CHAR_REPLACEMENTS)
        patt = re.compile(required_pattern)
        matching_tags = []
        for line in self.variants_file:
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


def create_instance(conf):
    """
    arguments:
    conf -- KonText's settings module or a compatible object
    """
    return Taghelper(conf.get('plugins', 'taghelper'))
