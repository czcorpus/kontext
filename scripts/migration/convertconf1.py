#!/usr/bin/env python
"""
A migration script for config.xml from versions 0.5.x to the version 0.6.0
"""

import argparse

from lxml import etree

MAIN_TAGSET = 'pp_tagset'
MAIN_TAGSET_NUM_POS = 16


def rename_attrib(elm, old_name, new_name):
    v = elm.attrib[old_name]
    del elm.attrib[old_name]
    elm.attrib[new_name] = v


def mark_as_extension(elm):
    elm.attrib['extension-by'] = 'ucnk'


def update_db_plugin(xml, omit_ucnk):
    """
    <pool_recycle extension-by="ucnk">30</pool_recycle>
    <pool_size extension-by="ucnk">10</pool_size>
    <max_overflow extension-by="ucnk">20</max_overflow>
    """
    if not omit_ucnk:
        root_elm = xml.xpath('//plugins/db')[0]
        module_elm = root_elm.find('module')
        module_elm.text = 'ucnk_pooled_db'

        pr_elm = etree.Element('pool_recycle')
        mark_as_extension(pr_elm)
        pr_elm.text = '30'
        root_elm.append(pr_elm)

        ps_elm = etree.Element('pool_size')
        mark_as_extension(ps_elm)
        ps_elm.text = '10'
        root_elm.append(ps_elm)

        mo_elm = etree.Element('max_overflow')
        mark_as_extension(mo_elm)
        mo_elm.text = '20'
        root_elm.append(mo_elm)


def update_query_storage_plugin(xml, omit_ucnk):
    """
    <module>ucnk_query_storage</module>
    <js_module>ucnkQueryStorage</js_module>
    <page_num_records extension-by="ucnk">10</page_num_records>
    <page_append_records extension-by="ucnk">5</page_append_records>
    <num_kept_records extension-by="ucnk">100</num_kept_records>
    """
    if not omit_ucnk:
        root_elm = xml.xpath('//plugins/query_storage')[0]

        jm_elm = etree.Element('js_module')
        jm_elm.text = 'ucnkQueryStorage'
        root_elm.append(jm_elm)

        pnr_elm = etree.Element('page_num_records')
        mark_as_extension(pnr_elm)
        pnr_elm.text = '10'
        root_elm.append(pnr_elm)

        par_elm = etree.Element('page_append_records')
        mark_as_extension(par_elm)
        par_elm.text = '5'
        root_elm.append(par_elm)

        nkr_elm = root_elm.find('num_kept_records')
        if nkr_elm is None:
            nkr_elm = etree.Element('num_kept_records')
            root_elm.append(nkr_elm)
        mark_as_extension(nkr_elm)
        nkr_elm.text = '100'


def conc_persistence_plugin(xml, omit_ucnk):
    """
    <conc_persistence>
    <module>ucnk_conc_persistence</module>
    </conc_persistence>
    """
    root_elm = xml.xpath('//plugins')[0]
    plugin_elm = etree.Element('conc_persistence')
    m_elm = etree.Element('module')
    if not omit_ucnk:
        m_elm.text = 'ucnk_conc_persistence'
    else:
        m_elm.text = '[insert your implementation here]'
        print('\n======================== important note =======================')
        print('A new optional plugin "conc_persistence" is in the version 0.6.\n'
              'If you do not have a suitable implementation available yet then \n'
              'please comment-out or remove <conc_persistence> element.')
        print('===============================================================\n')
    plugin_elm.append(m_elm)
    root_elm.append(plugin_elm)


def update_corptree(xml, omit_ucnk):
    for corpus in xml.xpath('//corplist/corpus'):
        rename_attrib(corpus, 'id', 'ident')
        if 'num_tag_pos' in corpus.attrib:
            if corpus.attrib['num_tag_pos'] == str(MAIN_TAGSET_NUM_POS):
                corpus.attrib['tagset'] = MAIN_TAGSET
            del corpus.attrib['num_tag_pos']


def update_tagspec(xml, omit_ucnk):
    for value in xml.xpath('//tagset/value'):
        rename_attrib(value, 'id', 'ident')

    tagsets_elm = xml.xpath('//tagsets')[0]
    old_tagset_list = []
    for tagset in xml.xpath('//tagset'):
        old_tagset_list.append(tagset)
        tagsets_elm.remove(tagset)

    new_tagset_elm = etree.Element('tagset')
    new_tagset_elm.attrib['ident'] = MAIN_TAGSET
    new_tagset_elm.attrib['num_pos'] = str(MAIN_TAGSET_NUM_POS)
    tagsets_elm.append(new_tagset_elm)

    for item in old_tagset_list:
        item.tag = 'position'
        rename_attrib(item, 'position', 'index')
        new_tagset_elm.append(item)


def misc(xml, omit_ucnk):
    xml.getroot().tag = 'kontext'
    global_elm = xml.find('global')

    maint_elm = etree.Element('maintenance')
    maint_elm.text = 'true'  # !!
    global_elm.append(maint_elm)

    anonymous_id_elm = etree.Element('anonymous_user_id')
    anonymous_id_elm.text = '0'
    global_elm.append(anonymous_id_elm)


def update_translations(xml, omit_ucnk):
    if not omit_ucnk:
        translat_elm = xml.find('global/translations')
        for item in translat_elm:
            if item.text == 'cs':
                item.text = 'cs_CZ'
            elif item.text == 'en':
                item.text = 'en_US'
            elif item.text == 'sk':
                item.text = 'sk_SK'


def update_logging_conf(xml, omit_ucnk):
    log_path = xml.find('global/log_path')
    global_elm = log_path.getparent()

    new_elm = etree.Element('log_file_size')
    if not omit_ucnk:
        new_elm.text = '10000000'
    global_elm.insert(global_elm.index(log_path) + 1, new_elm)

    new_elm = etree.Element('log_num_files')
    if not omit_ucnk:
        new_elm.text = '100'
    global_elm.insert(global_elm.index(log_path) + 2, new_elm)

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
        misc,
        update_db_plugin,
        update_query_storage_plugin,
        conc_persistence_plugin,
        update_corptree,
        update_tagspec,
        update_logging_conf,
        update_translations
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

