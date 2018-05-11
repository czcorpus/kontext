import os
import sys
from lxml import etree
import sqlite3
import argparse


class Shared(object):
    _desc = {}
    _article_id = 0
    _ttdesc_id = 0
    _corp_order = 0

    @property
    def article_id_inc(self):
        self._article_id += 1
        return self._article_id

    def get_ref_ttdesc(self, ident):
        return self._desc.get(ident, [])

    def add_ref_art(self, ident, values):
        self._desc[ident] = values

    @property
    def ttdesc_id_inc(self):
        self._ttdesc_id += 1
        return self._ttdesc_id

    @property
    def ttdesc_id(self):
        return self._ttdesc_id

    @property
    def corp_order_inc(self):
        self._corp_order += 1
        return self._corp_order


def decode_bool(v):
    ans = False
    if v is not None:
        if v.isdigit():
            ans = bool(int(v))
        elif v.lower() == 'true':
            ans = True
        elif v.lower() == 'false':
            ans = False
    return ans


def prepare_tables(db):
    cursor = db.cursor()
    cursor.execute('DROP TABLE IF EXISTS corpus')
    cursor.execute('DROP TABLE IF EXISTS metadata')
    cursor.execute('DROP TABLE IF EXISTS ttdesc')
    cursor.execute('DROP TABLE IF EXISTS ttdesc_corpus')
    cursor.execute('DROP TABLE IF EXISTS reference_article')
    cursor.execute('DROP TABLE IF EXISTS keyword')
    cursor.execute('DROP TABLE IF EXISTS keyword_corpus')
    cursor.execute('DROP TABLE IF EXISTS tckc_corpus')

    sql_path = os.path.join(os.path.dirname(__file__), './tables.sql')
    with open(sql_path) as fr:
        db.executescript(' '.join(fr.readlines()))


def create_corp_record(node, db, shared):
    ident = node.attrib['ident'].lower()
    web = node.attrib['web'] if 'web' in node.attrib else None
    sentence_struct = node.attrib['sentence_struct'] if 'sentence_struct' in node.attrib else None
    tagset = node.attrib.get('tagset', None)
    speech_segment = node.attrib.get('speech_segment', None)
    speaker_id_attr = node.attrib.get('speaker_id_attr', None)
    speech_overlap_attr = node.attrib.get('speech_overlap_attr', None)
    speech_overlap_val = node.attrib.get('speech_overlap_val', None)
    collator_locale = node.attrib.get('collator_locale', 'en_US')
    use_safe_font = decode_bool(node.attrib.get('use_safe_font', 'false'))

    cursor = db.cursor()
    cursor.execute('INSERT INTO corpus (id, list_pos, web, sentence_struct, tagset, collator_locale, speech_segment, '
                   'speaker_id_attr,  speech_overlap_attr,  speech_overlap_val, use_safe_font) '
                   'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', (ident, shared.corp_order_inc, web, sentence_struct,
                                                                tagset, collator_locale, speech_segment,
                                                                speaker_id_attr, speech_overlap_attr,
                                                                speech_overlap_val, use_safe_font))
    create_metadata_record(node, ident, db, shared)
    parse_tckc(node, db, ident)


def parse_meta_desc(meta_elm, db, shared, corpus_id):
    ans = {}
    desc_all = meta_elm.findall('desc')
    cursor = db.cursor()
    if len(desc_all) == 1 and 'ref' in desc_all[0].keys():
        message_key = desc_all[0].attrib['ref']
        value = shared.get_ref_ttdesc(message_key)
        cursor.execute(
            'INSERT INTO ttdesc_corpus (corpus_id, ttdesc_id) VALUES (?, ?)', (corpus_id, value))
    elif len(desc_all) > 0:
        text_cs = ''
        text_en = ''
        ident = None
        for d in desc_all:
            lang_code = d.attrib['lang']
            if lang_code == 'en':
                text_en = d.text
            elif lang_code == 'cs':
                text_cs = d.text
            if 'ident' in d.keys():
                ident = d.attrib['ident']
        cursor.execute('INSERT INTO ttdesc (id, text_cs, text_en) VALUES (?, ?, ?)', (shared.ttdesc_id_inc,
                                                                                      text_cs, text_en))
        if ident:
            shared.add_ref_art(ident, shared.ttdesc_id)
    return ans


