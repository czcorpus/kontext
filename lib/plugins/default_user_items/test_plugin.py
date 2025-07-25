# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import json
import unittest

import plugins
from mocks import mplugins
from mocks.request import PluginCtx
from mocks.storage import TestingKeyValueStorage
from plugin_types.user_items import FavoriteItem
from plugins.default_user_items import UserItems

plugins.inject_plugin(plugins.runtime.DB, TestingKeyValueStorage({}))
plugins.inject_plugin(plugins.runtime.AUTH, mplugins.MockAuth(0))
plugins.inject_plugin(plugins.runtime.USER_ITEMS, mplugins.MockUserItems())
from plugins.default_user_items import import_legacy_record


def create_corpus_obj(name='korpus syn 2010'):
    return FavoriteItem(name=name, corpora=[dict(id='syn2010', name='Korpus SYN2010')])


class TestActions(unittest.TestCase):

    def test_import_legacy_record(self):
        legacy_rec = dict(
            id='foobar:1',
            corpus_id='foobar',
            name='The Foobar',
            subcorpus_id='my_work',
            size=1231,
            size_info='1k'
        )
        new_rec = import_legacy_record(legacy_rec)
        self.assertTrue(isinstance(new_rec, FavoriteItem))
        self.assertEqual(new_rec.ident, 'foobar:1')
        self.assertEqual(new_rec.name, 'The Foobar')
        self.assertEqual(new_rec.subcorpus_id, 'my_work')
        self.assertEqual(new_rec.size, 1231)
        self.assertEqual(new_rec.size_info, '1k')
        self.assertEqual(type(new_rec.corpora), list)
        self.assertEqual(len(new_rec.corpora), 1)
        self.assertDictEqual(new_rec.corpora[0], dict(id='foobar', name='The Foobar'))


class TestPlugin(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.plugin = UserItems(object(), plugins.runtime.DB.instance,
                                plugins.runtime.AUTH.instance)

    def test_serialize(self):
        corpus = dict(name='intercorp_en', id='intercorp_en')
        f = FavoriteItem(
            name='xxx', corpora=[corpus], size=100, size_info='0.1k', subcorpus_id='foo')
        ans = self.plugin.serialize(f)
        data = json.loads(ans)
        self.assertDictEqual(data['corpora'][0], corpus)
        self.assertEqual(data['name'], 'xxx')
        self.assertEqual(data['size'], 100)
        self.assertEqual(data['size_info'], '100')
        self.assertEqual(data['subcorpus_id'], 'foo')

    async def test_get_user_items(self):
        papi = PluginCtx()
        papi.user_id = 7
        item1 = {'size': 150426, 'name': 'susanne - the testing one', 'subcorpus_id': '',
                 'corpora': [{'name': 'A) susanne - the testing one', 'id': 'susanne'}],
                 'id': '6287f558d64ba0e0885d0e89492e457f', 'size_info': '150k'}
        await plugins.runtime.DB.instance.hash_set(
            'favitems:user:7',
            '6287f558d64ba0e0885d0e89492e457f',
            item1
        )
        item2 = {'size': 120748715, 'name': 'SYN2015 (local)', 'subcorpus_id': '',
                 'corpora': [{'name': 'B) SYN2015 (local)', 'id': 'syn2015'}],
                 'id': 'f68842708bb9a89690793106738e8690', 'size_info': '121M'}
        await plugins.runtime.DB.instance.hash_set(
            'favitems:user:7',
            'f68842708bb9a89690793106738e8690',
            item2
        )
        items = await self.plugin.get_user_items(papi)
        self.assertEqual(item1['size'], items[0].size)
        self.assertEqual(item1['size_info'], items[0].size_info)
        self.assertEqual(item1['name'], items[0].name)
        self.assertEqual(item1['subcorpus_id'], items[0].subcorpus_id)
        self.assertEqual(item1['id'], items[0].ident)
        self.assertEqual(item1['corpora'], items[0].corpora)
        self.assertEqual(item2['size'], items[1].size)
        self.assertEqual(item2['size_info'], items[1].size_info)
        self.assertEqual(item2['name'], items[1].name)
        self.assertEqual(item2['subcorpus_id'], items[1].subcorpus_id)
        self.assertEqual(item2['id'], items[1].ident)
        self.assertEqual(item2['corpora'], items[1].corpora)
