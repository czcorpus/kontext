import unittest
import sys
sys.path.append('./mocks')

import settings
settings.load('../config.ini')
import conclib

class TestConclibModule(unittest.TestCase):
    """
    """

    def test_remove_speech_struct_from_tag(self):
        """
        """
        s = '<seg foo=123 bar=value speechfile=13035.wav key=value>this <x>is</x> it'
        t1, t2 = conclib.separate_speech_struct_from_tag(s)
        self.assertEquals('<seg foo=123 bar=value key=value>this <x>is</x> it', t1)
        self.assertEquals('13035.wav', t2)

        s = ''
        t1, t2 = conclib.separate_speech_struct_from_tag(s)
        self.assertEquals('', t1)
        self.assertEquals('', t2)

        s = None
        self.assertRaises(TypeError, conclib.separate_speech_struct_from_tag, s)

        s = '<seg>'
        t1, t2 = conclib.separate_speech_struct_from_tag(s)
        self.assertEquals('<seg>', t1)
        self.assertEquals('', t2)

        s = '<seg speechfile=1234abc.wav>'
        t1, t2 = conclib.separate_speech_struct_from_tag(s)
        self.assertEquals('<seg>', t1)
        self.assertEquals('1234abc.wav', t2)

    def test_postproc_kwicline(self):
        """
        """
        line = (
            {
                'str' : 'lorem ipsum <seg speechfile=123.wav foo=bar>dolor sit</seg><seg> amet</seg> ...',
                'class' : 'foo'
            },
            {
                'str' : 'consectetur <x>adipisicing elit</x>, sed do eiusmod',
                'class' : 'foo'
            }
        )

        ans = conclib.postproc_kwicline(line)

        self.assertEquals('lorem ipsum ', ans[0]['str'])
        # second item has the string 'speechfile=123.wav' removed
        self.assertEquals('<seg foo=bar>dolor sit</seg>', ans[1]['str'])
        # but the removed value (not the key) is still accessible:
        self.assertEquals('123.wav', ans[1]['speech_id'])
        self.assertEquals('<seg> amet</seg> ...', ans[2]['str'])
        self.assertEquals('consectetur <x>adipisicing elit</x>, sed do eiusmod', ans[3]['str'])