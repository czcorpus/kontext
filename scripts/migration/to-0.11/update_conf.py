from lxml import etree
import sys


def process_document(xml_doc, single_upd=None):
    func_name = lambda j: 'update_%d' % j

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
    srch = doc.find('/corpora/calc_pid_dir')
    if srch is not None:
        srch.getparent().remove(srch)


def update_2(doc):
    srch = doc.find('/plugins/query_storage/js_module')
    if srch is not None and srch.text == 'ucnkQueryStorage':
        srch.text = 'defaultQueryStorage'


def update_3(doc):
    srch = doc.find('/plugins/db/module')
    if srch is not None and srch.text == 'default_db':
        srch.text = 'sqlite3_db'


def update_4(doc):
    srch = doc.findall('/global/error_report_params/param')
    for item in srch:
        if item.text == '@_get_current_url':
            item.text = '@get_current_url'


def update_5(doc):
    srch = doc.find('/plugins')
    new_elm = etree.SubElement(srch, 'chart_export')
    new_elm.tail = '\n      '
    new_elm.text = '\n            '
    mod_elm = etree.SubElement(new_elm, 'module')
    mod_elm.text = 'default_chart_export'
    mod_elm.tail = '\n        '


def update_6(doc):
    srch = doc.find('corpora/calc_pid_dir')
    if srch:
        srch.getparent().remove(srch)


if __name__ == '__main__':
    import argparse
    argparser = argparse.ArgumentParser(description='Upgrade KonText config.xml version 0.9.x/0.10.x '
                                                    'to the version 0.11')
    argparser.add_argument('conf_file', metavar='CONF_FILE',
                           help='an XML configuration file')
    argparser.add_argument('-u', '--update', type=int, help='Perform a single update (identified by a number)')
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
            print('DONE!\nConverted config written to %s\n' % output_path)
    print('\nPlease do not forget to update subcorpora paths by running updsubc.py!\n')
    print('\nPlease do not forget to update user_index by running upd_user_index.py!\n')
