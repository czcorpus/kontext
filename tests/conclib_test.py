import unittest
import sys
sys.path.append('./mocks')

import settings
settings.load('../config.test.ini')
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
                'str' : 'lorem ipsum <seg speechfile=123.wav foo=bar>dolor sit</seg><seg> amet ...',
                'class' : 'foo'
            },
            {
                'str' : 'consectetur <x>adipisicing elit</x>, sed do eiusmod',
                'class' : 'foo'
            },
            {
                'str' : '<seg speechfile=937.341>',
                'class' : 'foo'
            }
        )

        ans = conclib.postproc_kwicline(line, False)
        self.assertEquals('lorem ipsum ', ans[0]['str'])
        # second item has the string 'speechfile=123.wav' removed
        self.assertEquals('<seg foo=bar>dolor sit</seg>', ans[1]['str'])
        # but the removed value (not the key) is still accessible:
        self.assertEquals('123.wav', ans[1]['open_link']['speech_id'])
        self.assertEquals('<seg> amet ...', ans[2]['str'])
        self.assertEquals('consectetur <x>adipisicing elit</x>, sed do eiusmod', ans[3]['str'])

    def test_remove_tag_from_line(self):
        """
        """
        line = [{}]
        line[0]['str'] = "lorem ipsum <seg time=342 date=12.12.2012>dolor sit amet</seg> and stuff like that </seg>"
        line.append({
            'str' : '<seg>'
            })
        ans = conclib.remove_tag_from_line(line, 'seg')
        self.assertEqual('lorem ipsum dolor sit amet and stuff like that ', ans[0]['str'])
        self.assertEqual('', ans[1]['str'])

        text = ''
        ans = conclib.remove_tag_from_line(text, 'seg')
        self.assertEqual('', ans)

        text = None
        self.assertRaises(TypeError, conclib.remove_tag_from_line, text)