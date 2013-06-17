# -*- coding: utf-8 -*-
import conf
import settings
import unittest
import conclib

class TestConclibModule(unittest.TestCase):
    """
    """

    def test_remove_speech_struct_from_tag(self):
        """
        """
        s = '<seg foo=123 bar=value soundfile=13035.wav key=value>this <x>is</x> it'
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

        s = '<seg soundfile=1234abc.wav>'
        t1, t2 = conclib.separate_speech_struct_from_tag(s)
        self.assertEquals('<seg>', t1)
        self.assertEquals('1234abc.wav', t2)

    def test_postproc_kwicline_part(self):
        """
        """
        line = (
            {
                'str' : 'lorem ipsum <seg soundfile=123.wav foo=bar>dolor sit</seg><seg> amet...',
                'class' : 'foo'
            },
            {
                'str' : 'consectetur <x>adipisicing elit</x>, sed do eiusmod',
                'class' : 'foo'
            },
            {
                'str' : '<seg soundfile=937.341>',
                'class' : 'foo'
            }
        )

        ans, last_speech_id = conclib.postproc_kwicline_part('syn3000', line, 'left', False)
        self.assertEquals('lorem ipsum ', ans[0]['str'])
        self.assertEquals('937.341', last_speech_id)
        # second item has the string 'soundfile=123.wav' removed
        self.assertEquals('<seg foo=bar>', ans[1]['str'])
        # but the removed value (not the key) is still accessible:
        self.assertEquals(settings.create_speech_url('syn3000', '123.wav'), ans[1]['open_link']['speech_url'])
        self.assertEquals('dolor sit', ans[2]['str'])
        self.assertEquals('</seg>', ans[3]['str'])
        self.assertEquals('<seg>', ans[4]['str'])
        self.assertEquals(' amet...', ans[5]['str'])
        self.assertEquals('consectetur <x>adipisicing elit</x>, sed do eiusmod', ans[6]['str'])

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