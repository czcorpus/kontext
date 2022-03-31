# Copyright(c) 2013 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

from dataclasses import dataclass
from typing import Any, Dict, List, NamedTuple, Optional, Tuple
import math

import kwiclib
from corplib.corpus import KCorpus
from conclib.search import get_conc
from action.props import ActionProps
from action.krequest import KRequest
from action.response import KResponse
from action.model.user import UserActionModel
from texttypes.cache import TextTypesCache
import plugins
import settings


@dataclass
class FCSResourceInfo:
    title: str
    landingPageURI: str
    language: str
    description: str


class FCSCorpusInfo(NamedTuple):
    corpus_id: str
    corpus_title: str
    resource_info: FCSResourceInfo


class FCSSearchRow(NamedTuple):
    left: str
    kwic: str
    right: str
    ref: str


@dataclass
class FCSSearchResult:
    rows: List[FCSSearchRow]
    size: int


class FCSActionModel(UserActionModel):
    """
    An action controller providing services related to the Federated Content Search support
    """

    def __init__(
            self, req: KRequest, resp: KResponse, action_props: ActionProps, tt_cache: TextTypesCache):
        super().__init__(req, resp, action_props, tt_cache)
        self.search_attrs = settings.get('fcs', 'search_attributes', ['word'])

    def check_args(self, supported_default: List[str], supported: List[str]) -> Optional[Exception]:
        supported_default.extend(supported)
        unsupported_args = set(self._req.args.keys()) - set(supported_default)
        if 0 < len(unsupported_args):
            raise Exception(8, list(unsupported_args)[0], 'Unsupported parameter')

    async def corpora_info(self, value: str, max_items: int) -> List[FCSCorpusInfo]:
        resources: List[Tuple[str, str, Dict[str, Any]]] = []
        corpora_d = [value]
        if value == 'root':
            corpora_d = await plugins.runtime.AUTH.instance.permitted_corpora(
                self.session_get('user')
            )

        for i, corpus_id in enumerate(corpora_d):
            if i >= max_items:
                break
            resource_info: Dict[str, Any] = {}
            c = self.cm.get_corpus(corpus_id)
            corpus_title: str = c.get_conf('NAME')
            resource_info = FCSResourceInfo(
                corpus_title,
                c.get_conf('INFOHREF'),
                # TODO(jm) - Languages copied (and slightly fixed) from 0.5 - should be checked
                Languages.get_iso_code(c.get_conf('LANGUAGE')),
                c.get_conf('INFO'),
            )
            resources.append(FCSCorpusInfo(corpus_id, corpus_title, resource_info))
        return resources

    async def fcs_search(self, corp: KCorpus, corpname: str, fcs_query: str, max_rec: int, start: int) -> FCSSearchResult:
        """
        aux function for federated content search: operation=searchRetrieve
        """
        query = fcs_query.replace('+', ' ')  # convert URL spaces
        exact_match = True  # attr=".*value.*"
        if 'exact' in query.lower() and '=' not in query:  # lemma EXACT "dog"
            pos = query.lower().index('exact')  # first occurrence of EXACT
            query = query[:pos] + '=' + query[pos + 5:]  # 1st exact > =
            exact_match = True

        attrs = corp.get_posattrs()  # list of available attrs
        try:  # parse query
            if '=' in query:  # lemma=word | lemma="word" | lemma="w1 w2" | word=""
                attr, term = query.split('=')
                attr = attr.strip()
                term = term.strip()
            else:  # "w1 w2" | "word" | word
                attr = 'word'
                # use one of search attributes if in corpora attributes
                # otherwise use `word` - fails below if not valid
                for sa in self.search_attrs:
                    if sa in attrs:
                        attr = sa
                        break
                term = query.strip()
            if '"' in attr:
                raise Exception
            if '"' in term:  # "word" | "word1 word2" | "" | "it is \"good\""
                if term[0] != '"' or term[-1] != '"':  # check q. marks
                    raise Exception
                term = term[1:-1].strip()  # remove quotation marks
                if ' ' in term:  # multi-word term
                    if exact_match:
                        rq = ' '.join(f'[{attr}="{t}"]' for t in term.split())
                    else:
                        rq = ' '.join(f'[{attr}=".*{t}.*"]' for t in term.split())
                elif term.strip() == '':  # ""
                    raise Exception  # empty term
                else:  # one-word term
                    if exact_match:
                        rq = f'[{attr}="{term}"]'
                    else:
                        rq = f'[{attr}=".*{term}.*"]'
            else:  # must be single-word term
                if ' ' in term:
                    raise Exception
                if exact_match:  # build query
                    rq = f'[{attr}="{term}"]'
                else:
                    rq = f'[{attr}=".*{term}.*"]'
        except:  # there was a problem when parsing
            raise Exception(10, query, 'Query syntax error')
        if attr not in attrs:
            raise Exception(16, attr, 'Unsupported index')

        fromp = int(math.floor((start - 1) / max_rec)) + 1
        # try to get concordance
        try:
            anon_id = plugins.runtime.AUTH.instance.anonymous_user()['id']
            q = ['q' + rq]
            conc = await get_conc(corp, anon_id, q=q, fromp=fromp, pagesize=max_rec, asnc=0)
        except Exception as e:
            raise Exception(10, repr(e), 'Query syntax error')

        kwic = kwiclib.Kwic(corp, corpname, conc)
        kwic_args = kwiclib.KwicPageArgs({'structs': ''}, base_attr=self.BASE_ATTR)
        kwic_args.fromp = fromp
        kwic_args.pagesize = max_rec
        kwic_context = settings.get_int('fcs', 'kwic_context', 5)
        kwic_args.leftctx = f'-{kwic_context}'
        kwic_args.rightctx = f'{kwic_context}'
        page = kwic.kwicpage(kwic_args)  # convert concordance

        local_offset = (start - 1) % max_rec
        if start - 1 > conc.size():
            raise Exception(61, 'startRecord', 'First record position out of range')
        rows = [
            FCSSearchRow(
                kwicline['Left'][0]['str'],
                kwicline['Kwic'][0]['str'],
                kwicline['Right'][0]['str'],
                kwicline['ref']
            )
            for kwicline in page['Lines']
        ][local_offset:local_offset + max_rec]
        return FCSSearchResult(rows, conc.size())


