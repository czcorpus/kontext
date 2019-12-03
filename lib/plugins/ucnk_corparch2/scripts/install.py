# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import os
import sys
import datetime
import pytz
import re
from lxml import etree
import argparse
from hashlib import md5

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from plugins.rdbms_corparch.backend import InstallCorpusInfo
from plugins.rdbms_corparch.backend.input import InstallJson
from plugins.ucnk_remote_auth4.backend.mysql import MySQL, MySQLConf
from plugins.ucnk_corparch2.backend.dummy import DummySQL, DummyShared


class Shared(InstallCorpusInfo):

    def __init__(self, reg_path):
        super(Shared, self).__init__(reg_path)
        self._desc = {}
        self._ttdesc_id = 0
        self._articles = {}  # entry hash => db ID
        self._reg_path = reg_path

    def get_ref_ttdesc(self, ident):
        return self._desc.get(ident, None)

    def add_ref_art(self, ident, value):
        self._desc[ident] = value

    @property
    def ttdesc_id_inc(self):
        self._ttdesc_id += 1
        return self._ttdesc_id

    @property
    def ttdesc_id(self):
        return self._ttdesc_id

    def reuse_article(self, entry):
        ahash = md5(entry).hexdigest()
        if ahash in self._articles:
            return self._articles[ahash]
        return None

    def add_article(self, entry, db_id):
        ahash = md5(entry).hexdigest()
        self._articles[ahash] = db_id

    def registry_exists(self, corpus_id, variant):
        if variant:
            return os.path.exists(os.path.join(self._reg_path, variant, corpus_id))
        return os.path.exists(os.path.join(self._reg_path, corpus_id))


class InstallJsonDir(object):

    def __init__(self, dir_path):
        self._dir_path = dir_path
        self._data = {}
        self._current = None

    def switch_to(self, corpus_id):
        if corpus_id not in self._data:
            self._data[corpus_id] = InstallJson()
        self._current = self._data[corpus_id]

    @property
    def current(self):
        return self._current

    def write(self):
        if args.json_out:
            if not os.path.exists(args.json_out):
                os.makedirs(args.json_out)
            for ident, conf in list(self._data.items()):
                fpath = os.path.join(self._dir_path, ident + '.json')
                with open(fpath, 'wb') as fw:
                    conf.write(fw)


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


def new_cursor(db):
    return db.cursor(dictionary=True, buffered=True)


def prepare_tables(db):
    cursor = new_cursor(db)
    cursor.execute('SET FOREIGN_KEY_CHECKS = 0')
    cursor.execute('DELETE FROM corpus_posattr')
    cursor.execute('DELETE FROM corpus_structattr')
    cursor.execute('DELETE FROM corpus_structure')
    cursor.execute('DELETE FROM kontext_article')
    cursor.execute('DELETE FROM corpus_alignment')
    cursor.execute('DELETE FROM kontext_corpus_article')
    cursor.execute('DELETE FROM kontext_corpus_user')
    cursor.execute('DELETE FROM kontext_keyword')
    cursor.execute('DELETE FROM kontext_keyword_corpus')
    cursor.execute('DELETE FROM kontext_tckc_corpus')
    cursor.execute('DELETE FROM kontext_ttdesc')
    cursor.execute('DELETE FROM registry_conf')
    cursor.execute('DELETE FROM registry_variable')
    cursor.execute('SET FOREIGN_KEY_CHECKS = 1')


def fetch_structattr(s):
    if s is None or s == '':
        s = '.'
    return tuple(x if x else None for x in s.split('.'))


def _corpus_exists(db, ident):
    cursor = new_cursor(db)
    cursor.execute('SELECT COUNT(*) AS cnt FROM corpora WHERE name = %s LIMIT 1', (ident,))
    row = cursor.fetchone()
    return row and row['cnt'] == 1