def parse_keywords(elm, db, shared, corpus_id):
    cursor = db.cursor()
    for k in elm.findall('keywords/item'):
        cursor.execute('INSERT INTO keyword_corpus (corpus_id, keyword_id) VALUES (?, ?)',
                       (corpus_id, k.text.strip()))


def parse_tckc(elm, db, corpus_id):
    cursor = db.cursor()
    token_connect_elm = elm.find('token_connect')
    if token_connect_elm is not None:
        for p in token_connect_elm.findall('provider'):
            cursor.execute('INSERT INTO tckc_corpus (corpus_id, provider, type) VALUES (?, ?, ?)',
                           (corpus_id, p.text.strip(), 'tc'))

    kwic_connect_elm = elm.find('kwic_connect')
    if kwic_connect_elm is not None:
        for p in kwic_connect_elm.findall('provider'):
            cursor.execute('INSERT INTO tckc_corpus (corpus_id, provider, type) VALUES (?, ?, ?)',
                           (corpus_id, p.text.strip(), 'kc'))


def create_metadata_record(node, corpus_id, db, shared):
    meta_elm = node.find('metadata')
    if meta_elm is not None:
        db_path = getattr(meta_elm.find('database'), 'text', None)
        label_attr = getattr(meta_elm.find('label_attr'), 'text', None)
        id_attr = getattr(meta_elm.find('id_attr'), 'text', None)
        is_feat = 1 if meta_elm.find('featured') is not None else 0

        ref_elm = node.find('reference')
        if ref_elm is not None:
            default_ref = getattr(ref_elm.find('default'), 'text', None)
            articles = [x.text for x in ref_elm.findall('article')]
            other_bibliography = getattr(ref_elm.find('other_bibliography'), 'text', None)
        else:
            default_ref = None
            articles = []
            other_bibliography = None

        cursor = db.cursor()
        cursor.execute('INSERT INTO metadata (corpus_id, database, label_attr, id_attr, featured, reference_default, '
                       'reference_other) VALUES (?, ?, ?, ?, ?, ?, ?)', (corpus_id, db_path, label_attr, id_attr,
                                                                         is_feat, default_ref, other_bibliography))

        for art in articles:
            cursor.execute('INSERT INTO reference_article (id, corpus_id, article) VALUES (?, ?, ?)',
                           (shared.article_id_inc, corpus_id, art))

        parse_meta_desc(meta_elm, db, shared, corpus_id)
        parse_keywords(meta_elm, db, shared, corpus_id)


def parse_keywords_def(root, db):
    srch = root.findall('corplist/keywords/keyword')
    cursor = db.cursor()
    for item in srch:
        label_cs = None
        label_en = None
        label_all = item.findall('label')
        for label_item in label_all:
            if label_item.attrib['lang'] == 'en':
                label_en = label_item.text.strip()
            elif label_item.attrib['lang'] == 'cs':
                label_cs = label_item.text.strip()
        cursor.execute('INSERT INTO keyword (id, label_cs, label_en, color) '
                       'VALUES (?, ?, ?, ?)', (item.attrib['ident'], label_cs, label_en,
                                               item.attrib['color'] if 'color' in item.attrib else None))


def parse_corplist(path, db_path, shared):
    with open(path) as f, sqlite3.connect(db_path) as db:
        prepare_tables(db)
        xml = etree.parse(f)

        parse_keywords_def(xml, db)

        corpora = xml.findall('//corpus')
        for c in corpora:
            try:
                create_corp_record(c, db, shared)
            except Exception as ex:
                print('Skipping corpus [{0}] due to error: {1}'.format(c.attrib['ident'], ex))
        db.commit()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Import existing corplist.xml into a new sqlite3 database')
    parser.add_argument('corplist', metavar='CORPLIST', type=str)
    parser.add_argument('dbpath', metavar='DBPATH', type=str)
    args = parser.parse_args()
    parse_corplist(args.corplist, args.dbpath, Shared())
