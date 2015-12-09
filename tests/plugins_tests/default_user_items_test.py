# Copyright (c) 2015 Institute of the Czech National Corpus
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

import unittest


import plugins
from mocks.storage import TestingKeyValueStorage
from plugins.abstract.user_items import CorpusItem, SubcorpusItem, AlignedCorporaItem
import json

plugins.inject_plugin('db', TestingKeyValueStorage({}))
plugins.inject_plugin('auth', object())
from plugins.default_user_items import create_instance
from plugins.default_user_items import ItemEncoder, import_from_json


def create_corpus_obj(name='korpus syn 2010', corpus_id='public/syn2010', canonical_id='syn2010'):
    c = CorpusItem(name=name)
    c.corpus_id = corpus_id
    c.canonical_id = canonical_id
    return c


class TestCommon(unittest.TestCase):
    def setUp(self):
        plugins.get('db').reset()
        self._plugin = create_instance({})


class TestCorpusItemIdReadOnly(TestCommon):
    def runTest(self):
        with self.assertRaises(AttributeError):
            c = create_corpus_obj()
            c.id = 'foo'


class TestCorpusItemTypeReadOnly(TestCommon):
    def runTest(self):
        with self.assertRaises(AttributeError):
            c = create_corpus_obj()
            c.type = 'foo'


class TestCorpusItemSerialization(TestCommon):
    def runTest(self):
        c = create_corpus_obj()
        data = json.loads(json.dumps(c, cls=ItemEncoder))
        self.assertEqual(data['id'], c.id)
        self.assertEqual(data['name'], c.name)
        self.assertEqual(data['corpus_id'], c.corpus_id)
        self.assertEqual(data['canonical_id'], c.canonical_id)
        self.assertEqual(data['type'], c.type)


class TestCorpusItemDeserialization(TestCommon):
    def runTest(self):
        src = """{"id": "public/syn2010", "canonical_id": "syn2010", "name":
                  "korpus syn 2010", "corpus_id": "public/syn2010", "type": "corpus"}"""
        d = json.loads(src)
        decoder = json.JSONDecoder(object_hook=import_from_json)
        obj = decoder.decode(src)
        self.assertEqual(obj.id, d['id'])
        self.assertEqual(obj.type, d['type'])
        self.assertEqual(obj.name, d['name'])
        self.assertEqual(obj.corpus_id, d['corpus_id'])
        self.assertEqual(obj.canonical_id, d['canonical_id'])
        self.assertTrue(isinstance(obj, CorpusItem))


class TestSubcorpusItemIdReadOnly(TestCommon):
    def runTest(self):
        with self.assertRaises(AttributeError):
            c = SubcorpusItem(name='korpus syn 2010')
            c.id = 'foo'


class TestSubcorpusItemTypeReadOnly(TestCommon):
    def runTest(self):
        with self.assertRaises(AttributeError):
            c = SubcorpusItem(name='korpus syn 2010')
            c.type = 'foo'


class TestSubcorpusItemSerialization(TestCommon):
    def runTest(self):
        c = SubcorpusItem(name='korpus syn 2010')
        c.corpus_id = 'public/syn2010'
        c.canonical_id = 'syn2010'
        c.subcorpus_id = 'modern_poetry'

        c.size = 123000
        data = json.loads(json.dumps(c, cls=ItemEncoder))
        self.assertEqual(data['id'], c.id)
        self.assertEqual(data['type'], c.type)
        self.assertEqual(data['name'], c.name)
        self.assertEqual(data['corpus_id'], c.corpus_id)
        self.assertEqual(data['canonical_id'], c.canonical_id)
        self.assertEqual(data['subcorpus_id'], c.subcorpus_id)
        self.assertEqual(data['size'], c.size)


class TestSubcorpusItemDeserialization(TestCommon):
    def runTest(self):
        src = """{"name": "korpus syn 2010", "canonical_id": "syn2010", "corpus_id": "public/syn2010",
                  "subcorpus_id": "modern_poetry", "type": "subcorpus",
                  "id": "public/syn2010:modern_poetry", "size": 123000}"""
        d = json.loads(src)
        decoder = json.JSONDecoder(object_hook=import_from_json)
        obj = decoder.decode(src)
        self.assertEqual(obj.id, d['id'])
        self.assertEqual(obj.type, d['type'])
        self.assertEqual(obj.name, d['name'])
        self.assertEqual(obj.corpus_id, d['corpus_id'])
        self.assertEqual(obj.canonical_id, d['canonical_id'])
        self.assertEqual(obj.subcorpus_id, d['subcorpus_id'])
        self.assertEqual(obj.size, d['size'])
        self.assertTrue(isinstance(obj, SubcorpusItem))


