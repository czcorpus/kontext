from __future__ import print_function
from lxml import etree
import sys

APP_URL = 'https://kontext.korpus.cz/'
ANONYMOUS_USER = 4230


def remove_element(elm):
    elm.getparent().remove(elm)


def update_1(doc):
    """
    1) theme:
    <theme>
            <name>default</name>
            <logo>kontext-logo.png</logo>
            <logo_mouseover>kontext-logo_s.png</logo_mouseover>
            <logo_href>http://kontext.korpus.test/first_form</logo_href>
            <logo_style>width: 208px;height: 68px</logo_style>
            <fonts>
                <item>https://fonts.googleapis.com/css?family=Cousine:400|Roboto:300,400,400italic,700,700italic|Roboto+Condensed:400,700&amp;subset=latin,latin-ext</item>
            </fonts>
            <css>style.css</css>
        </theme>
    """
    theme_elm = etree.Element('theme')

    tmp = etree.SubElement(theme_elm, 'logo')
    tmp.text = 'kontext-kogo.png'

    tmp = etree.SubElement(theme_elm, 'logo_mouseover')
    tmp.text = 'kontext-logo_s.png'

    tmp = etree.SubElement(theme_elm, 'logo_href')
    tmp.text = '%sfirst_form' % APP_URL

    tmp = etree.SubElement(theme_elm, 'logo_style')
    tmp.text = 'width: 208px;height: 68px'

    tmp = etree.SubElement(theme_elm, 'fonts')
    tmp = etree.SubElement(tmp, 'item')
    tmp.text = 'https://fonts.googleapis.com/css?family=Cousine:400|Roboto:300,400,400italic,700,700italic|Roboto+Condensed:400,700&amp;subset=latin,latin-ext'

    doc.getroot().insert(0, theme_elm)


def update_2(doc):
    """
    2) global

    <error_report_params>
      <param name="query_url">@_get_current_url</param>
      <param name="page_id">pageid</param>
      <param name="app_id">kontext_A2</param>
    </error_report_params>
    """
    erp_elm = etree.Element('error_report_params')

    tmp = etree.SubElement(erp_elm, 'param')
    tmp.attrib['name'] = 'query_url'
    tmp.text = '@_get_current_url'

    tmp = etree.SubElement(erp_elm, 'param')
    tmp.attrib['name'] = 'page_id'
    tmp.text = 'pageid'

    tmp = etree.SubElement(erp_elm, 'param')
    tmp.attrib['name'] = 'app_id'
    tmp.text = 'kontext_A2'

    doc.find('global').append(erp_elm)


def update_3(doc):
    """
    3) global

    <shared_subcorp_path>/foo/bar</shared_subcorp_path>
    """
    ssp_elm = etree.Element('shared_subcorp_path')
    ssp_elm.text = '/opt/kontext-data/subcorp_distrib'
    doc.find('global').append(ssp_elm)


def update_4(doc):
    """
    4) global

    <ui_state_ttl>86400</ui_state_ttl>
    """
    uist_elm = etree.Element('ui_state_ttl')
    uist_elm.text = '86400'
    uist_elm.tail = '\n'
    doc.find('global').append(uist_elm)


def update_5(doc):
    """
    5) global

    <logged_values>
        <item>environ:REMOTE_ADDR</item>
        <item>environ:HTTP_USER_AGENT</item>
        <item>date</item>
        <item>user_id</item>
        <item>action</item>
        <item>params</item>
        <item>proc_time</item>
    </logged_values>
    """
    lv_elm = etree.Element('logged_values')
    for item in ['environ:REMOTE_ADDR', 'environ:HTTP_USER_AGENT', 'date', 'user_id', 'action',
                 'paramsxxx', 'proc_time']:
        tmp = etree.SubElement(lv_elm, 'item')
        tmp.text = item
    doc.find('global').append(lv_elm)


def update_6(doc):
    """
    6) global

    <upload_cache_dir>/tmp/kontext-upload</upload_cache_dir>
    """
    ucd_elm = etree.Element('upload_cache_dir')
    ucd_elm.text = '/tmp/kontext-upload'
    ucd_elm.tail = '\n'
    doc.find('global').append(ucd_elm)


