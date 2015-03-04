#!/usr/bin/env python
"""
A migration script for config.xml from versions 0.6.x to the version 0.7.0
"""

import argparse

from lxml import etree


def _get_path_titles(corplist_elm):
    ans = {}
    for item in corplist_elm.findall('./title'):
        ans[item.attrib['lang']] = item.text.strip()
    if len(ans) > 0:
        k = ans['en'].lower().replace(' ', '_')
    elif 'title' in corplist_elm.attrib:
        k = corplist_elm.attrib['title'].lower()
    else:
        k = '/'
    return k, ans


def _add_labels(corplist_elm, labels):
    metadata = corplist_elm.find('./metadata')
    if metadata is None:
        metadata = etree.SubElement(corplist_elm, 'metadata')
    keywords = metadata.find('./keywords')
    if keywords is None:
        keywords = etree.SubElement(metadata, 'keywords')

    for item, label in labels.items():
        item_elm = etree.SubElement(keywords, 'item')
        item_elm.text = item


def _parse_corplist(corplist_elm, labeldb, curr_path):
    path_k, path_titles = _get_path_titles(corplist_elm)
    if path_k not in labeldb:
        labeldb[path_k] = path_titles

    curr_path = curr_path[:]
    curr_path.append(path_k)

    labels = [x for x in curr_path if x]
    ans = dict([(k, labeldb[k]) for k in labels])

    for item in corplist_elm:
        if item.tag == 'corplist':
            _parse_corplist(item, labeldb, curr_path)
        elif item.tag == 'corpus':
            _add_labels(item, ans)


def _create_keyword_db(labeldb, root_elm):
    keywords_elm = etree.Element('keywords')
    root_elm.insert(0, keywords_elm)
    for key, labels in labeldb.items():
        if key:
            keyword_elm = etree.SubElement(keywords_elm, 'keyword')
            keyword_elm.attrib['ident'] = key
            for lang, label in labels.items():
                label_elm = etree.SubElement(keyword_elm, 'label')
                label_elm.attrib['lang'] = lang
                label_elm.text = label


def fill_in_tags(xml, omit_ucnk):
    corplist = xml.find('//corplist')
    curr_path = []
    labeldb = {}
    if corplist is not None:
        _parse_corplist(corplist, labeldb, curr_path)
        _create_keyword_db(labeldb, corplist)
    else:
        raise Exception('Failed to find root corplist elm')


if __name__ == '__main__':
    argparser = argparse.ArgumentParser(description="Converts KonText config.xml version 0.5.x to the version 0.6")
    argparser.add_argument('conf_file', metavar="FILE", help="an XML configuration file")
    argparser.add_argument('-p', '--print', action='store_const', const=True,
                           help='Print result instead of writing it to a file')
    argparser.add_argument('-m', '--omit-ucnk', action='store_const', const=True,
                           help='Omit updates specific to the Institute of the Czech Nat. Corpus')
    args = argparser.parse_args()

    xml = etree.parse(args.conf_file)
    update_actions = (
        fill_in_tags,
    )
    for up in update_actions:
        apply(up, (xml, args.omit_ucnk))
    result_xml = etree.tostring(xml, encoding='utf-8', pretty_print=True)
    if getattr(args, 'print'):
        print(result_xml)
    else:
        output_path = '%s.new' % args.conf_file
        with open(output_path, 'wb') as f:
            f.write(result_xml)
            print('DONE!\nConverted config written to %s\n' % output_path)

