# coding=utf-8
from collections import defaultdict
import random
from typing import Dict, List, Any, Tuple
from controller.errors import CorpusForbiddenException
import kwiclib
from controller.kontext import Kontext
from controller import exposed
from conclib.search import get_conc
import plugins
from plugins.abstract.corpora import CorpusInfo
import settings
import urllib.parse
import logging
import math
from manatee import Corpus
import corplib


_logger = logging.getLogger(__name__)


class FCSError(Exception):
    def __init__(self, code: int, ident: str, msg: str):
        self.code = code
        self.ident = ident
        self.msg = msg


class Actions(Kontext):
    """
    An action controller providing services related to the Federated Content Search support
    """

    BASE_ARGS = ['operation', 'stylesheet', 'version', 'extraRequestData']

    def __init__(self, request, ui_lang, tt_cache):
        """
        arguments:
        request -- Werkzeug's request object
        ui_lang -- a language code in which current action's result will be presented
        """
        super(Actions, self).__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self.search_attrs = settings.get('fcs', 'search_attributes', ['word'])

    def get_mapping_url_prefix(self):
        """
        This is required as it maps the controller to request URLs. In this case,
        all the requests of the form /fcs/[action name]?[parameters] are mapped here.
        """
        return '/fcs/'

    def check_args(self, req, specific_args: List[str]):
        allowed = self.BASE_ARGS + specific_args
        for arg in req.args.keys():
            if arg not in allowed:
                raise FCSError(8, arg, 'Unsupported parameter')

    def corpora_info(self, value: str, max_items: int) -> List[Dict[str, Any]]:
        resources: List[Dict[str, Any]] = []
        if value == 'root':
            corpora_d = settings.get('fcs', 'corpora')
        else:
            corpora_d = [value]

        with plugins.runtime.CORPARCH as ca:
            for i, corpus_id in list(enumerate(corpora_d))[:max_items]:
                cinfo = self.get_corpus_info(corpus_id)
                if cinfo.manatee.lang:
                    lang_code = Languages.get_iso_code(cinfo.manatee.lang)
                else:
                    lang_code = cinfo.collator_locale.split('_')[0]
                resources.append(
                    dict(
                        pid=cinfo.id,
                        title=corpus_id,
                        description=cinfo.localized_desc('en'),
                        landing_page_uri=cinfo.web,
                        language=lang_code
                    )
                )
        return resources

    def fcs_scan(self, corpname: str, scan_query: str, max_ter: int, start: int):
        """
        aux function for federated content search: operation=scan
        """
        query = scan_query.replace('+', ' ')  # convert URL spaces
        exact_match = False
        if 'exact' in query.lower() and '=' not in query:  # lemma ExacT "dog"
            pos = query.lower().index('exact')  # first occurence of EXACT
            query = query[:pos] + '=' + query[pos + 5:]  # 1st exact > =
            exact_match = True
        corp = self.cm.get_Corpus(corpname)
        attrs = corp.get_posattrs()
        try:
            if '=' in query:
                attr, value = query.split('=')
                attr = attr.strip()
                value = value.strip()
            else:  # must be in format attr = value
                raise Exception
            if '"' in attr:
                raise Exception
            if '"' in value:
                if value[0] == '"' and value[-1] == '"':
                    value = value[1:-1].strip()
                else:
                    raise Exception
        except Exception:
            raise FCSError(10, scan_query, 'Query syntax error')
        if attr not in attrs:
            raise FCSError(16, attr, 'Unsupported index')

        if exact_match:
            wlpattern = '^' + value + '$'
        else:
            wlpattern = '.*' + value + '.*'

        wl = corplib.wordlist(corp, wlattr=attr, wlpat=wlpattern, wlsort='f')
        return [(d['str'], d['freq']) for d in wl][start:][:max_ter]

    def fcs_search(
            self,
            corp: Corpus,
            corp_info: CorpusInfo,
            fcs_query: str,
            max_rec: int,
            start: int
    ) -> Tuple[Dict[str,Any], str]:
        """
        aux function for federated content search: operation=searchRetrieve
        """
        query = fcs_query.replace('+', ' ')  # convert URL spaces
        exact_match = True  # attr=".*value.*"
        if 'exact' in query.lower() and '=' not in query:  # lemma EXACT "dog"
            pos = query.lower().index('exact')  # first occurrence of EXACT
            query = query[:pos] + '=' + query[pos + 5:]  # 1st exact > =
            exact_match = True
        attrs = corp.get_conf('ATTRLIST').split(',')  # list of available attrs
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
        except Exception:  # there was a problem when parsing
            raise FCSError(10, query, 'Query syntax error')
        if attr not in attrs:
            raise FCSError(16, attr, 'Unsupported index')

        fromp = int(math.floor((start - 1) / max_rec)) + 1
        # try to get concordance
        try:
            anon_id = plugins.runtime.AUTH.instance.anonymous_user()['id']
            q = ['q' + rq]
            conc = get_conc(corp, anon_id, q=q, fromp=fromp, pagesize=max_rec, asnc=0)
        except Exception as e:
            raise FCSError(10, repr(e), 'Query syntax error')

        if start - 1 > conc.size():
            raise FCSError(61, 'startRecord', 'First record position out of range')

        kwic = kwiclib.Kwic(corp, corp_info.id, conc)
        kwic_args = kwiclib.KwicPageArgs({'structs': ''}, base_attr=self.BASE_ATTR)
        kwic_args.fromp = fromp
        kwic_args.pagesize = max_rec
        kwic_context = settings.get_int('fcs', 'kwic_context', 5)
        kwic_args.leftctx = f'-{kwic_context}'
        kwic_args.rightctx = f'{kwic_context}'
        page = kwic.kwicpage(kwic_args)

        local_offset = (start - 1) % max_rec
        rows = []
        for kwicline in page['Lines'][local_offset:local_offset + max_rec]:
            rows.append([
                kwicline['Left'][0]['str'].strip(' '),
                kwicline['Kwic'][0]['str'].strip(' '),
                kwicline['Right'][0]['str'].strip(' '),
                kwicline['ref'],
                corp_info.id,
                '' if corp_info.web is None else corp_info.web,
            ])
        return dict(rows=rows, size=conc.size()), rq

    def op_explain(self, req, resp_common: Dict[str, Any], resp: Dict[str, Any], corpora: List[str]):
        self.check_args(req, ['recordPacking', 'x-fcs-endpoint-description'])
        resp_common['numberOfRecords'] = len(resp_common['result'])

        resp['database_title'] = settings.get('fcs', 'database_title')
        resp['database_description'] = settings.get('fcs', 'database_description')
        extended_desc = True if req.args.get('x-fcs-endpoint-description', 'false') == 'true' else False
        resp['show_endpoint_desc'] = extended_desc
        if extended_desc:
            resp['resources'] = []
            # we must determine which attributes are in all fcs set corpora
            attrs_cnt = defaultdict(lambda: 0)
            with plugins.runtime.CORPARCH as ca:
                for corp in settings.get_list('fcs', 'corpora'):
                    cinfo = self.get_corpus_info(corp)
                    for attr in cinfo.manatee.attrs:
                        attrs_cnt[attr] += 1
                    if cinfo.manatee.lang:
                        lang_code = Languages.get_iso_code(cinfo.manatee.lang)
                    else:
                        lang_code = cinfo.collator_locale.split('_')[0]
                    resp['resources'].append(
                        dict(
                            pid=cinfo.id,
                            title=corp,
                            description=cinfo.localized_desc('en'),
                            landing_page_uri=cinfo.web,
                            language=lang_code
                        )
                    )
            resp_common['result'] = []
            for attr, cnt in attrs_cnt.items():
                if cnt == len(settings.get_list('fcs', 'corpora')):
                    resp_common['result'].append(attr)


    def op_scan(self, req, resp_common: Dict[str, Any], resp: Dict[str, Any], corpora: List[str]):
        self.check_args(req, ['scanClause', 'responsePosition', 'maximumTerms', 'x-cmd-resource-info'])

        if 'maximumTerms' in req.args:
            try:
                resp_common['maximumTerms'] = int(req.args.get('maximumTerms'))
            except Exception:
                raise FCSError(6, 'maximumTerms', 'Unsupported parameter value')
        if 'responsePosition' in req.args:
            try:
                resp_common['responsePosition'] = int(req.args.get('responsePosition'))
            except Exception:
                raise FCSError(6, 'responsePosition', 'Unsupported parameter value')

        scan_clause: str = req.args.get('scanClause', '')
        if not scan_clause:
            raise FCSError(7, 'scanClause', 'Mandatory parameter not supplied')
        if scan_clause.startswith('fcs.resource='):
            value = scan_clause.split('=')[1]
            resp_common['result'] = self.corpora_info(value, resp_common['maximumTerms'])
        else:
            resp_common['result'] = self.fcs_scan(
                corpora[0], scan_clause, resp_common['maximumTerms'], resp_common['responsePosition'])
        resp['resourceInfoRequest'] = req.args.get(
            'x-cmd-resource-info', '') == 'true'


    def op_search_retrieve(self, req, resp_common: Dict[str, Any], resp: Dict[str, Any], corpora: List[str]):
        # TODO review resultSetTTL arg
        self.check_args(req, [
            'query', 'startRecord', 'maximumRecords', 'recordPacking',
            'recordSchema', 'resultSetTTL', 'x-fcs-context'
        ])
        if 'maximumRecords' in req.args:
            try:
                resp_common['maximumRecords'] = int(req.args.get('maximumRecords'))
                if resp_common['maximumRecords'] <= 0:
                    raise FCSError(6, 'maximumRecords', 'Unsupported parameter value')
            except Exception:
                raise FCSError(6, 'maximumRecords', 'Unsupported parameter value')
        if 'startRecord' in req.args:
            try:
                resp_common['startRecord'] = int(req.args.get('startRecord'))
                if resp_common['startRecord'] <= 0:
                    raise FCSError(6, 'startRecord', 'Unsupported parameter value')
            except Exception:
                raise FCSError(6, 'startRecord', 'Unsupported parameter value')

        query = req.args.get('query', '')
        if 0 == len(query):
            raise FCSError(7, 'fcs_query', 'Mandatory parameter not supplied')

        results = [
            self.fcs_search(
                self.cm.get_Corpus(corp),
                self.get_corpus_info(corp),
                query,
                resp_common['maximumRecords'],
                resp_common['startRecord'],
            )
            for corp in corpora
        ]

        # merging results
        merged_rows = [row for result, _ in results for row in result['rows']]
        if len(merged_rows) > resp_common['maximumRecords']:
            merged_rows = random.sample(merged_rows, k=resp_common['maximumRecords'])
        merged_results = dict(
            rows=merged_rows,
            size=len(merged_rows),
        )

        resp_common['result'] = merged_results['rows']
        resp_common['numberOfRecords'] = merged_results['size']


    def check_corpora(self, corpora: List[str]):
        if not len(corpora) > 0:
            raise Exception('no corpus defined')

        with plugins.runtime.AUTH as auth:
            user_info = auth.get_user_info(self._plugin_api)
            for corpname in corpora:
                has_access, variant = auth.validate_access(corpname, user_info)
                if not has_access:
                    raise CorpusForbiddenException(corpname, variant)


    def get_corpora(self, req) -> List[str]:
        allowed_corpora = settings.get('fcs', 'corpora', [])
        context = req.args.get('x-fcs-context', None)
        if context is not None:
            corpora = context.split(',')
            for corpname in corpora:
                if corpname not in allowed_corpora:
                    raise Exception(f'unknown corpus requested {corpname}')
        else:
            corpora = allowed_corpora
        self.check_corpora(corpora)
        return corpora

    @exposed(return_type='template', template='fcs/v1_complete.html', skip_corpus_init=True, http_method=('GET', 'HEAD'))
    def v1(self, req):
        self._headers['Content-Type'] = 'application/xml'
        current_version = 1.2
        pr = urllib.parse.urlparse(req.host_url)
        common_data = dict(
            version=current_version,
            server_name=pr.hostname,
            server_port=pr.port or 80,
            database=req.path,
            recordPacking='xml',
            result=[],
            operation='explain',
            numberOfRecords=0,
            maximumRecords=250,
            maximumTerms=100,
            startRecord=1,
            responsePosition=0,
        )
        custom_resp = {}
        # supported parameters for all operations

        try:
            # check operation
            if 'operation' in req.args:
                common_data['operation'] = req.args.get('operation')
            # check version
            if 'version' in req.args:
                version = req.args.get('version')
                try:
                    vnum = float(version)
                except ValueError:
                    raise FCSError(5, str(current_version), f'Unsupported version {version}')
                if current_version < vnum:
                    raise FCSError(5, str(current_version), f'Unsupported version {version}')
            # set content-type in HTTP header
            if 'recordPacking' in req.args:
                common_data['recordPacking'] = req.args.get('recordPacking')
            if common_data['recordPacking'] == 'xml':
                pass
            elif common_data['recordPacking'] == 'string':
                # TODO what is the format here?
                self._headers['Content-Type'] = 'text/plain; charset=utf-8'
            else:
                raise FCSError(71, 'recordPacking', 'Unsupported record packing')

            try:
                handler = dict(
                    explain=self.op_explain,
                    scan=self.op_scan,
                    searchRetrieve=self.op_search_retrieve,
                )[common_data['operation']]
            except KeyError:
                # show within explain template
                common_data['operation'] = 'explain'
                raise FCSError(4, '', 'Unsupported operation')

            corpora = self.get_corpora(req)
            handler(req, common_data, custom_resp, corpora)

        # catch exception and amend diagnostics in template
        except FCSError as ex:
            custom_resp['code'] = ex.code
            custom_resp['ident'] = ex.ident
            custom_resp['msg'] = ex.msg
        except Exception as e:
            custom_resp['code'] = 1
            custom_resp['ident'] = repr(e)
            custom_resp['msg'] = 'General system error'

        return {**common_data, **custom_resp}


class Languages(object):
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
    def get_iso_code(language):
        code = ''
        if language in Languages.language2iso:
            code = Languages.language2iso[language]
        return code
