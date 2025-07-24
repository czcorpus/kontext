# Copyright (c) 2014  Charles University, Faculty of Arts,
#                     Department of Linguistics
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

"""
This module contains localization-related helper functions:

* number formatting
* date and time formatting
* string encoding (used mainly to ensure utf-8 is used even if
  Manatee uses a corpus with different encoding)

There are two important facts to consider when dealing with
internationalisation of KonText:

1. In WSGI environment, standard 'locale' cannot be used as
   it works per-process while WSGI typically operates in multi-threaded mode.
2. Manatee module contains method set_encoding() but it is module-global
   which is useless in multi-threaded environment as multiple requests are
   processed using the same module.
"""

from functools import cmp_to_key
from threading import local
from typing import Any, Dict

try:
    from icu import Collator, Locale
except ImportError:
    import locale

    # ignoring mypy error: Name 'Locale' already defined (possibly by an import)
    class Locale(object):  # type: ignore
        def __init__(self, *args, **kwargs):
            pass

    # ignoring mypy error: Name 'Collator' already defined (possibly by an import)
    class Collator(object):  # type: ignore
        def __init__(self, locale):
            self.locale = locale

        def compare(self, s1, s2):
            return locale.strcoll(s1, s2)

        @staticmethod
        def createInstance(locale):
            return Collator(locale)


_formats: Dict[str, Any] = {}  # contains lang_code -> Formatter() pairs
_current = local()  # thread-local variable stores per-request formatter


def sort(iterable, loc, key=None, reverse=False):
    """
    Creates new sorted list from passed list (or any iterable data) according to the passed locale.

    arguments:
    iterable -- iterable object (typically a list or a tuple)
    loc -- locale identifier (e.g. cs_CZ.UTF-8, en_US,...)
    key -- access to sorted value
    reverse -- whether the result should be in reversed order (default is False)
    """
    if not loc:
        loc = 'en_US'
    collator = Collator.createInstance(Locale(loc))
    if key is None:
        kf = cmp_to_key(collator.compare)
    else:
        def tmp(v1, v2):
            return collator.compare(key(v1), key(v2))
        kf = cmp_to_key(tmp)
    return sorted(iterable, key=kf, reverse=reverse)


def time_formatting():
    """
    Returns a time formatting string (as used by time.strftime)
    according to the currently selected formats.json.
    """
    return _current.formatter.conf.get('time')


def camelize(s):
    """
    Converts underscore-separated identifier into a camel-case one
    (e.g. foo_and_bar will become fooAndBar)

    TODO - this function should be located in a more appropriate module
    """
    a = [x for x in s.split('_') if len(x) > 0]
    if len(a) == 0:
        return ''
    return a[0] + ''.join([x[0].upper() + x[1:] for x in a[1:]])


def simplify_num(v):
    for s, thr in [('{:.3g}T', 1e12), ('{:.3g}G', 1e9), ('{:.3g}M', 1e6), ('{:.3g}k', 1e3)]:
        if v >= thr:
            return s.format(v / thr)
    return '{:.0f}'.format(round(v / 1e2, 0) * 100,)


def desimplify_num(v, strict=True):
    v = str(v)
    correct_suffs = ('k', 'M', 'G', 'T')
    if v[-1].isalpha():
        if strict and v[-1] not in correct_suffs:
            raise Exception('Unknown number suffix: %s' % v[-1])
        x = {'k': 1e3, 'm': 1e6, 'g': 1e9, 't': 1e12}.get(v[-1].lower(), None)
        if x is None:
            x = 1
        return int(v[:-1]) * x
    else:
        return int(v)



