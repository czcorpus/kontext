# -*- coding: utf-8 -*-
import os

import unittest
import mox
from MySQLdb import cursors
from MySQLdb import connections

import conf
conf.init()
import settings


class TestSettingsModule(unittest.TestCase):
    """
    """

    def setUp(self):
        settings._conf['database']['adapter'] = 'mysql'
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
        self.mox.StubOutWithMock(settings, 'create_db_connection')
        settings.create_db_connection().AndReturn(conn)

        cursor = self.dbcursor_mocker.CreateMock(cursors.Cursor)
        conn.cursor().AndReturn(cursor)

        query = "SELECT corplist, sketches FROM user WHERE user LIKE %s"
        cursor.execute(query, ('default', )).AndReturn(True)
        cursor.fetchone().AndReturn(('oral2013 susanne syn syn2010',))

        cursor.close().AndReturn(None)
        conn.close().AndReturn(None)

        self.mysql_mocker.ReplayAll()
        self.dbcon_mocker.ReplayAll()
        self.dbcursor_mocker.ReplayAll()
        self.mox.ReplayAll()

        corplist = settings.get_corplist()
        self.assertEqual('oral2013', corplist[0])
        self.assertEqual('susanne', corplist[1])
        self.assertEqual('syn', corplist[2])
        self.assertEqual('syn2010', corplist[3])

        self.mysql_mocker.VerifyAll()
        self.dbcon_mocker.VerifyAll()
        self.dbcursor_mocker.VerifyAll()
        self.mox.VerifyAll()
        self.mox.UnsetStubs()

    def test_user_has_access_to(self):
        """
        """
        self.assertEquals(True, settings.user_has_access_to('syn2010'))
        self.assertEquals(False, settings.user_has_access_to('syn201024309u02'))

    def test_get_user_data(self):
        """
        """
        conn = self.dbcon_mocker.CreateMock(connections.Connection)
        self.mox.StubOutWithMock(settings, 'create_db_connection')
        settings.create_db_connection().AndReturn(conn)

        cursor = self.dbcursor_mocker.CreateMock(cursors.Cursor)
        conn.cursor().AndReturn(cursor)

        query = "SELECT pass,corplist FROM user WHERE user = %s"
        cursor.execute(query, ('atomik',)).AndReturn(True)
        cursor.fetchone().AndReturn(('my*password', 'syn2010 oral2013 susanne'))

        cursor.close().AndReturn(None)
        conn.close().AndReturn(None)

        self.mysql_mocker.ReplayAll()
        self.dbcon_mocker.ReplayAll()
        self.dbcursor_mocker.ReplayAll()
        self.mox.ReplayAll()

        settings._user = 'atomik'
        user_data = settings.get_user_data()
        self.assertEqual('syn2010 oral2013 susanne', user_data['corplist'])
        self.assertEqual('my*password', user_data['pass'])

        self.mysql_mocker.VerifyAll()
        self.dbcon_mocker.VerifyAll()
        self.dbcursor_mocker.VerifyAll()
        self.mox.VerifyAll()
        self.mox.UnsetStubs()

    def test_fq(self):
        """
        """
        settings._conf['database']['adapter'] = 'mysql'
        q = settings.fq('SELECT * FROM foo WHERE name = %(p)s')
        self.assertEqual('SELECT * FROM foo WHERE name = %s', q)

        settings._conf['database']['adapter'] = 'sqlite'
        q = settings.fq('SELECT * FROM foo WHERE name = %(p)s')
        self.assertEqual('SELECT * FROM foo WHERE name = ?', q)