class TestAlignedCorporaItemIdReadOnly(TestCommon):
    def runTest(self):
        with self.assertRaises(AttributeError):
            c = create_corpus_obj()
            c.id = 'foo'


class TestAlignedCorporaItemTypeReadOnly(TestCommon):
    def runTest(self):
        with self.assertRaises(AttributeError):
            c = create_corpus_obj()
            c.type = 'foo'


class TestAlignmentCorporaNewItemId(TestCommon):
    def runTest(self):
        c = AlignedCorporaItem('foo and bar')
        c.corpus_id = 'x/corpus1'
        c.corpora = [create_corpus_obj(name='Corpus 2', corpus_id='x/corpus2', canonical_id='corpus2'),
                     create_corpus_obj(name='Corpus 3', corpus_id='x/corpus3', canonical_id='corpus3')]
        self.assertEqual(c.id, 'x/corpus1+x/corpus2+x/corpus3')


class TestAlignmentCorporaItemSerialization(TestCommon):
    def runTest(self):
        a = AlignedCorporaItem(name='Bunch of corpora')
        a.corpus_id = 'public/main_corpus'
        a.canonical_id = 'main_corpus'
        c1 = create_corpus_obj()
        c2 = create_corpus_obj(name='BNC', corpus_id='limited/bnc', canonical_id='bnc')
        c3 = create_corpus_obj(name='InterCorp version 7', corpus_id='limited/intercorp', canonical_id='intercorp')
        a.corpora = [c1, c2, c3]
        data = json.loads(json.dumps(a, cls=ItemEncoder))

        self.assertEqual(data['id'], a.id)
        self.assertEqual(data['name'], a.name)
        self.assertEqual(data['type'], a.type)
        self.assertEqual(data['corpus_id'], a.corpus_id)
        self.assertEqual(data['canonical_id'], a.canonical_id)
        self.assertEqual(len(data['corpora']), 3)

        for i in range(3):
            self.assertEqual(data['corpora'][i]['id'], a.corpora[i].id)
            self.assertEqual(data['corpora'][i]['name'], a.corpora[i].name)
            self.assertEqual(data['corpora'][i]['type'], a.corpora[i].type)
            self.assertEqual(data['corpora'][i]['corpus_id'], a.corpora[i].corpus_id)
            self.assertEqual(data['corpora'][i]['canonical_id'], a.corpora[i].canonical_id)


class TestAlignmentCorporaItemDeserialization(TestCommon):
    def runTest(self):
        src = """{"corpora": [{"corpus_id": "public/syn2010", "canonical_id": "syn2010", "type": "corpus",
                  "id": "public/syn2010", "name": "korpus syn 2010"},
                  {"corpus_id": "limited/bnc", "canonical_id": "bnc", "type": "corpus",
                  "id": "limited/bnc", "name": "BNC"}, {"corpus_id": "limited/intercorp",
                  "canonical_id": "intercorp", "type": "corpus", "id": "limited/intercorp",
                  "name": "InterCorp version 7"}], "corpus_id": "limited/main_corpus",
                  "canonical_id": "main_corpus",
                  "type": "aligned_corpora", "name": "Main Corpus",
                  "id": "limited/main_corpus+public/syn2010+limited/bnc+limited/intercorp"}"""
        data = json.loads(src)
        decoder = json.JSONDecoder(object_hook=import_from_json)
        obj = decoder.decode(src)

        self.assertEqual(obj.id, data['id'])
        self.assertEqual(obj.name, data['name'])
        self.assertEqual(obj.corpus_id, data['corpus_id'])
        self.assertEqual(obj.canonical_id, data['canonical_id'])
        self.assertEqual(obj.type, data['type'])
        self.assertEqual(len(obj.corpora), 3)
        self.assertTrue(isinstance(obj, AlignedCorporaItem))

        for i in range(3):
            self.assertEqual(obj.corpora[i].id, data['corpora'][i]['id'])
            self.assertEqual(obj.corpora[i].name, data['corpora'][i]['name'])
            self.assertEqual(obj.corpora[i].type, data['corpora'][i]['type'])
            self.assertEqual(obj.corpora[i].corpus_id, data['corpora'][i]['corpus_id'])
            self.assertEqual(obj.corpora[i].canonical_id, data['corpora'][i]['canonical_id'])
            self.assertTrue(isinstance(obj.corpora[i], CorpusItem))