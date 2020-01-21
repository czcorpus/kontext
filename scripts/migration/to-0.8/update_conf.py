
from lxml import etree
import sys


ANONYMOUS_USER = 4230


def remove_element(elm):
    elm.getparent().remove(elm)


def update_1(doc):
    """
    history_max_query_size
    """
    x = doc.find('/global/history_max_query_size')
    y = doc.find('/plugins/query_storage')
    if x is not None:
        old_val = x.text
        remove_element(x)
    else:
        print('Max query size for history listing not set, setting to 100')
        old_val = str(100)

    if y is not None:
        elm = etree.Element('history_max_query_size')
        elm.text = old_val
        y.insert(1, elm)
        elm.tail = '\n' + (12 * ' ')
    else:
        print('Plug-in [query_storage] not defined!')


def update_2(doc):
    """
    anonymous_user_id
    """
    x = doc.find('/global/anonymous_user_id')
    y = doc.find('/plugins/auth')
    if x is not None:
        old_val = x.text
        remove_element(x)
    else:
        old_val = str(ANONYMOUS_USER)
        print('Anonymous user ID not set, setting default value %s' % ANONYMOUS_USER)

    if y is not None:
        elm = etree.Element('anonymous_user_id')
        elm.text = old_val
        y.insert(1, elm)
        elm.tail = '\n' + (12 * ' ')
    else:
        print('Plug-in [auth] not defined!')


def update_3(doc):
    """
    administrators
    """
    x = doc.find('/global/administrators')
    y = doc.find('/plugins/auth')

    if x is not None:
        if y is not None:
            y.append(x)
        else:
            remove_element(x)


def update_4(doc):
    """
    conc_persistence_time
    """
    x = doc.find('/global/conc_persistence_time')
    if x is not None:
        remove_element(x)


def update_5(doc):
    x = doc.find('/external_links')
    if x is not None:
        remove_element(x)


def update_6(doc):
    x = doc.find('/global/cache')
    if x is not None:
        remove_element(x)


def update_7(doc):
    x = doc.find('/corpora/helpsite')
    if x is not None:
        remove_element(x)


def update_8(doc):
    x = doc.find('/corpora/kwicline_max_context')
    if x is not None:
        remove_element(x)


def update_9(doc):
    x = doc.find('/corpora/cache_dir')
    y = doc.find('/plugins/conc_cache/cache_dir')
    if x is not None:
        if y is not None:
            print('removing /corpora/cache_dir (%s) in favor of /plugins/conc/cache_dir (%s)' %
                  (x.text, y.text))
            remove_element(x)
        else:
            print('moving /corpora/cache_dir (%s) to /plugins/conc/cache_dir' % (x.text,))
            z = doc.find('/plugins/conc_cache')
            if z is not None:
                z.append(x)
                x.attrib['extension-by'] = 'default'
            else:
                print('Failed to find [conc_cache] configuration. Please create one.')


def update_10(doc):
    x = doc.find('/corpora/subcpath')
    if x is not None:
        remove_element(x)


def update_11(doc):

    x = etree.SubElement(doc.getroot(), 'logging')
    e1 = doc.find('/global/log_path')
    if e1 is not None:
        tmp = etree.SubElement(x, 'path')
        tmp.text = e1.text
    e2 = doc.find('/global/log_file_size')
    if e2 is not None:
        tmp = etree.SubElement(x, 'file_size')
        tmp.text = e2.text
    e3 = doc.find('/global/log_num_files')
    if e2 is not None:
        tmp = etree.SubElement(x, 'num_files')
        tmp.text = e3.text
    e4 = doc.find('/global/logged_values')
    if e4 is not None:
        x.append(e4)
        e4.tag = 'values'


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
    argparser = argparse.ArgumentParser(description='Converts KonText config.xml version 0.7.x '
                                                    'to the version 0.8')
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
