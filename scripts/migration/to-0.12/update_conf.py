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
    """
    Redis_conc_cache is now the "default_conc_cache"
    """
    srch = doc.find('/plugins/conc_cache/module')
    if srch is not None and srch.text == 'redis_conc_cache':
        srch.text = 'default_conc_cache'


def update_2(doc):
    """
    For the 'query_storage' plug-in, remove deprecated
    attribute num_kept_record and replace it with ttl_days.
    """
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
    """
    Celery backend task time limit can be now configured
    in KonText.
    """
    srch = doc.find('/global/calc_backend')
    if srch is not None:
        parent = srch.getparent()
        new_elm = etree.Element('task_time_limit')
        new_elm.text = '300'
        new_elm.tail = '\n        '
        srch.tail = '\n        '
        parent.insert(parent.index(srch) + 1, new_elm)


def update_4(doc):
    """
    We require a new top-level section "fcs" (can be empty)
    """
    srch = doc.find('/corpora')
    if srch is not None:
        parent = srch.getparent()
        new_elm = etree.Element('fcs')
        new_elm.tail = '\n    '
        srch.tail = '\n    '
        parent.insert(parent.index(srch) + 1, new_elm)


def update_5(doc):
    """
    Thanks to the update (4) we should move fcs-related
    existing config 'fcs_search_attributes' to the new
    'fcs' section.
    """
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


def update_6(doc):
    """
    For the 'settings_storage' plug-in, if there is
    'excluded_users' then we add the 'extension-by'
    attribute.
    """
    srch = doc.find('plugins/settings_storage')
    srch2 = srch.find('module')
    if srch2.text == 'default_settings_storage':
        srch3 = srch.find('excluded_users')
        if srch3 is not None:
            srch3.attrib['extension-by'] = 'default'


def update_7(doc):
    """
    For the 'get_lang' plug-in, fallback_lang values
    should be now properly formatted
    (en_US --> en-US etc.)
    """
    srch = doc.find('plugins/getlang/fallback_lang')
    if srch is not None:
        srch.text = srch.text.replace('_', '-')


def update_8(doc):
    """
    Move 'max_num_favorites' from the 'corparch' plug-in
    to the 'user_items' plug-in.
    """
    srch = doc.find('plugins/corparch/max_num_favorites')
    if srch is not None:
        srch.getparent().remove(srch)
    srch2 = doc.find('plugins/user_items')
    if srch2 is not None:
        new_elm = etree.SubElement(srch2, 'max_num_favorites')
        new_elm.attrib['extension-by'] = 'default'
        new_elm.tail = '\n        '


def update_9(doc):
    """
    For the 'corparch' plug-in (but only the 'default_corparch'
    version) add extension-by=default to 'file' and 'root_elm_path'.
    """
    srch = doc.find('plugins/corparch')
    srch2 = srch.find('module')
    if srch2.text == 'default_corparch':
        srch3 = srch.find('file')
        if srch3 is not None:
            srch3.attrib['extension-by'] = 'default'
        srch4 = srch.find('root_elm_path')
        if srch4 is not None:
            srch4.attrib['extension-by'] = 'default'


def update_10(doc):
    """
    Create a new top-level configuration
    for calculation backend
    """
    glb_srch = doc.find('/global')
    root = glb_srch.getparent()
    ce = etree.Element('calc_backend')
    ce.tail = '\n    '
    glb_srch.tail = '\n    '
    root.insert(root.index(glb_srch) + 1, ce)

    cb_srch = doc.find('global/calc_backend')
    if cb_srch is not None:
        type_elm = etree.SubElement(ce, 'type')
        type_elm.text = cb_srch.text
        conf_elm = etree.SubElement(ce, 'conf')
        conf_elm.text = cb_srch.attrib.get('conf')
        cb_srch.getparent().remove(cb_srch)
        etree.SubElement(ce, 'status_service_url')
    cbt_srch = doc.find('global/calc_backend_time_limit')
    if cbt_srch is not None:
        cbt_new = etree.SubElement(ce, 'task_time_limit')
        cbt_new.text = cbt_srch.text
        cbt_srch.getparent().remove(cbt_srch)
    else:
        cbt_new = etree.SubElement(ce, 'task_time_limit')
        cbt_new.text = '300'

    glb_srch = doc.find('/calc_backend')
    root = glb_srch.getparent()
    js = etree.Element('job_scheduler')
    js.tail = '\n    '
    glb_srch.tail = '\n    '
    root.insert(root.index(glb_srch) + 1, js)

    pt_srch = doc.find('global/periodic_tasks')
    if pt_srch is not None:
        pt_new = etree.SubElement(js, 'type')
        pt_new.text = pt_srch.text
        pt_conf_new = etree.SubElement(js, 'conf')
        pt_conf_new.text = pt_srch.attrib.get('conf')
        pt_srch.getparent().remove(pt_srch)


def update_11(doc):
    srch = doc.find('/global')
    elm = etree.SubElement(srch, 'conc_dashboard_modules')
    elm2 = etree.SubElement(elm, 'item')
    elm2.text = 'freqs'
    elm.tail = '\n        '


def update_12(doc):
    srch = doc.findall('/global/translations/language')
    for item in srch:
        item.text = item.text.replace('_', '-')


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
            print(('DONE!\nConverted config written to %s\n' % output_path))
