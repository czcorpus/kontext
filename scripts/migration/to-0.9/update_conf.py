from lxml import etree
import sys
import os


def remove_element(elm):
    elm.getparent().remove(elm)


def update_1(doc):
    """
    transform:
    [corpora][conc_calc_backend conf="..."]...
    into:
    [global][calc_backend conf="..."]...
    """
    src_elm = doc.find('corpora/conc_calc_backend')
    dst_elm = doc.find('global')
    if src_elm is not None and dst_elm is not None:
        print((src_elm.attrib['conf']))
        new_elm = etree.SubElement(dst_elm, 'calc_backend')
        new_elm.attrib['conf'] = src_elm.attrib['conf']
        new_elm.text = src_elm.text
        remove_element(src_elm)
    else:
        raise Exception('problem finding "corpora/conc_calc_backend" or "global" elements')


def update_2(doc):
    """
    add global/action_path_prefix
    add global/static_files_prefix
    """
    global_elm = doc.find('global')
    elm = etree.SubElement(global_elm, 'action_path_prefix')
    elm.tail = '\n'
    elm = etree.SubElement(global_elm, 'static_files_prefix')
    elm.text = '/files'
    elm.tail = '\n'


def update_3(doc):
    """
    add corpora/freqs_cache_ttl
    add corpora/freqs_cache_min_lines
    add corpora/colls_cache_dir
    add corpora/colls_cache_ttl
    add corpora/colls_cache_min_lines
    """
    freqs_cache_dir_elm = doc.find('corpora/freqs_cache_dir')
    corp_elm = freqs_cache_dir_elm.getparent()

    pos = corp_elm.index(freqs_cache_dir_elm)
    new_elm = etree.Element('freqs_cache_ttl')
    new_elm.text = '3600'
    new_elm.tail = '\n'
    corp_elm.insert(pos + 1, new_elm)

    pos = corp_elm.index(new_elm)
    new_elm = etree.Element('freqs_cache_min_lines')
    new_elm.text = '100'
    new_elm.tail = '\n'
    corp_elm.insert(pos + 1, new_elm)

    pos = corp_elm.index(new_elm)
    cache_path = os.path.join(os.path.dirname(freqs_cache_dir_elm.text), 'colls-cache')
    print(('\n>>> Please create a directory [%s]\n' % (cache_path,)))
    new_elm = etree.Element('colls_cache_dir')
    new_elm.text = cache_path
    new_elm.tail = '\n'
    corp_elm.insert(pos + 1, new_elm)

    pos = corp_elm.index(new_elm)
    new_elm = etree.Element('colls_cache_ttl')
    new_elm.text = '3600'
    new_elm.tail = '\n'
    corp_elm.insert(pos + 1, new_elm)

    pos = corp_elm.index(new_elm)
    new_elm = etree.Element('colls_cache_min_lines')
    new_elm.text = '50'
    new_elm.tail = '\n'
    corp_elm.insert(pos + 1, new_elm)


def update_4(doc):
    srch = doc.find('/corpora/use_db_whitelist')
    if srch is not None:
        srch.getparent().remove(srch)


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


if __name__ == '__main__':
    import argparse
    argparser = argparse.ArgumentParser(description='Converts KonText config.xml version 0.8.x '
                                                    'to the version 0.9')
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