def update_7(doc):
    """
    7) plugins (overwrite)

    <locking>
        <module>redis_locking</module>
        <ttl extension-by="default">20</ttl>
        <num_attempts extension-by="default">10</num_attempts>
    </locking>
    """
    locking_elm = doc.find('plugins/locking')
    locking_elm.clear()

    tmp = etree.SubElement(locking_elm, 'module')
    tmp.text = 'redis_locking'
    tmp.tail = '\n'

    tmp = etree.SubElement(locking_elm, 'ttl')
    tmp.attrib['extension-by'] = "default"
    tmp.text = '20'
    tmp.tail = '\n'

    tmp = etree.SubElement(locking_elm, 'num_attempts')
    tmp.attrib['extension-by'] = "default"
    tmp.text = '10'
    tmp.tail = '\n'


def update_8(doc):
    """
    8) plugins (overwrite)

    <settings_storage>
        <module>default_settings_storage</module>
        <excluded_users>
            <item>0</item>
        </excluded_users>
    </settings_storage>
    """
    ss_elm = doc.find('plugins/settings_storage')
    ss_elm.clear()

    tmp = etree.SubElement(ss_elm, 'module')
    tmp.text = 'default_settings_storage'
    tmp.tail = '\n'

    tmp = etree.SubElement(ss_elm, 'excluded_users')
    tmp = etree.SubElement(tmp, 'item')
    tmp.text = str(ANONYMOUS_USER)


def update_9(doc):
    """
    9) plugins corptree --> corparch

    orig:
    <corptree>
        <module>corptree</module>
        <file>/opt/noske/share/kontext/corpora.xml</file>
        <root_elm_path>/corplist</root_elm_path>
        <cache_path extension-by="ucnk">/opt/bonito2-data/cache/corptree-%s.pkl</cache_path>
    </corptree>

    new:
    <corparch>
        <module>ucnk_corparch</module>
        <js_module>ucnkCorparch</js_module>
        <file>/home/tomas/work/kontext.dev/conf/corplist.xml</file>
        <root_elm_path>/corplist</root_elm_path>
        <tag_prefix extension-by="default">+</tag_prefix>
        <max_num_hints extension-by="default">2</max_num_hints>
        <default_page_list_size extension-by="default">5</default_page_list_size>
        <access_req_smtp_server extension-by="ucnk">trnka.korpus.cz</access_req_smtp_server>
        <access_req_sender extension-by="ucnk">kontext@korpus.cz</access_req_sender>
        <access_req_recipients extension-by="ucnk">
            <item>tomas.machalek@gmail.com</item>
        </access_req_recipients>
    </corparch>
    """
    corplist_file = doc.find('plugins/corptree/file').text
    root_elm_path = doc.find('plugins/corptree/root_elm_path').text
    #cache_path = doc.find('plugins/corptree/cache_path').text

    remove_element(doc.find('plugins/corptree'))

    ca_elm = etree.Element('corparch')

    tmp = etree.SubElement(ca_elm, 'module')
    tmp.text = 'ucnk_corparch'
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'js_module')
    tmp.text = 'ucnkCorparch'
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'file')
    tmp.text = corplist_file
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'root_elm_path')
    tmp.text = root_elm_path
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'tag_prefix')
    tmp.attrib['extension-by'] = 'default'
    tmp.text = '+'
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'max_num_hints')
    tmp.attrib['extension-by'] = 'default'
    tmp.text = '20'
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'default_page_list_size')
    tmp.attrib['extension-by'] = 'default'
    tmp.text = '40'
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'access_req_smtp_server')
    tmp.attrib['extension-by'] = 'ucnk'
    tmp.text = 'trnka.korpus.cz'
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'access_req_sender')
    tmp.attrib['extension-by'] = 'ucnk'
    tmp.text = 'kontext@korpus.cz'
    tmp.tail = '\n'

    tmp = etree.SubElement(ca_elm, 'access_req_recipients')
    tmp.attrib['extension-by'] = 'ucnk'
    tmp.tail = '\n'
    tmp = etree.SubElement(tmp, 'item')
    tmp.text = '#TODO'

    doc.find('plugins').append(ca_elm)


def update_10(doc):
    """
    10) plugins

    <live_attributes>
        <module>ucnk_live_attributes</module>
        <js_module>ucnkLiveAttributes</js_module>
        <max_attr_visible_chars extension-by="ucnk">30</max_attr_visible_chars> [NEW!!]
    </live_attributes>
    """
    la_elm = doc.find('plugins/live_attributes')
    mavc_elm = etree.SubElement(la_elm, 'max_attr_visible_chars')
    mavc_elm.attrib['extension-by'] = 'ucnk'
    mavc_elm.text = '30'
    mavc_elm.tail = '\n'