def create_corp_record(node, db, shared, json_out, variant, create_if_none):
    cursor = new_cursor(db)
    ident = node.attrib['ident'].lower()
    if not _corpus_exists(db, ident):
        if create_if_none:
            cursor.execute('INSERT INTO corpora (name) VALUES (%s)', (ident,))
        else:
            return
    web = node.attrib['web'] if 'web' in node.attrib else None
    tagset = node.attrib.get('tagset', None)
    speech_segment_struct, speech_segment_attr = fetch_structattr(
        node.attrib.get('speech_segment', None))
    speaker_id_struct, speaker_id_attr = fetch_structattr(node.attrib.get('speaker_id_attr', None))
    speech_overlap_struct, speech_overlap_attr = fetch_structattr(
        node.attrib.get('speech_overlap_attr', None))
    speech_overlap_val = node.attrib.get('speech_overlap_val', None)
    collator_locale = node.attrib.get('collator_locale', 'en_US')
    use_safe_font = decode_bool(node.attrib.get('use_safe_font', 'false'))
    sentence_struct = node.attrib['sentence_struct'] if 'sentence_struct' in node.attrib else None
    group_name, version = InstallJson.create_sorting_values(ident)

    t1 = datetime.datetime.now(tz=pytz.timezone('Europe/Prague')).strftime("%Y-%m-%dT%H:%M:%S%z")
    cursor.execute('UPDATE corpora SET group_name = %s, version = %s, updated = CURRENT_TIMESTAMP, '
                   'web = %s, tagset = %s, collator_locale = %s, speech_overlap_val = %s, use_safe_font = %s, '
                   'size = %s, created = %s, updated = %s '
                   'WHERE name = %s',
                   (group_name, version, web, tagset, collator_locale, speech_overlap_val, use_safe_font,
                    shared.get_corpus_size(ident), t1, t1, ident))

    # dependent structures and attrs
    if speech_segment_struct and speech_segment_attr:
        create_structattr(db, ident, speech_segment_struct, speech_segment_attr)

    if speaker_id_attr and speaker_id_struct:
        create_structattr(db, ident, speaker_id_struct, speaker_id_attr)

    if speech_overlap_struct and speech_overlap_attr:
        create_structattr(db, ident, speech_overlap_struct, speech_overlap_attr)

    if sentence_struct:
        create_structure(db, ident, sentence_struct)

    cursor.execute('UPDATE corpora SET '
                   'sentence_struct = %s, '
                   'speech_segment_struct = %s, speech_segment_attr = %s, speaker_id_struct = %s, '
                   'speaker_id_attr = %s, speech_overlap_struct = %s, speech_overlap_attr = %s '
                   'WHERE name = %s', (sentence_struct, speech_segment_struct, speech_segment_attr,
                                       speaker_id_struct, speaker_id_attr, speech_overlap_struct, speech_overlap_attr,
                                       ident))
    # json generator
    json_out.switch_to(ident)
    json_out.current.ident = ident
    json_out.current.web = web
    json_out.current.sentence_struct = sentence_struct
    json_out.current.tagset = tagset
    json_out.current.speech_segment = '{0}.{1}'.format(speech_segment_struct, speech_segment_attr)
    json_out.current.speaker_id_attr = speaker_id_attr
    json_out.current.speech_overlap_attr = speech_overlap_attr
    json_out.current.speech_overlap_val = speech_overlap_val
    json_out.current.collator_locale = collator_locale
    json_out.use_safe_font = use_safe_font
    create_metadata_record(db, shared, node, ident, json_out.current)
    parse_tckc(node, db, ident, json_out.current)


def structure_exists(db, corpus_id, struct_name):
    cursor = new_cursor(db)
    cursor.execute('SELECT COUNT(*) AS num FROM corpus_structure WHERE corpus_name = %s AND name = %s LIMIT 1',
                   (corpus_id, struct_name))
    row = cursor.fetchone()
    return row and row['num'] > 0


def create_structure(db, corpus_id, struct_name):
    if not structure_exists(db, corpus_id, struct_name):
        cursor = new_cursor(db)
        cursor.execute(
            'INSERT INTO corpus_structure (corpus_name, name) VALUES (%s, %s)', (corpus_id, struct_name))


def create_structattr(db, corpus_id, struct_name, structattr_name):
    cursor = new_cursor(db)
    if not structure_exists(db, corpus_id, struct_name):
        create_structure(db, corpus_id, struct_name)
    cursor.execute('INSERT INTO corpus_structattr (corpus_name, structure_name, name) VALUES (%s, %s, %s)',
                   (corpus_id, struct_name, structattr_name))


def _find_existing_ic_ttdesc_id(db):
    cursor = db.cursor(buffered=True)
    cursor.execute(
        "SELECT ttdesc_id FROM corpora WHERE ttdesc_id IS NOT NULL AND name LIKE '%intercorp%'")
    row = cursor.fetchone()
    if row:
        return row['ttdesc_id']
    return None


