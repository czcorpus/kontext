from lxml import etree
import sys
import json
import os
import codecs


def process_document(xml_doc, single_upd=None):
    def func_name(j): return 'update_%d' % j

    if single_upd is not None:
        fn = getattr(sys.modules[__name__], func_name(single_upd))
        if callable(fn):
            fn(xml_doc)
        else:
            raise Exception('ERROR: update %s not found' % single_upd)
    else:
        i = 1
        while func_name(i) in dir(sys.modules[__name__]):
            fn = getattr(sys.modules[__name__], func_name(i))
            if callable(fn):
                fn(xml_doc)
            i += 1


def update_1(doc):
    qh = doc.find('/plugins/query_storage')
    if qh is not None:
        qh.tag = 'query_history'

    srch = qh.find('module')
    if srch is not None and srch.text == 'default_query_storage':
        srch.text = 'default_query_history'

    srch = qh.find('js_module')
    if srch is not None and srch.text == 'defaultQueryStorage':
        srch.text = 'defaultQueryHistory'


if __name__ == '__main__':
    import argparse
    argparser = argparse.ArgumentParser(description='Upgrade KonText config.xml version 0.15.x '
                                                    'to the version 0.16')
    argparser.add_argument('conf_file', metavar='CONF_FILE',
                           help='an XML configuration file')
    argparser.add_argument('-u', '--update', type=int,
                           help='Perform a single update (identified by a number)')
    argparser.add_argument('-p', '--print', action='store_const', const=True,
                           help='Print result instead of writing it to a file')
    args = argparser.parse_args()

    doc = etree.parse(args.conf_file)
    process_document(doc, getattr(args, 'update'))

    result_xml = etree.tostring(doc, encoding='utf-8', pretty_print=True)
    if getattr(args, 'print'):
        print(result_xml)
    else:
        output_path = '%s.new.xml' % args.conf_file.rsplit('.', 1)[0]
        with open(output_path, 'wb') as f:
            f.write(result_xml)
            print(('DONE!\nConverted config written to %s\n' % output_path))
    print('\nPlease do not forget to update subcorpora paths by running updsubc.py!\n')
    print('\nPlease do not forget to update user_index by running upd_user_index.py!\n')