def update_11(doc):
    """
    11) plugins

    <taghelper>
        <module>default_taghelper</module>
        <clear_interval extension-by="default">86400</clear_interval>
        <tags_cache_dir extension-by="default">/var/local/corpora/tags/cache</tags_cache_dir>
        <taglist_path extension-by="default">/home/tomas/work/kontext.dev/conf/tagsets.xml</taglist_path>
        <tags_src_dir extension-by="default">/var/local/corpora/tags/data</tags_src_dir>
    </taghelper>
    """
    t_elm = etree.Element('taghelper')

    tags_cache_dir = doc.find('/corpora/tags_cache_dir').text
    tags_src_dir = doc.find('/corpora/tags_src_dir').text

    tmp = etree.SubElement(t_elm, 'module')
    tmp.text = 'default_taghelper'

    tmp = etree.SubElement(t_elm, 'clear_interval')
    tmp.attrib['extension-by'] = 'default'
    tmp.text = '86400'
    tmp.tail = '\n'

    tmp = etree.SubElement(t_elm, 'tags_cache_dir')
    tmp.attrib['extension-by'] = 'default'
    tmp.text = tags_cache_dir
    tmp.tail = '\n'

    tmp = etree.SubElement(t_elm, 'taglist_path')
    tmp.attrib['extension-by'] = 'default'
    tmp.text = '/opt/noske/share/kontext/conf/tagsets.xml'
    tmp.tail = '\n'
    print('Do not forget to make separate tagsets.xml out of corplist.xml !!!',
          file=sys.stderr)

    tmp = etree.SubElement(t_elm, 'tags_src_dir')
    tmp.attrib['extension-by'] = 'default'
    tmp.text = tags_src_dir
    tmp.tail = '\n'

    doc.find('plugins').append(t_elm)


def update_12(doc):
    """
    12) plugins

    <user_items>
        <module>default_user_items</module>
    </user_items>
    """
    ui_elm = etree.Element('user_items')

    tmp = etree.SubElement(ui_elm, 'module')
    tmp.text = 'default_user_items'

    doc.find('/plugins').append(ui_elm)


def update_13(doc):
    """
    13) plugins

    <menu_items>
        <module>default_menu_items</module>
        <data_path extension-by="default">/home/tomas/work/kontext.dev/conf/main-menu.json</data_path>
    </menu_items>
    """
    mi_elm = etree.Element('menu_items')

    tmp = etree.SubElement(mi_elm, 'module')
    tmp.text = 'default_menu_items'

    tmp = etree.SubElement(mi_elm, 'data_path')
    tmp.attrib['extension-by'] = 'default'
    tmp.text = '/opt/noske/share/kontext/conf/main-menu.json'

    doc.find('/plugins').append(mi_elm)


def update_14(doc):
    """
    14) corpora

    remove tags_src_dir (before this, copy the path to the 11) )
    remove tags_cache_dir (before this, copy the path to the 11) )
    """
    remove_element(doc.find('/corpora/tags_src_dir'))
    remove_element(doc.find('/corpora/tags_cache_dir'))


def update_15(doc):
    """
    15) corpora

    <multilevel_freq_dist_max_levels>3</multilevel_freq_dist_max_levels>
    """
    mfdml_elm = etree.SubElement(doc.find('/corpora'), 'multilevel_freq_dist_max_levels')
    mfdml_elm.text = '3'


def process_document(xml_doc):
    func_name = lambda j: 'update_%d' % j
    i = 1
    while func_name(i) in dir(sys.modules[__name__]):
        fn = getattr(sys.modules[__name__], func_name(i))
        if callable(fn):
            fn(xml_doc)
        i += 1


if __name__ == '__main__':
    import argparse
    argparser = argparse.ArgumentParser(description='Converts KonText config.xml version 0.6.x '
                                                    'to the version 0.7')
    argparser.add_argument('conf_file', metavar='CONF_FILE',
                           help='an XML configuration file')
    argparser.add_argument('-p', '--print', action='store_const', const=True,
                           help='Print result instead of writing it to a file')
    args = argparser.parse_args()

    doc = etree.parse(args.conf_file)
    process_document(doc)

    result_xml = etree.tostring(doc, encoding='utf-8', pretty_print=True)
    if getattr(args, 'print'):
        print(result_xml)
    else:
        output_path = '%s.new.xml' % args.conf_file.rsplit('.', 1)[0]
        with open(output_path, 'wb') as f:
            f.write(result_xml)
            print('DONE!\nConverted config written to %s\n' % output_path)