def parse_meta_desc(meta_elm, db, shared, corpus_id, json_out):
    ans = {}
    desc_all = meta_elm.findall('desc')
    cursor = new_cursor(db)
    if len(desc_all) == 1 and 'ref' in list(desc_all[0].keys()):
        message_key = desc_all[0].attrib['ref']
        value = shared.get_ref_ttdesc(message_key)
        if value is None:
            value = _find_existing_ic_ttdesc_id(db)
        if value:
            cursor.execute(
                'UPDATE corpora SET ttdesc_id = %s WHERE name = %s', (value, corpus_id))
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
            if 'ident' in list(d.keys()):
                ident = d.attrib['ident']
        cursor.execute('INSERT INTO kontext_ttdesc (id, text_cs, text_en) VALUES (%s, %s, %s)',
                       (shared.ttdesc_id_inc, text_cs, text_en))
        cursor.execute(
            'UPDATE corpora SET ttdesc_id = %s WHERE name = %s', (shared.ttdesc_id, corpus_id))
        json_out.metadata.desc = shared.ttdesc_id
        if ident:
            shared.add_ref_art(ident, shared.ttdesc_id)
    return ans


def parse_keywords(elm, db, shared, corpus_id, json_out):
    cursor = new_cursor(db)
    for k in elm.findall('keywords/item'):
        cursor.execute('INSERT INTO kontext_keyword_corpus (corpus_name, keyword_id) VALUES (%s, %s)',
                       (corpus_id, k.text.strip()))
        json_out.metadata.keywords.append(k.text.strip())


def parse_tckc(elm, db, corpus_id, json_out):
    cursor = new_cursor(db)
    token_connect_elm = elm.find('token_connect')
    if token_connect_elm is not None:
        for p in token_connect_elm.findall('provider'):
            cursor.execute('INSERT INTO kontext_tckc_corpus (corpus_name, provider, type) VALUES (%s, %s, %s)',
                           (corpus_id, p.text.strip(), 'tc'))
            json_out.token_connect.append(p.text.strip())

    kwic_connect_elm = elm.find('kwic_connect')
    if kwic_connect_elm is not None:
        for p in kwic_connect_elm.findall('provider'):
            cursor.execute('INSERT INTO kontext_tckc_corpus (corpus_name, provider, type) VALUES (%s, %s, %s)',
                           (corpus_id, p.text.strip(), 'kc'))
            json_out.kwic_connect.append(p.text.strip())


def create_metadata_record(db, shared, node, corpus_id, json_out):

    def clean_reference(s):
        return re.sub(r'\s+', ' ', s.strip())

    def add_article(entry, role):
        cursor = new_cursor(db)
        nid = shared.reuse_article(entry)
        if nid is None:
            cursor.execute('INSERT INTO kontext_article (entry) VALUES (%s)', (entry,))
            cursor.execute('SELECT last_insert_id() AS last_id')
            nid = cursor.fetchone()['last_id']
        shared.add_article(entry, nid)
        cursor.execute('INSERT INTO kontext_corpus_article (corpus_name, article_id, role) '
                       'VALUES (%s, %s, %s)', (corpus_id, nid, role))
        return nid

    meta_elm = node.find('metadata')
    if meta_elm is not None:
        db_path = getattr(meta_elm.find('database'), 'text', None)
        label_struct, label_attr = fetch_structattr(
            getattr(meta_elm.find('label_attr'), 'text', None))
        id_struct, id_attr = fetch_structattr(getattr(meta_elm.find('id_attr'), 'text', None))
        is_feat = 1 if meta_elm.find('featured') is not None else 0

        if label_attr and label_struct:
            create_structattr(db, corpus_id, label_struct, label_attr)

        if id_attr and id_struct:
            create_structattr(db, corpus_id, id_struct, id_attr)

        cursor = new_cursor(db)
        cursor.execute('UPDATE corpora SET '
                       'text_types_db = %s, bib_label_struct = %s, bib_label_attr = %s, '
                       'bib_id_struct = %s, bib_id_attr = %s, featured = %s '
                       'WHERE name = %s', (db_path, label_struct, label_attr, id_struct, id_attr, is_feat, corpus_id))
        json_out.metadata.database = db_path
        json_out.metadata.label_attr = '{0}.{1}'.format(label_struct, label_attr)
        json_out.metadata.id_attr = '{0}.{1}'.format(id_struct, id_attr)
        json_out.metadata.featured = is_feat
        json_out.metadata.keywords = []

        ref_elm = node.find('reference')
        if ref_elm is not None:
            default_ref = getattr(ref_elm.find('default'), 'text', None)
            if default_ref is not None:
                default_ref = clean_reference(default_ref)
            articles = [clean_reference(x.text) for x in ref_elm.findall('article')]
            other_bibliography = getattr(ref_elm.find('other_bibliography'), 'text', None)
            if other_bibliography is not None:
                other_bibliography = clean_reference(other_bibliography)
        else:
            default_ref = None
            articles = []
            other_bibliography = None

        if default_ref:
            json_out.reference.default = add_article(default_ref, 'default')
        for art in articles:
            json_out.reference.other_bibliography = add_article(art, 'standard')
        if other_bibliography:
            json_out.reference.articles.append(add_article(other_bibliography, 'other'))

        parse_meta_desc(meta_elm, db, shared, corpus_id, json_out)
        parse_keywords(meta_elm, db, shared, corpus_id, json_out)


