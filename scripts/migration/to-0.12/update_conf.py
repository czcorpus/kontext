from lxml import etree
import sys


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
    srch = doc.find('/plugins/conc_cache/module')
    if srch is not None and srch.text == 'redis_conc_cache':
        srch.text = 'default_conc_cache'


def update_2(doc):
    srch = doc.find('/plugins/query_storage/num_kept_records')
    if srch is not None:
        srch.getparent().remove(srch)

    # <ttl_days extension-by="default">10</ttl_days>
    srch = doc.find('/plugins/query_storage/ttl_days')
    if srch is None:
        srch = doc.find('/plugins/query_storage')
        new_elm = etree.SubElement(srch, 'ttl_days')
        new_elm.attrib['extension-by'] = 'default'
        new_elm.text = '7'
        new_elm.tail = '\n      '


def update_3(doc):
    srch = doc.find('/global/calc_backend')
    if srch is not None:
        parent = srch.getparent()
        new_elm = etree.Element('calc_backend_time_limit')
        new_elm.text = '300'
        new_elm.tail = '\n        '
        srch.tail = '\n        '
        parent.insert(parent.index(srch) + 1, new_elm)


def update_4(doc):
    srch = doc.find('/corpora')
    if srch is not None:
        parent = srch.getparent()
        new_elm = etree.Element('fcs')
        new_elm.tail = '\n    '
        srch.tail = '\n    '
        parent.insert(parent.index(srch) + 1, new_elm)


def update_5(doc):
    srch2 = doc.find('/fcs')
    srch2.tail = '\n    '
    new_elm = etree.SubElement(srch2, 'search_attributes')
    new_elm.tail = '\n    '
    srch = doc.findall('/corpora/fcs_search_attributes/item')
    for item in srch:
        new_item = etree.SubElement(new_elm, 'item')
        new_item.text = item.text
        new_item.tail = '\n            '

    rm_srch = doc.find('/corpora/fcs_search_attributes')
    if rm_srch is not None:
        rm_srch.getparent().remove(rm_srch)


if __name__ == '__main__':
    import argparse
    argparser = argparse.ArgumentParser(description='Upgrade KonText config.xml version 0.11.x '
                                                    'to the version 0.12')
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
            print('DONE!\nConverted config written to %s\n' % output_path)
