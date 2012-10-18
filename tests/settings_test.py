# -*- coding: utf-8 -*-
import conf
import settings
import unittest
import conclib
import mox
import MySQLdb
from MySQLdb import cursors
from MySQLdb import connections

class TestSettingsModule(unittest.TestCase):
    """
    """

    def setUp(self):
        self.mysql_mocker = mox.Mox()
        self.dbcon_mocker = mox.Mox()
        self.dbcursor_mocker = mox.Mox()

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
        self.assertEqual(47, len(data))
        self.assertEqual(tuple, type(data[0]))
        self.assertEqual('syn', data[0][0])
        self.assertEqual(u'/Synchronní psané korpusy/řada SYN/', data[0][1])
        self.assertEqual('http://www.korpus.cz/syn.php', data[0][2])

    def test_get(self):
        """
        """
        # non-existing key and section should return None (i.e. no exceptions here)
        self.assertEqual(None, settings.get('some_section', 'foo135091035'))

        # non-existing key and section with default value forced
        self.assertEqual('bar', settings.get('some_section', 'foo135091035', default='bar'))

        # existing key, existing section
        self.assertEqual(settings.get('database', 'name'), 'bonito')

    def test_corpus_info(self):
        """
        """
        # test existing item
        data = settings.get_corpus_info('SYN2006PUB'.lower())
        self.assertEquals(u'/Synchronní psané korpusy/řada SYN/', data['path'])
        self.assertEquals('http://www.korpus.cz/syn2006pub.php', data['web'])

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

        # default_corpus is in the corplist
        corplist = ['syn2008', 'syn2010', 'omezeni/syn2010', 'syn', 'foo']
        dc = settings.get_default_corpus(corplist)
        self.assertEquals('syn2010', dc)

        # default_corpus is not in the corplist but alternative_corpus is there
        corplist = ['syn2008', 'omezeni/syn2010', 'syn', 'foo']
        dc = settings.get_default_corpus(corplist)
        self.assertEquals('omezeni/syn2010', dc)

    def test_get_corplist(self):
        """
        """
        corplist = settings.get_corplist()
        self.assertEqual('abcd2000', corplist[0])
        self.assertEqual('omezeni/syn2010', corplist[1])
        self.assertEqual('syn', corplist[2])
        self.assertEqual('syn2010', corplist[3])

    def test_user_has_access_to(self):
        """
        """
        self.assertEquals(True, settings.user_has_access_to('syn2010'))
        self.assertEquals(False, settings.user_has_access_to('syn201024309u02'))

    def test_get_user_data(self):
        """
        """
        mysql = self.mysql_mocker.CreateMock(MySQLdb)
        conn = self.dbcon_mocker.CreateMock(connections.Connection)
        cursor = self.dbcursor_mocker.CreateMock(cursors.Cursor)
        conn.cursor().AndReturn(cursor)
        mysql.connection().AndReturn(conn)
        query = "SELECT pass,corplist FROM user WHERE user = %s"
        cursor.execute(query, ('atomik',)).AndReturn(True)
        cursor.fetchone().AndReturn(('my*password', 'syn2010 oral2013 susanne'))

        settings._user = 'atomik'
        user_data = settings.get_user_data()
        print(user_data)