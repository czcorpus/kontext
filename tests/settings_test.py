# Copyright (c) 2012 Czech National Corpus
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

# -*- coding: utf-8 -*-

import unittest
import mox
from MySQLdb import cursors
from MySQLdb import connections

import conf
conf.init()
import settings
import db
import ucnk_auth  # TODO


class TestSettingsModule(unittest.TestCase):
    """
    """

    def setUp(self):
        settings.load('./config.test.xml')
        settings._conf['database']['adapter'] = 'mysql'
        db._adapter = 'mysql'
        settings.auth = ucnk_auth.create_instance(settings)
        self.mysql_mocker = mox.Mox()
        self.dbcon_mocker = mox.Mox()
        self.dbcursor_mocker = mox.Mox()
        self.mox = mox.Mox()

    def test_top_level_structure(self):
        """
        """
        self.assertTrue('global' in settings._conf)
        self.assertTrue('database' in settings._conf)
        self.assertTrue('corpora' in settings._conf)

    def test_corplist_load(self):
        """
        """
        data = settings.get('corpora_hierarchy')
        self.assertEqual(list, type(data))
        self.assertEqual(11, len(data))
        self.assertEqual(dict, type(data[0]))
        self.assertEqual('syn', data[0]['id'])
        self.assertEqual(u'/Synchronní psané korpusy/řada SYN/', data[0]['path'])
        self.assertEqual('http://www.korpus.cz/syn.php', data[0]['web'])

    def test_get(self):
        """
        """
        # non-existing key and section should return None (i.e. no exceptions here)
        self.assertEqual(None, settings.get('some_section', 'foo135091035'))

        # non-existing key and section with default value forced
        self.assertEqual('bar', settings.get('some_section', 'foo135091035', default='bar'))

        # existing key, existing section
        self.assertEqual(settings.get('database', 'name'), 'bonito')

        # whole section
        ans = settings.get('database')
        self.assertEqual(dict, type(ans))
        self.assertEqual('bonito', ans['username'])
        self.assertEqual('localhost', ans['host'])
        self.assertEqual('bonito', ans['password'])
        self.assertEqual('bonito', ans['name'])

    def test_corpus_info(self):
        """
        """
        # test existing item
        data = settings.get_corpus_info('SYN2010'.lower())
        self.assertEquals(u'/Synchronní psané korpusy/řada SYN/', data['path'])
        self.assertEquals('http://www.korpus.cz/syn2010.php', data['web'])

        # test non-existing item
        data = settings.get_corpus_info('foo133235-235')
        self.assertEquals(None, data)

    def test_get_default_corpus(self):
        """
        """
        # neither default_coprus nor alternative_corpus are in the corplist
        corplist = ['foo', 'bar']
        dc = settings.get_default_corpus(corplist)
        self.assertEquals(None, dc)

        # 1st item from <default_corpora> is in the list
        corplist = ['syn2008', 'syn2010', 'omezeni/syn2010', 'syn', 'foo']
        dc = settings.get_default_corpus(corplist)
        self.assertEquals('syn2010', dc)

        # 2nd item from <default_corpora> is in the list
        corplist = ['syn2008', 'omezeni/syn2010', 'syn', 'foo']
        dc = settings.get_default_corpus(corplist)
        self.assertEquals('omezeni/syn2010', dc)

        # 3rd item from <default_corpora> is in the list
        corplist = ['syn2008', 'omezeni/oral2013', 'syn', 'foo']
        dc = settings.get_default_corpus(corplist)
        self.assertEquals('omezeni/oral2013', dc)

    def test_get_corplist(self):
        """
        """
        conn = self.dbcon_mocker.CreateMock(connections.Connection)
        self.mox.StubOutWithMock(db, 'open')
        db.open(settings).AndReturn(None)
        settings.auth.db_conn = conn
        cursor = self.dbcursor_mocker.CreateMock(cursors.Cursor)
        conn.cursor().AndReturn(cursor)

        query = "SELECT corplist FROM user WHERE user LIKE %s"
        cursor.execute(query, ('default', )).AndReturn(True)
        cursor.fetchone().AndReturn(('oral2013 susanne syn syn2010 @magic',))

        query = "SELECT corpora.name FROM corplist,relation,corpora WHERE corplist.id=relation.corplist AND relation.corpora=corpora.id AND corplist.name=%s"
        cursor.execute(query, 'magic').AndReturn(True)
        cursor.fetchall().AndReturn((('foo1', ), ('foo2', ), ('foo3', )))
        cursor.close().AndReturn(None)

        self.mysql_mocker.ReplayAll()
        self.dbcon_mocker.ReplayAll()
        self.dbcursor_mocker.ReplayAll()
        self.mox.ReplayAll()

        # let's fake we are logged in
        db.open(settings)
        settings.auth.user = 'default'
        corplist = settings.auth.get_corplist()
        self.assertEqual(('foo1', 'foo2', 'foo3', 'oral2013', 'susanne', 'syn', 'syn2010'), corplist)

        self.mysql_mocker.VerifyAll()
        self.dbcon_mocker.VerifyAll()
        self.dbcursor_mocker.VerifyAll()
        self.mox.VerifyAll()
        self.mox.UnsetStubs()
        self.mysql_mocker.UnsetStubs()
        self.dbcon_mocker.UnsetStubs()
        self.dbcursor_mocker.UnsetStubs()

    def test_get_user_data(self):
        """
        """
        conn = self.dbcon_mocker.CreateMock(connections.Connection)
        self.mox.StubOutWithMock(db, 'open')
        db.open(settings).AndReturn(None)
        settings.auth.db_conn = conn
        cursor = self.dbcursor_mocker.CreateMock(cursors.Cursor)
        conn.cursor().AndReturn(cursor)

        query = "SELECT user,pass FROM user WHERE user = %s"
        cursor.execute(query, ('atomik',)).AndReturn(True)
        cursor.fetchone().AndReturn(('atomik', 'my*password'))

        cursor.close().AndReturn(None)

        self.mysql_mocker.ReplayAll()
        self.dbcon_mocker.ReplayAll()
        self.dbcursor_mocker.ReplayAll()
        self.mox.ReplayAll()

        db.open(settings)
        settings.auth.validate_user('atomik', '')

        self.mysql_mocker.VerifyAll()
        self.dbcon_mocker.VerifyAll()
        self.dbcursor_mocker.VerifyAll()
        self.mox.VerifyAll()
        self.mysql_mocker.UnsetStubs()
        self.dbcon_mocker.UnsetStubs()
        self.dbcursor_mocker.UnsetStubs()
        self.mox.UnsetStubs()

    def test_fq(self):
        """
        """
        db._adapter = 'mysql'
        q = db.fq('SELECT * FROM foo WHERE name = %(p)s')
        self.assertEqual('SELECT * FROM foo WHERE name = %s', q)

        db._adapter = 'sqlite'
        q = db.fq('SELECT * FROM foo WHERE name = %(p)s')
        self.assertEqual('SELECT * FROM foo WHERE name = ?', q)

    def test_administrators_parsing(self):
        """
        """
        tmp = settings.get('global', 'administrators')
        self.assertEqual('user_1', tmp[0])
        self.assertEqual('user_2', tmp[1])
        self.assertEqual(2, len(tmp))

    def test_administrators_empty(self):
        """
        """
        settings.load('./config.test-2.xml')
        self.assertEqual(None, settings.get('global', 'administrators'))