def parse_keywords_def(root, db):
    srch = root.findall('corplist/keywords/keyword')
    cursor = new_cursor(db)
    for item in srch:
        label_cs = None
        label_en = None
        label_all = item.findall('label')
        for label_item in label_all:
            if label_item.attrib['lang'] == 'en':
                label_en = label_item.text.strip()
            elif label_item.attrib['lang'] == 'cs':
                label_cs = label_item.text.strip()
        cursor.execute('INSERT INTO kontext_keyword (id, label_cs, label_en, color) '
                       'VALUES (%s, %s, %s, %s)', (item.attrib['ident'], label_cs, label_en,
                                                   item.attrib['color'] if 'color' in item.attrib else None))


def parse_corplist(path, db, shared, json_out, variant, verbose, data_only, create_if_none):
    with open(path) as f:
        if not data_only:
            prepare_tables(db)

        xml = etree.parse(f)
        parse_keywords_def(xml, db)
        corpora = xml.findall('//corpus')

        for c in corpora:
            try:
                create_corp_record(c, db, shared, json_out, variant, create_if_none)
            except Exception as ex:
                print(('Skipping corpus [{0}] due to error: {1}'.format(c.attrib['ident'], ex)))
                if verbose:
                    import traceback
                    traceback.print_exc()
        db.commit()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Import existing corplist.xml into an existing mysql/mariadb database')
    parser.add_argument('corplist', metavar='CORPLIST', type=str)
    parser.add_argument('conf_path', metavar='CONFPATH', type=str)
    parser.add_argument('-s', '--schema-only', metavar='SCHEMA_ONLY',
                        action='store_const', const=True)
    parser.add_argument('-d', '--data-only', metavar='DATA_ONLY', action='store_const', const=True)
    parser.add_argument('-c', '--create-if-none', metavar='CREATE_IF_NONE',
                        action='store_const', const=True)
    parser.add_argument('-j', '--json-out', metavar='JSON_OUT', type=str,
                        help='A directory where corpus installation JSON should be stored')
    parser.add_argument('-r', '--reg-path', type=str, default='',
                        help='Path to registry files')
    parser.add_argument('-a', '--variant', type=str,
                        help='Try to search for alternative registry in a directory with this name')
    parser.add_argument('-v', '--verbose', action='store_const', const=True,
                        help='Print some additional (error) information')
    parser.add_argument('-y', '--dry-run', action='store_const', const=True,
                        help='No actual database operation will be performed. SQL queries will be printed.')
    args = parser.parse_args()
    import settings
    settings.load(args.conf_path)
    if args.dry_run:
        db = DummySQL()
    else:
        db = MySQL(MySQLConf(settings))
    if args.schema_only:
        prepare_tables(db)
    else:
        reg_path = args.reg_path if args.reg_path else settings.get('corpora', 'manatee_registry')
        shared = DummyShared() if args.dry_run else Shared(reg_path=reg_path)
        ijson = InstallJsonDir(args.json_out)
        parse_corplist(path=args.corplist, db=db, shared=shared, json_out=ijson,
                       variant=args.variant, verbose=args.verbose, data_only=args.data_only,
                       create_if_none=args.create_if_none)
        ijson.write()
    db.commit()
