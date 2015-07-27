# Copyright (c) 2015 Institute of the Czech National Corpus
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
A conversion script to upgrade a standalone 'corplist' XML file to be compatible
with KonText's new 'default_corparch' (or 'ucnk_corparch') plug-in.
"""

import sys
import os
import re
from lxml import etree
import argparse
sys.path.insert(0, '%s/../..' % os.path.realpath(os.path.dirname(__file__)))
import autoconf


def parse_keywords(raw_keywords):
    """
    Parses labels assignments

    Expected format:
    corpus1_id:label 1.1,label 1.2 , label 1.N1
    corpus2_id:label 2.1,label 2.2, label 2.N2
    ...
    """
    corpora = []
    kwords = []
    for line in filter(lambda x: x.strip(), [x.strip() for x in re.split(r'\n', raw_keywords)]):
        corpus, kwlist = re.split(r'\s*:\s*', line)
        kwlist = re.split(r'\s*,\s*', kwlist)
        corpora.append(corpus.lower())
        kwords.append(kwlist)
    return dict(zip(corpora, kwords))


def parse_featured(data):
    """
    Parses featured corpora

    Expected format:
    featured corpora:corp1, corp2, ...
    """
    return [x.lower() for x in re.split(r'\s*,\s*',
                                        re.sub(r'featured\s+corpora:\s*(.+)', r'\1', data))]


def parse_internal(data):
    """
    Parses internal corpora

    Expected format:
    internal corpora: corp1, corp2,...
    """
    return [x.lower() for x in re.split(r'\s*,\s*',
                                        re.sub(r'internal\s+corpora:\s*(.+)', r'\1', data))]


def parse_translations(data):
    """
    Parses labels

    Expected format:
    label 1 eng/label 1 local
    label 2 eng/label 2 local
    ...
    label N eng/label N local
    """
    return [tuple(re.split(r'\s*/\s*', x.strip())) for x in re.split(r'\r?\n', data)]


def parse_labels_file(f):
    """
    Parses "labels" data file and returns parsed sections.
    General format:

    [featured corp. section]

    [internal corp. section]

    [labels and translations section]

    [corpora-labels assignments section]

    Returns:
    a 4-tuple (featured, internal, labels, assignments)
    """
    data = filter(lambda x2: bool(x2), [x.strip().decode('utf-8')
                                        for x in re.split(r'\r?\n\r?\n', f.read())])
    featured = parse_featured(data[0])
    internal = parse_internal(data[1])
    labels = parse_translations(data[2])
    assignments = parse_keywords(data[3])
    return featured, internal, labels, assignments


def mk_label_ident(label_eng):
    """
    Transforms english label name into an internal identifier
    """
    return label_eng.lower().replace(' ', '_').replace('-', '_')


def attach_corpus_keywords(corpus_elm, data):
    """
    Adds defined labels to a provided 'corpus' element.
    """
    meta = corpus_elm.find('metadata')
    if meta is None:
        meta = etree.SubElement(corpus_elm, 'metadata')
    keywords = meta.find('keywords')
    if keywords is None:
        keywords = etree.SubElement(meta, 'keywords')
    for k in keywords:
        keywords.remove(k)
    for d in data:
        k = etree.SubElement(keywords, 'item')
        k.text = mk_label_ident(d)


def get_and_fix_corpora(root, data, internal_corpora):
    """
    Loads current corpora and fixes all the required issues

    arguments:
    root -- corplist XML document root
    data -- labels assignments
    internal_corpora -- a list of internal corpora

    returns:
    a list of fixed 'corpus' elements
    """
    corps = []
    for item in root.findall('//corpus'):
        corpus_id = item.attrib['ident']
        attach_corpus_keywords(item, data[corpus_id.lower()])
        if corpus_id.lower() in internal_corpora:
            item.attrib['internal'] = '1'
        corps.append(item)
    return corps


def rewrite_corplist(root, keywords, corpora):
    """
    Removes the current 'corplist' contents and writes
    a new one.
    """
    corplist = root.find('/corplist')
    corplist.clear()

    keywords_elm = etree.SubElement(corplist, 'keywords')
    for k in keywords:
        keywords_elm.append(k)
        k.tail = '\n'

    corpora_elm = etree.SubElement(corplist, 'corplist')
    for c in corpora:
        corpora_elm.append(c)


def get_keywords_defs(labels, lang1, lang2):
    """
    <keyword ident="syn_series">
    <label lang="cs">cs_label</label>
    <label lang="en">SYN series</label>
    </keyword>
    """
    translations2 = dict([(mk_label_ident(x), (x, y)) for x, y in labels])
    keywords = []

    for ident, tr in translations2.items():
        keyword = etree.Element('keyword')
        keyword.attrib['ident'] = ident
        lab = etree.SubElement(keyword, 'label')
        lab.attrib['lang'] = lang1
        lab.text = tr[0]
        lab = etree.SubElement(keyword, 'label')
        lab.attrib['lang'] = lang2
        lab.text = tr[1]
        keywords.append(keyword)
    return keywords


if __name__ == '__main__':
    argparser = argparse.ArgumentParser(description='Converts KonText corplist.xml version 0.6.x '
                                                    'to the version 0.7')
    argparser.add_argument('conf_file', metavar='CONF_FILE',
                           help='an XML file containing corpora defs')
    argparser.add_argument('labels_file', metavar='LABELS_FILE',
                           help='a file containing labels definitions and assignments')
    argparser.add_argument('-p', '--print', action='store_const', const=True,
                           help='Print result instead of writing it to a file')
    args = argparser.parse_args()

    LANG_1 = 'en'
    LANG_2 = 'cs'

    with open(args.labels_file, 'rb') as f:
        featured, internal, keywords, assignments = parse_labels_file(f)

    xml = etree.parse(args.conf_file)
    keywords = get_keywords_defs(keywords, LANG_1, LANG_2)
    corpora = get_and_fix_corpora(xml, assignments, internal)
    rewrite_corplist(xml, keywords, corpora)

    result_xml = etree.tostring(xml, encoding='utf-8', pretty_print=True)
    if getattr(args, 'print'):
        print(result_xml)
    else:
        output_path = '%s.new.xml' % args.conf_file.rsplit('.', 1)[0]
        with open(output_path, 'wb') as f:
            f.write(result_xml)
            print('DONE!\nConverted config written to %s\n' % output_path)

