# coding=utf-8
import l10n
from argmapping import Args
import kwiclib
from controller.kontext import Kontext
from controller import exposed
import conclib
from conclib.search import get_conc
import plugins
import settings
import urllib.parse
import logging
import math


_logger = logging.getLogger(__name__)


class Actions(Kontext):
    """
    An action controller providing services related to the Federated Content Search support
    """

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

    def _check_args(self, req, supported_default, supported):
        supported_default.extend(supported)
        unsupported_args = set(req.args.keys()) - set(supported_default)
        if 0 < len(unsupported_args):
            raise Exception(8, list(unsupported_args)[0], 'Unsupported parameter')

    def _corpora_info(self, value, max_items):
        resources = []
        corpora_d = {value: value}
        if value == 'root':
            corpora_d = plugins.runtime.AUTH.instance.permitted_corpora(self.session_get(
                'user'))

        for i, corpus_id in enumerate(corpora_d):
            if i >= max_items:
                break
            resource_info = {}
            c = self.cm.get_Corpus(corpus_id)
            corpus_title = c.get_conf('NAME')
            resource_info['title'] = corpus_title
            resource_info['landingPageURI'] = c.get_conf('INFOHREF')
            # TODO(jm) - Languages copied (and slightly fixed) from 0.5 - should be checked
            resource_info['language'] = Languages.get_iso_code(c.get_conf('LANGUAGE'))
            resource_info['description'] = c.get_conf('INFO')
            resources.append((corpus_id, corpus_title, resource_info))
        return resources

    def fcs_search(self, corp, corpname, fcs_query, max_rec, start):
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
                        rq = ' '.join(['[%s="%s"]' % (attr, t)
                                       for t in term.split()])
                    else:
                        rq = ' '.join(['[%s=".*%s.*"]' % (attr, t)
                                       for t in term.split()])
                elif term.strip() == '':  # ""
                    raise Exception  # empty term
                else:  # one-word term
                    if exact_match:
                        rq = '[%s="%s"]' % (attr, term)
                    else:
                        rq = '[%s=".*%s.*"]' % (attr, term)
            else:  # must be single-word term
                if ' ' in term:
                    raise Exception
                if exact_match:  # build query
                    rq = '[%s="%s"]' % (attr, term)
                else:
                    rq = '[%s=".*%s.*"]' % (attr, term)
        except:  # there was a problem when parsing
            raise Exception(10, query, 'Query syntax error')
        if attr not in attrs:
            raise Exception(16, attr, 'Unsupported index')

        fromp = int(math.floor((start - 1) / max_rec)) + 1
        # try to get concordance
        try:
            anon_id = plugins.runtime.AUTH.instance.anonymous_user()['id']
            q = ['q' + rq]
            conc = get_conc(corp, anon_id, q=q, fromp=fromp, pagesize=max_rec, asnc=0)
        except Exception as e:
            raise Exception(10, repr(e), 'Query syntax error')

        kwic = kwiclib.Kwic(corp, corpname, conc)
        kwic_args = kwiclib.KwicPageArgs({'structs': ''}, base_attr=Kontext.BASE_ATTR)
        kwic_args.fromp = fromp
        kwic_args.pagesize = max_rec
        kwic_args.leftctx = '-{0}'.format(settings.get_int('fcs', 'kwic_context', 5))
        kwic_args.rightctx = '{0}'.format(settings.get_int('fcs', 'kwic_context', 5))
        page = kwic.kwicpage(kwic_args)  # convert concordance

        local_offset = (start - 1) % max_rec
        if start - 1 > conc.size():
            raise Exception(61, 'startRecord', 'First record position out of range')
        rows = [
            (
                kwicline['Left'][0]['str'],
                kwicline['Kwic'][0]['str'],
                kwicline['Right'][0]['str'],
                kwicline['ref']
            )
            for kwicline in page['Lines']
        ][local_offset:local_offset + max_rec]
        return rows, conc.size()

    @exposed(return_type='template', template='fcs/v1_complete.html', skip_corpus_init=True, http_method=('GET', 'HEAD'))
    def v1(self, req):
        self._headers['Content-Type'] = 'application/xml'
        current_version = 1.2

        default_corp_list = settings.get('corpora', 'default_corpora', [])
        corpname = None
        if 0 == len(default_corp_list):
            _logger.critical('FCS cannot work properly without a default_corpora set')
        else:
            corpname = default_corp_list[0]

        pr = urllib.parse.urlparse(req.host_url)
        # None values should be filled in later
        data = {
            'corpname': corpname,
            'corppid': None,
            'version': current_version,
            'recordPacking': 'xml',
            'result': [],
            'operation': None,
            'numberOfRecords': 0,
            'server_name': pr.hostname,
            'server_port': pr.port or 80,
            'database': req.path,
            'maximumRecords': None,
            'maximumTerms': None,
            'startRecord': None,
            'responsePosition': None,
        }
        # supported parameters for all operations
        supported_args = ['operation', 'stylesheet', 'version', 'extraRequestData']

        try:
            # check operation
            operation = req.args.get('operation', 'explain')
            data['operation'] = operation

            # check version
            version = req.args.get('version', None)
            if version is not None and current_version < float(version):
                raise Exception(5, version, 'Unsupported version')

            # check integer parameters
            maximumRecords = req.args.get('maximumRecords', 250)
            if 'maximumRecords' in req.args:
                try:
                    maximumRecords = int(maximumRecords)
                    if maximumRecords <= 0:
                        raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
                except:
                    raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
            data['maximumRecords'] = maximumRecords

            maximumTerms = req.args.get('maximumTerms', 100)
            if 'maximumTerms' in req.args:
                try:
                    maximumTerms = int(maximumTerms)
                except:
                    raise Exception(6, 'maximumTerms', 'Unsupported parameter value')
            data['maximumTerms'] = maximumTerms

            startRecord = req.args.get('startRecord', 1)
            if 'startRecord' in req.args:
                try:
                    startRecord = int(startRecord)
                    if startRecord <= 0:
                        raise Exception(6, 'startRecord', 'Unsupported parameter value')
                except:
                    raise Exception(6, 'startRecord', 'Unsupported parameter value')
            data['startRecord'] = startRecord

            responsePosition = req.args.get('responsePosition', 0)
            if 'responsePosition' in req.args:
                try:
                    responsePosition = int(responsePosition)
                except:
                    raise Exception(6, 'responsePosition', 'Unsupported parameter value')
            data['responsePosition'] = responsePosition

            # set content-type in HTTP header
            recordPacking = req.args.get('recordPacking', 'xml')
            if recordPacking == 'xml':
                pass
            elif recordPacking == 'string':
                # TODO(jm)!!!
                self._headers['Content-Type'] = 'text/plain; charset=utf-8'
            else:
                raise Exception(71, 'recordPacking', 'Unsupported record packing')

            # provide info about service
            if operation == 'explain':
                self._check_args(
                    req, supported_args,
                    ['recordPacking', 'x-fcs-endpoint-description']
                )
                corpus = self.cm.get_Corpus(corpname)
                data['result'] = corpus.get_conf('ATTRLIST').split(',')
                data['numberOfRecords'] = len(data['result'])
                data['corpus_desc'] = 'Corpus {0} ({1} tokens)'.format(
                    corpus.get_conf('NAME'), l10n.simplify_num(corpus.size()))
                data['corpus_lang'] = Languages.get_iso_code(corpus.get_conf('LANGUAGE'))
                data['show_endpoint_desc'] = (True if req.args.get('x-fcs-endpoint-description', 'false') == 'true'
                                              else False)

            # wordlist for a given attribute
            elif operation == 'scan':
                self._check_args(
                    req, supported_args,
                    ['scanClause', 'responsePosition', 'maximumTerms', 'x-cmd-resource-info']
                )
                data['resourceInfoRequest'] = req.args.get('x-cmd-resource-info', '') == 'true'
                scanClause = req.args.get('scanClause', '')
                if scanClause.startswith('fcs.resource='):
                    value = scanClause.split('=')[1]
                    data['result'] = self._corpora_info(value, maximumTerms)
                else:
                    data['result'] = conclib.fcs_scan(
                        corpname, scanClause, maximumTerms, responsePosition)

            # simple concordancer
            elif operation == 'searchRetrieve':
                # TODO we should review the args here (especially x-cmd-context, resultSetTTL)
                self._check_args(
                    req, supported_args,
                    ['query', 'startRecord', 'maximumRecords', 'recordPacking',
                        'recordSchema', 'resultSetTTL', 'x-cmd-context', 'x-fcs-context']
                )
                if 'x-cmd-context' in req.args:
                    req_corpname = req.args['x-cmd-context']
                    user_corpora = plugins.runtime.AUTH.instance.permitted_corpora(
                        self.session_get('user'))
                    if req_corpname in user_corpora:
                        corpname = req_corpname
                    else:
                        _logger.warning(
                            'Requested unavailable corpus [%s], defaulting to [%s]', req_corpname, corpname)
                    data['corpname'] = corpname

                corp_conf_info = plugins.runtime.CORPARCH.instance.get_corpus_info('en_US',
                                                                                   corpname)
                data['corppid'] = corp_conf_info.get('web', '')
                query = req.args.get('query', '')
                corpus = self.cm.get_Corpus(corpname)
                if 0 == len(query):
                    raise Exception(7, 'fcs_query', 'Mandatory parameter not supplied')
                data['result'], data['numberOfRecords'] = self.fcs_search(
                    corpus, corpname, query, maximumRecords, startRecord)

            # unsupported operation
            else:
                # show within explain template
                data['operation'] = 'explain'
                raise Exception(4, '', 'Unsupported operation')

        # catch exception and amend diagnostics in template
        except Exception as e:
            data['message'] = ('error', repr(e))
            try:
                data['code'], data['details'], data['msg'] = e
            except (ValueError, TypeError):
                data['code'], data['details'] = 1, repr(e)
                data['msg'] = 'General system error'

        return data

    @exposed(return_type='template', template='fcs/fcs2html.html', skip_corpus_init=True)
    def fcs2html(self, req):
        """
            Returns XSL template for rendering FCS XML.
        """
        self._headers['Content-Type'] = 'text/xsl; charset=utf-8'
        custom_hd_inject_path = settings.get('fcs', 'template_header_inject_file', None)
        if custom_hd_inject_path:
            with open(custom_hd_inject_path) as fr:
                custom_hdr_inject = fr.read()
        else:
            custom_hdr_inject = None
        return dict(fcs_provider_heading=settings.get('fcs', 'provider_heading', 'KonText FCS Data Provider'),
                    fcs_provider_website=settings.get('fcs', 'provider_website', None),
                    fcs_template_css_url=settings.get_list('fcs', 'template_css_url'),
                    fcs_custom_hdr_inject=custom_hdr_inject)


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