class Languages:
    """
    Class wrapping conversion maps between language name and ISO 639-3 three letter language codes
    """
    language2iso = {
        'Abkhazian': 'abk',
        'Adyghe': 'ady',
        'Afar': 'aar',
        'Afrikaans': 'afr',
        'Aghem': 'agq',
        'Akan': 'aka',
        'Albanian': 'sqi',
        'Amharic': 'amh',
        'Ancient Greek': 'grc',
        'Arabic': 'ara',
        'Armenian': 'hye',
        'Assamese': 'asm',
        'Asturian': 'ast',
        'Asu': 'asa',
        'Atsam': 'cch',
        'Avaric': 'ava',
        'Aymara': 'aym',
        'Azerbaijani': 'aze',
        'Bafia': 'ksf',
        'Bambara': 'bam',
        'Bashkir': 'bak',
        'Basque': 'eus',
        'Belarusian': 'bel',
        'Bemba': 'bem',
        'Bena': 'yun',
        'Bengali': 'ben',
        'Bislama': 'bis',
        'Blin': 'byn',
        'Bodo': 'boy',
        'Bosnian': 'bos',
        'Breton': 'bre',
        'Bulgarian': 'bul',
        'Burmese': 'mya',
        'Catalan': 'cat',
        'Cebuano': 'ceb',
        'Chamorro': 'cha',
        'Chechen': 'che',
        'Cherokee': 'chr',
        'Chiga': 'cgg',
        'Chinese': 'zho',
        'Chuukese': 'chk',
        'Congo Swahili': 'swc',
        'Cornish': 'cor',
        'Croatian': 'hrv',
        'Czech': 'ces',
        'Danish': 'dan',
        'Divehi': 'div',
        'Duala': 'dua',
        'Dutch': 'nld',
        'Dzongkha': 'dzo',
        'Efik': 'efi',
        'Embu': 'ebu',
        'English': 'eng',
        'Erzya': 'myv',
        'Estonian': 'est',
        'Ewe': 'ewe',
        'Ewondo': 'ewo',
        'Faroese': 'fao',
        'Fijian': 'fij',
        'Filipino': 'fil',
        'Finnish': 'fin',
        'French': 'fra',
        'Friulian': 'fur',
        'Fulah': 'ful',
        'Gagauz': 'gag',
        'Galician': 'glg',
        'Ganda': 'lug',
        'Georgian': 'kat',
        'German': 'deu',
        'Gilbertese': 'gil',
        'Guarani': 'grn',
        'Gujarati': 'guj',
        'Gusii': 'guz',
        'Haitian': 'hat',
        'Hausa': 'hau',
        'Hawaiian': 'haw',
        'Hebrew': 'heb',
        'Hiligaynon': 'hil',
        'Hindi': 'hin',
        'Hiri Motu': 'hmo',
        'Hungarian': 'hun',
        'Icelandic': 'isl',
        'Igbo': 'ibo',
        'Iloko': 'ilo',
        'Indonesian': 'ind',
        'Ingush': 'inh',
        'Irish': 'gle',
        'Italian': 'ita',
        'Japanese': 'jpn',
        'Javanese': 'jav',
        'Jju': 'kaj',
        'Jola-Fonyi': 'dyo',
        'Kabardian': 'kbd',
        'Kabuverdianu': 'kea',
        'Kabyle': 'kab',
        'Kalaallisut': 'kal',
        'Kalenjin': 'kln',
        'Kamba': 'kam',
        'Kannada': 'kan',
        'Karachay-Balkar': 'krc',
        'Kashmiri': 'kas',
        'Kazakh': 'kaz',
        'Khasi': 'kha',
        'Khmer': 'khm',
        'Kikuyu': 'kik',
        'Kinyarwanda': 'kin',
        'Kirghiz': 'kir',
        'Komi-Permyak': 'koi',
        'Komi-Zyrian': 'kpv',
        'Kongo': 'kon',
        'Konkani': 'knn',
        'Korean': 'kor',
        'Kosraean': 'kos',
        'Koyraboro Senni': 'ses',
        'Koyra Chiini': 'khq',
        'Kpelle': 'kpe',
        'Kuanyama': 'kua',
        'Kumyk': 'kum',
        'Kurdish': 'kur',
        'Kwasio': 'nmg',
        'Lahnda': 'lah',
        'Lak': 'lbe',
        'Langi': 'lag',
        'Lao': 'lao',
        'Latin': 'lat',
        'Latvian': 'lav',
        'Lezghian': 'lez',
        'Lingala': 'lin',
        'Lithuanian': 'lit',
        'Low German': 'nds',
        'Luba-Katanga': 'lub',
        'Luba-Lulua': 'lua',
        'Luo': 'luo',
        'Luxembourgish': 'ltz',
        'Luyia': 'luy',
        'Macedonian': 'mkd',
        'Machame': 'jmc',
        'Maguindanaon': 'mdh',
        'Maithili': 'mai',
        'Makhuwa-Meetto': 'mgh',
        'Makonde': 'kde',
        'Malagasy': 'mlg',
        'Malay': 'msa',
        'Malayalam': 'mal',
        'Maltese': 'mlt',
        'Manx': 'glv',
        'Maori': 'mri',
        'Marathi': 'mar',
        'Marshallese': 'mah',
        'Masai': 'mas',
        'Meru': 'mer',
        'Modern Greek': 'ell',
        'Moksha': 'mdf',
        'Mongolian': 'mon',
        'Morisyen': 'mfe',
        'Nama': 'nmx',
        'Nauru': 'nau',
        'Nepali': 'npi',
        'Niuean': 'niu',
        'Northern Sami': 'sme',
        'Northern Sotho': 'nso',
        'North Ndebele': 'nde',
        'Norwegian Bokmål': 'nob',
        'Norwegian Nynorsk': 'nno',
        'Nuer': 'nus',
        'Nyanja': 'nya',
        'Nyankole': 'nyn',
        'Occitan': 'oci',
        'Oriya': 'ori',
        'Oromo': 'orm',
        'Ossetic': 'oss',
        'Palauan': 'pau',
        'Pangasinan': 'pag',
        'Papiamento': 'pap',
        'Pashto': 'pus',
        'Persian': 'fas',
        'Pohnpeian': 'pon',
        'Polish': 'pol',
        'Portuguese': 'por',
        'Punjabi': 'pan',
        'Quechua': 'que',
        'Romanian': 'ron',
        'Romansh': 'roh',
        'Rombo': 'rof',
        'Russian': 'rus',
        'Rwa': 'rwk',
        'Saho': 'ssy',
        'Samburu': 'saq',
        'Samoan': 'smo',
        'Sango': 'sag',
        'Sangu': 'sbp',
        'Sanskrit': 'san',
        'Santali': 'sat',
        'Scottish Gaelic': 'gla',
        'Sena': 'seh',
        'Serbian': 'srp',
        'Shambala': 'ksb',
        'Shona': 'sna',
        'Sichuan Yi': 'iii',
        'Sidamo': 'sid',
        'Sindhi': 'snd',
        'Sinhala': 'sin',
        'Slovak': 'slk',
        'Slovenian': 'slv',
        'Soga': 'xog',
        'Somali': 'som',
        'Southern Sotho': 'sot',
        'South Ndebele': 'nbl',
        'Spanish': 'spa',
        'Swahili': 'swa',
        'Swati': 'ssw',
        'Swedish': 'swe',
        'Swiss German': 'gsw',
        'Tachelhit': 'shi',
        'Tahitian': 'tah',
        'Taita': 'dav',
        'Tajik': 'tgk',
        'Tamil': 'tam',
        'Taroko': 'trv',
        'Tasawaq': 'twq',
        'Tatar': 'tat',
        'Tausug': 'tsg',
        'Telugu': 'tel',
        'Teso': 'teo',
        'Tetum': 'tet',
        'Thai': 'tha',
        'Tibetan': 'bod',
        'Tigre': 'tig',
        'Tigrinya': 'tir',
        'Tokelau': 'tkl',
        'Tok Pisin': 'tpi',
        'Tonga': 'ton',
        'Tsonga': 'tso',
        'Tswana': 'tsn',
        'Turkish': 'tur',
        'Turkmen': 'tuk',
        'Tuvalu': 'tvl',
        'Tuvinian': 'tyv',
        'Tyap': 'kcg',
        'Udmurt': 'udm',
        'Uighur': 'uig',
        'Ukrainian': 'ukr',
        'Ulithian': 'uli',
        'Urdu': 'urd',
        'Uzbek': 'uzb',
        'Vai': 'vai',
        'Venda': 'ven',
        'Vietnamese': 'vie',
        'Vunjo': 'vun',
        'Walser': 'wae',
        'Waray': 'wrz',
        'Welsh': 'cym',
        'Western Frisian': 'fry',
        'Wolof': 'wol',
        'Xhosa': 'xho',
        'Yangben': 'yav',
        'Yapese': 'yap',
        'Yoruba': 'yor',
        'Zarma': 'dje',
        'Zhuang': 'zha',
        'Zulu': 'zul'
    }

    @staticmethod
    def get_iso_code(language: str) -> str:
        try:
            return Languages.language2iso[language]
        except KeyError:
            return ''