_languages = [
    ('Abkhazian', 'ab', 'abk'),
    ('Afar', 'aa', 'aar'),
    ('Afrikaans', 'af', 'afr'),
    ('Akan', 'ak', 'aka'),
    ('Albanian', 'sq', 'sqi'),
    ('Amharic', 'am', 'amh'),
    ('Arabic', 'ar', 'ara'),
    ('Armenian', 'hy', 'hye'),
    ('Assamese', 'as', 'asm'),
    ('Avaric', 'av', 'ava'),
    ('Aymara', 'ay', 'aym'),
    ('Azerbaijani', 'az', 'aze'),
    ('Bambara', 'bm', 'bam'),
    ('Bashkir', 'ba', 'bak'),
    ('Basque', 'eu', 'eus'),
    ('Belarusian', 'be', 'bel'),
    ('Bengali', 'bn', 'ben'),
    ('Bislama', 'bi', 'bis'),
    ('Bosnian', 'bs', 'bos'),
    ('Breton', 'br', 'bre'),
    ('Bulgarian', 'bg', 'bul'),
    ('Burmese', 'my', 'mya'),
    ('Catalan', 'ca', 'cat'),
    ('Chamorro', 'ch', 'cha'),
    ('Chechen', 'ce', 'che'),
    ('Chinese', 'zh', 'zho'),
    ('Cornish', 'kw', 'cor'),
    ('Croatian', 'hr', 'hrv'),
    ('Czech', 'cs', 'ces'),
    ('Danish', 'da', 'dan'),
    ('Dhivehi', 'dv', 'div'),
    ('Dutch', 'nl', 'nld'),
    ('Dzongkha', 'dz', 'dzo'),
    ('English', 'en', 'eng'),
    ('Estonian', 'et', 'est'),
    ('Ewe', 'ee', 'ewe'),
    ('Faroese', 'fo', 'fao'),
    ('Fijian', 'fj', 'fij'),
    ('Finnish', 'fi', 'fin'),
    ('French', 'fr', 'fra'),
    ('Fulah', 'ff', 'ful'),
    ('Galician', 'gl', 'glg'),
    ('Ganda', 'lg', 'lug'),
    ('Georgian', 'ka', 'kat'),
    ('German', 'de', 'deu'),
    ('Guarani', 'gn', 'grn'),
    ('Gujarati', 'gu', 'guj'),
    ('Haitian', 'ht', 'hat'),
    ('Hausa', 'ha', 'hau'),
    ('Hebrew', 'he', 'heb'),
    ('Hindi', 'hi', 'hin'),
    ('Hiri Motu', 'ho', 'hmo'),
    ('Hungarian', 'hu', 'hun'),
    ('Icelandic', 'is', 'isl'),
    ('Igbo', 'ig', 'ibo'),
    ('Indonesian', 'id', 'ind'),
    ('Irish', 'ga', 'gle'),
    ('Italian', 'it', 'ita'),
    ('Japanese', 'ja', 'jpn'),
    ('Javanese', 'jv', 'jav'),
    ('Kalaallisut', 'kl', 'kal'),
    ('Kannada', 'kn', 'kan'),
    ('Kashmiri', 'ks', 'kas'),
    ('Kazakh', 'kk', 'kaz'),
    ('Central Khmer', 'km', 'khm'),
    ('Kikuyu', 'ki', 'kik'),
    ('Kinyarwanda', 'rw', 'kin'),
    ('Kirghiz', 'ky', 'kir'),
    ('Kongo', 'kg', 'kon'),
    ('Korean', 'ko', 'kor'),
    ('Kuanyama', 'kj', 'kua'),
    ('Kurdish', 'ku', 'kur'),
    ('Lao', 'lo', 'lao'),
    ('Latin', 'la', 'lat'),
    ('Latvian', 'lv', 'lav'),
    ('Lingala', 'ln', 'lin'),
    ('Lithuanian', 'lt', 'lit'),
    ('Luba-Katanga', 'lu', 'lub'),
    ('Luxembourgish', 'lb', 'ltz'),
    ('Macedonian', 'mk', 'mkd'),
    ('Malagasy', 'mg', 'mlg'),
    ('Malay (macrolanguage)', 'ms', 'msa'),
    ('Malayalam', 'ml', 'mal'),
    ('Maltese', 'mt', 'mlt'),
    ('Manx', 'gv', 'glv'),
    ('Maori', 'mi', 'mri'),
    ('Marathi', 'mr', 'mar'),
    ('Marshallese', 'mh', 'mah'),
    ('Modern Greek (1453-)', 'el', 'ell'),
    ('Mongolian', 'mn', 'mon'),
    ('Nauru', 'na', 'nau'),
    ('Northern Sami', 'se', 'sme'),
    ('North Ndebele', 'nd', 'nde'),
    ('Norwegian Bokmål', 'nb', 'nob'),
    ('Norwegian Nynorsk', 'nn', 'nno'),
    ('Nyanja', 'ny', 'nya'),
    ('Occitan (post 1500)', 'oc', 'oci'),
    ('Oriya (macrolanguage)', 'or', 'ori'),
    ('Oromo', 'om', 'orm'),
    ('Ossetian', 'os', 'oss'),
    ('Pushto', 'ps', 'pus'),
    ('Persian', 'fa', 'fas'),
    ('Polish', 'pl', 'pol'),
    ('Portuguese', 'pt', 'por'),
    ('Panjabi', 'pa', 'pan'),
    ('Quechua', 'qu', 'que'),
    ('Romanian', 'ro', 'ron'),
    ('Romansh', 'rm', 'roh'),
    ('Russian', 'ru', 'rus'),
    ('Samoan', 'sm', 'smo'),
    ('Sango', 'sg', 'sag'),
    ('Sanskrit', 'sa', 'san'),
    ('Scottish Gaelic', 'gd', 'gla'),
    ('Serbian', 'sr', 'srp'),
    ('Shona', 'sn', 'sna'),
    ('Sichuan Yi', 'ii', 'iii'),
    ('Sindhi', 'sd', 'snd'),
    ('Sinhala', 'si', 'sin'),
    ('Slovak', 'sk', 'slk'),
    ('Slovenian', 'sl', 'slv'),
    ('Somali', 'so', 'som'),
    ('Southern Sotho', 'st', 'sot'),
    ('South Ndebele', 'nr', 'nbl'),
    ('Spanish', 'es', 'spa'),
    ('Swahili (macrolanguage)', 'sw', 'swa'),
    ('Swati', 'ss', 'ssw'),
    ('Swedish', 'sv', 'swe'),
    ('Tahitian', 'ty', 'tah'),
    ('Tajik', 'tg', 'tgk'),
    ('Tamil', 'ta', 'tam'),
    ('Tatar', 'tt', 'tat'),
    ('Telugu', 'te', 'tel'),
    ('Thai', 'th', 'tha'),
    ('Tibetan', 'bo', 'bod'),
    ('Tigrinya', 'ti', 'tir'),
    ('Tonga (Tonga Islands)', 'to', 'ton'),
    ('Tsonga', 'ts', 'tso'),
    ('Tswana', 'tn', 'tsn'),
    ('Turkish', 'tr', 'tur'),
    ('Turkmen', 'tk', 'tuk'),
    ('Uighur', 'ug', 'uig'),
    ('Ukrainian', 'uk', 'ukr'),
    ('Urdu', 'ur', 'urd'),
    ('Uzbek', 'uz', 'uzb'),
    ('Venda', 've', 'ven'),
    ('Vietnamese', 'vi', 'vie'),
    ('Welsh', 'cy', 'cym'),
    ('Western Frisian', 'fy', 'fry'),
    ('Wolof', 'wo', 'wol'),
    ('Xhosa', 'xh', 'xho'),
    ('Yoruba', 'yo', 'yor'),
    ('Zhuang', 'za', 'zha'),
    ('Zulu', 'zu', 'zul')
]

def get_lang_code(name: str = None, a2: str = None, a3: str = None):
    for s_name, s_a2, s_a3 in _languages:
        if (name is None or s_name == name) and (a2 is None or s_a2 == a2) and (a3 is None or s_a3 == a3):
            return s_name, s_a2, s_a3
    return None, None, None