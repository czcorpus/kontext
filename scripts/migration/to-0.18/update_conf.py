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
    srch = doc.find('/plugins/auth/js_module')
    if srch is not None and srch.text == 'defaultAuth':
        srch.text = 'auth'


def update_2(doc):
    srch = doc.find('/plugins/corparch/js_module')
    if srch is not None and srch.text == 'defaultCorparch':
        srch.text = 'corparch'


def update_3(doc):
    srch = doc.find('/plugins/syntax_viewer/js_module')
    if srch is not None and srch.text == 'defaultSyntaxViewer':
        srch.text = 'syntaxViewer'


def update_4(doc):
    srch = doc.find('/plugins/footer_bar/js_module')
    if srch is not None and srch.text == 'defaultFooterBar':
        srch.text = 'footerBar'


def update_5(doc):
    srch = doc.find('/plugins/issue_reporting/js_module')
    if srch is not None and srch.text == 'defaultIssueReporting':
        srch.text = 'issueReporting'


def update_6(doc):
    srch = doc.find('/plugins/kwic_connect/js_module')
    if srch is not None and srch.text == 'defaultKwicConnect':
        srch.text = 'kwicConnect'


def update_7(doc):
    srch = doc.find('/plugins/live_attributes/js_module')
    if srch is not None and srch.text == 'mysqlLiveAttributes':
        srch.text = 'liveAttributes'


def update_8(doc):
    srch = doc.find('/plugins/query_suggest/js_module')
    if srch is not None and srch.text == 'defaultQuerySuggest':
        srch.text = 'querySuggest'


def update_9(doc):
    srch = doc.find('/plugins/subcmixer/js_module')
    if srch is not None and srch.text == 'defaultSubcmixer':
        srch.text = 'subcmixer'


def update_10(doc):
    srch = doc.find('/plugins/syntax_viewer/js_module')
    if srch is not None and srch.text == 'defaultSyntaxViewer':
        srch.text = 'syntaxViewer'


def update_11(doc):
    srch = doc.find('/plugins/taghelper/js_module')
    if srch is not None and srch.text == 'defaultTaghelper':
        srch.text = 'taghelper'


def update_12(doc):
    srch = doc.find('/plugins/token_connect/js_module')
    if srch is not None and srch.text == 'defaultTokenConnect':
        srch.text = 'tokenConnect'


if __name__ == '__main__':
    import argparse
    argparser = argparse.ArgumentParser(description='Upgrade KonText config.xml version 0.16.x '
                                                    'to the version 0.17')
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
        output_path = '{}.new.xml'.format(args.conf_file.rsplit('.', 1)[0])
        with open(output_path, 'wb') as f:
            f.write(result_xml)
            print(('DONE!\nConverted config written to %s\n' % output_path))
