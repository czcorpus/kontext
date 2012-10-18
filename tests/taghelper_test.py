import conf
import settings
import unittest

from taghelper import *

class TestTagVariantLoader(unittest.TestCase):
    """
    """

    def test_initialization(self):
        """
        """
        tcg = TagVariantLoader('susanne', 8)
        self.assertEqual('/tmp/tags-cache/susanne', tcg.cache_dir)
        self.assertEqual(file, type(tcg.tags_file))

    def test_calculate_variant(self):
        tcg = TagVariantLoader('susanne', 8)
        ans = tcg.calculate_variant('D-1-----')
        print(ans)

    def test_get_variant(self):
        tcg = TagVariantLoader('susanne', 8)
        ans = tcg.get_variant('D-1-----')
        print(ans)