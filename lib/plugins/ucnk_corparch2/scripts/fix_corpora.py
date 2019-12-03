import os
import sys
import argparse
import mysql.connector
import mysql.connector.errors
from lxml import etree
from collections import OrderedDict

sys.path.insert(0, '/opt/manatee/2.158.8/lib/python2.7/site-packages/')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from plugins.ucnk_remote_auth4.backend.mysql import MySQL, MySQLConf
import manatee

REGISTRY_PATH = '/var/local/corpora/registry'


class CitationInfo(object):
    pass


class Metadata(object):
    pass


class CorpusInfo(object):

    def __init__(self):
        self.metadata = Metadata()
        self.citation_info = CitationInfo()


def get_keywords(corp_info):
    web = getattr(corp_info, 'web', '')

    if web is not None and 'aranea' in web.lower():
        return getattr(corp_info.metadata, 'keywords', [])
    else:
        return []


def get_web(corp_info):
    web = getattr(corp_info, 'web', '')
    if web is not None and 'aranea' in web.lower():
        return web
    else:
        return None


def analyze_corpus(corpname, corp_info):
    size = 0
    try:
        corp = manatee.Corpus(os.path.join(REGISTRY_PATH, corpname))
        size = corp.size()
    except:
        pass
    return (size, get_web(corp_info), get_keywords(corp_info))


def get_corpora(db):
    cur = db.cursor(buffered=True)
    cur.execute('SELECT name FROM corpora ORDER BY name')
    return [r['name'] for r in cur.fetchall()]


def _get_corpus_keywords(root):
    """
    Returns fixed labels (= keywords) for the corpus. Please
    note that the "favorite" flag is not included here.
    returns:
    OrderedDict(keyword_id => {...keyword labels...})
    """
    return [k.text.strip() for k in root.findall('./keywords/item')]


def _process_corpus_node(node, data):
    corpus_id = node.attrib['ident'].lower()
    web_url = node.attrib['web'] if 'web' in node.attrib else None
    sentence_struct = node.attrib['sentence_struct'] if 'sentence_struct' in node.attrib else None

    ans = CorpusInfo()
    ans.id = corpus_id
    ans.web = web_url
    ans.sentence_struct = sentence_struct
    ans.tagset = node.attrib.get('tagset', None)
    ans.speech_segment = node.attrib.get('speech_segment', None)
    ans.speaker_id_attr = node.attrib.get('speaker_id_attr', None)
    ans.speech_overlap_attr = node.attrib.get('speech_overlap_attr', None)
    ans.speech_overlap_val = node.attrib.get('speech_overlap_val', None)
    ans.bib_struct = node.attrib.get('bib_struct', None)
    ans.collator_locale = node.attrib.get('collator_locale', 'en_US')
    ans.sample_size = node.attrib.get('sample_size', -1)

    ref_elm = node.find('reference')
    if ref_elm is not None:
        ans.citation_info.default_ref = getattr(ref_elm.find('default'), 'text', None)
        articles = [getattr(x, 'text', None) for x in ref_elm.findall('article')]
        ans.citation_info.article_ref = articles
        ans.citation_info.other_bibliography = getattr(
            ref_elm.find('other_bibliography'), 'text', None)

    meta_elm = node.find('metadata')
    if meta_elm is not None:
        ans.metadata.database = getattr(meta_elm.find('database'), 'text', None)
        ans.metadata.label_attr = getattr(meta_elm.find('label_attr'), 'text', None)
        ans.metadata.id_attr = getattr(meta_elm.find('id_attr'), 'text', None)
        ans.metadata.keywords = _get_corpus_keywords(meta_elm)

    data[corpus_id] = ans


def parse_corplist(corplist_path):
    doc = etree.parse(corplist_path)
    data = {}
    for item in doc.findall('//corpus'):
        _process_corpus_node(item, data)
    return data


def fix_corpora(db, corplist, corplist_conf):
    cursor = db.cursor()
    for corp in corplist:
        print(('{0}:'.format(corp)))
        try:
            mod_id = corp.rsplit('/', 1)[-1]
            size, web, keywords = analyze_corpus(corp, corplist_conf.get(mod_id, CorpusInfo()))
            if size > 0:
                cursor.execute('UPDATE corpora SET size = %s WHERE name = %s', (corp, size))
            if web:
                cursor.execute('UPDATE corpora SET web = %s WHERE name = %s', (web, size))
            for k in keywords:
                cursor.execute(
                    'INSERT INTO kontext_keyword_corpus (corpus_name, keyword_id) VALUES (%s, %s)', (corp, k))

        except Exception as ex:
            print(('skipping {0} due to: {1}'.format(corp, ex)))
        print('---------')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Import N records starting from offset')
    parser.add_argument('conf_path', metavar='CONFPATH', type=str)
    parser.add_argument('corplist_path', metavar='CORPLISTPATH', type=str)
    args = parser.parse_args()
    import settings
    settings.load(args.conf_path)
    db = MySQL(MySQLConf(settings))
    corplist = get_corpora(db)
    corplist_conf = parse_corplist(args.corplist_path)
    fix_corpora(db, corplist, corplist_conf)
    db.commit()
