# coding=utf-8
import l10n
from functools import partial
from argmapping import Args
import kwiclib
from kontext import Kontext
from controller import exposed
import conclib
import plugins
import settings
import urlparse
import logging

_logger = logging.getLogger(__name__)


class Actions(Kontext):
    """
    An action controller providing services related to the Federated Content Search support
    """

    def __init__(self, request, ui_lang):
        """
        arguments:
        request -- Werkzeug's request object
        ui_lang -- a language code in which current action's result will be presented
        """
        super(Actions, self).__init__(request=request, ui_lang=ui_lang)

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
            raise Exception(8, unsupported_args[0], 'Unsupported parameter')

    def _corpora_info(self, value, max_items):
        resources = []
        corpora_d = {value: value}
        if value == 'root':
            corpora_d = plugins.get('auth').permitted_corpora(self._session_get('user'))

        for i, corpus_id in enumerate(corpora_d):
            if i >= max_items:
                break
            resource_info = {}
            c = self.cm.get_Corpus(corpus_id)
            import_str = partial(l10n.import_string, from_encoding=c.get_conf('ENCODING'))
            corpus_title = import_str(c.get_conf('NAME'))
            resource_info['title'] = corpus_title
            resource_info['landingPageURI'] = c.get_conf('INFOHREF')
            # TODO(jm) - Languages copied (and slightly fixed) from 0.5 - should be checked
            resource_info['language'] = Languages.get_iso_code(c.get_conf('LANGUAGE'))
            resource_info['description'] = import_str(c.get_conf('INFO'))
            resources.append((corpus_id, corpus_title, resource_info))
        return resources

    def fcs_search(self, corp, corpname, fcs_query, max_rec, start):
        """
            aux function for federated content search: operation=searchRetrieve
        """
        query = fcs_query.replace('+', ' ')  # convert URL spaces
        exact_match = True  # attr=".*value.*"
        if 'exact' in query.lower() and not '=' in query:  # lemma EXACT "dog"
            pos = query.lower().index('exact')  # first occurrence of EXACT
            query = query[:pos] + '=' + query[pos + 5:]  # 1st exact > =
            exact_match = True

        search_attrs = settings.get(
            'corpora', 'fcs_search_attributes', ["word"]
        ).split(",")

        attrs = corp.get_conf('ATTRLIST').split(',')  # list of available attrs
        rq = ''  # query for manatee
        try:  # parse query
            if '=' in query:  # lemma=word | lemma="word" | lemma="w1 w2" | word=""
                attr, term = query.split('=')
                attr = attr.strip()
                term = term.strip()
            else:  # "w1 w2" | "word" | word
                attr = "word"
                # use one of search attributes if in corpora attributes
                # otherwise use `word` - fails below if not valid
                for sa in search_attrs:
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
        if not attr in attrs:
            raise Exception(16, attr, 'Unsupported index')

        # try to get concordance
        try:
            anon_id = plugins.get('auth').anonymous_user()["id"]
            q = ['q' + rq]
            #q = ['aword,[lc="havel"]']
            conc = conclib.get_conc(corp, anon_id, q=q)
        except Exception, e:
            raise Exception(10, repr(e), 'Query syntax error')

        kwic = kwiclib.Kwic(corp, corpname, conc)
        kwic_args = kwiclib.KwicPageArgs(Args(), base_attr=Kontext.BASE_ATTR)
        page = kwic.kwicpage(kwic_args)  # convert concordance

        # start starts with 1
        start -= 1

        if len(page['Lines']) < start:
            raise Exception(61, 'startRecord', 'First record position out of range')
        return [
            (
                kwicline['Left'][0]['str'],
                kwicline['Kwic'][0]['str'],
                kwicline['Right'][0]['str'],
                kwicline['ref']
            )
            for kwicline in page['Lines']
        ][start:][:max_rec]

    @exposed(return_type='xml', template="fcs/v1_complete.tmpl", skip_corpus_init=True)
    def v1(self, req):
        current_version = 1.2

        default_corp_list = settings.get('corpora', 'default_corpora', [])
        corpname = None
        if 0 == len(default_corp_list):
            _logger.critical("FCS cannot work properly without a default_corpora set")
        else:
            corpname = default_corp_list[0]

        pr = urlparse.urlparse(req.host_url)
        # None values should be filled in later
        data = {
            "corpname": corpname,
            "corppid": None,
            "version": current_version,
            "recordPacking": "xml",
            "result": [],
            "operation": None,
            "numberOfRecords": 0,
            "server_name": pr.hostname,
            "server_port": pr.port or 80,
            "database": req.path,
            "maximumRecords": None,
            "maximumTerms": None,
            "startRecord": None,
            "responsePosition": None,
        }
        # supported parameters for all operations
        supported_args = ['operation', 'stylesheet', 'version', 'extraRequestData']

        try:
            # check operation
            operation = req.args.get("operation", "explain")
            data["operation"] = operation

            # check version
            version = req.args.get("version", None)
            if version is not None and current_version < float(version):
                raise Exception(5, version, 'Unsupported version')

            # check integer parameters
            maximumRecords = req.args.get("maximumRecords", 250)
            if "maximumRecords" in req.args:
                try:
                    maximumRecords = int(maximumRecords)
                    if maximumRecords <= 0:
                        raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
                except:
                    raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
            data["maximumRecords"] = maximumRecords

            maximumTerms = req.args.get("maximumTerms", 100)
            if "maximumTerms" in req.args:
                try:
                    maximumTerms = int(maximumTerms)
                except:
                    raise Exception(6, 'maximumTerms', 'Unsupported parameter value')
            data["maximumTerms"] = maximumTerms

            startRecord = req.args.get("startRecord", 1)
            if "startRecord" in req.args:
                try:
                    startRecord = int(startRecord)
                    if startRecord <= 0:
                        raise Exception(6, 'startRecord', 'Unsupported parameter value')
                except:
                    raise Exception(6, 'startRecord', 'Unsupported parameter value')
            data["startRecord"] = startRecord

            responsePosition = req.args.get("responsePosition", 0)
            if "responsePosition" in req.args:
                try:
                    responsePosition = int(responsePosition)
                except:
                    raise Exception(6, 'responsePosition', 'Unsupported parameter value')
            data["responsePosition"] = responsePosition

            # set content-type in HTTP header
            recordPacking = req.args.get("recordPacking", "xml")
            if recordPacking == "xml":
                pass
            elif recordPacking == "string":
                # TODO(jm)!!!
                self._headers["Content-Type"] = "text/plain; charset=utf-8"
            else:
                raise Exception(71, 'recordPacking', 'Unsupported record packing')

            # provide info about service
            if operation == "explain":
                self._check_args(
                    req, supported_args,
                    ['recordPacking', 'x-fcs-endpoint-description']
                )
                corpus = self.cm.get_Corpus(corpname)
                data["result"] = corpus.get_conf('ATTRLIST').split(',')
                data["numberOfRecords"] = len(data['result'])

            # wordlist for a given attribute
            elif operation == 'scan':
                self._check_args(
                    req, supported_args,
                    ['scanClause', 'responsePosition', 'maximumTerms', 'x-cmd-resource-info']
                )
                data['resourceInfoRequest'] = req.args.get("x-cmd-resource-info", "") == 'true'
                scanClause = req.args.get("scanClause", "")
                if scanClause.startswith("fcs.resource="):
                    value = scanClause.split("=")[1]
                    data['result'] = self._corpora_info(value, maximumTerms)
                else:
                    data['result'] = conclib.fcs_scan(
                        corpname, scanClause, maximumTerms, responsePosition)

            # simple concordancer
            elif operation == 'searchRetrieve':
                self._check_args(
                    req, supported_args,
                    ['query', 'startRecord', 'maximumRecords', 'recordPacking',
                        'recordSchema', 'resultSetTTL', 'x-cmd-context']
                )
                if "x-cmd-context" in req.args:
                    req_corpname = req.args["x-cmd-context"]
                    user_corpora = plugins.get('auth').permitted_corpora(self._session_get('user'))
                    if req_corpname in user_corpora:
                        corpname = req_corpname
                    else:
                        _logger.warning(
                            "Requested unavailable corpus [%s], defaulting to [%s]", req_corpname, corpname)
                    data["corpname"] = corpname

                corp_conf_info = plugins.get('corparch').get_corpus_info(corpname)
                data["corppid"] = corp_conf_info.get("web", "")
                query = req.args.get("query", "")
                corpus = self.cm.get_Corpus(corpname)
                if 0 == len(query):
                    raise Exception(7, 'fcs_query', 'Mandatory parameter not supplied')
                data['result'] = self.fcs_search(
                    corpus, corpname, query, maximumRecords, startRecord)
                data['numberOfRecords'] = len(data['result'])

            # unsupported operation
            else:
                # show within explain template
                data['operation'] = 'explain'
                raise Exception(4, '', 'Unsupported operation')

        # catch exception and amend diagnostics in template
        except Exception as e:
            data['message'] = ('error', repr(e))
            try:
                data['code'], data['details'], data['msg'] = e[0], e[1], e[2]
            except:
                data['code'], data['details'] = 1, repr(e)
                data['msg'] = 'General system error'

        return data

    @exposed(return_type='text/xsl', template="fcs/fcs2html.tmpl", skip_corpus_init=True)
    def fcs2html(self, req):
        """
            Returns XSL template for rendering FCS XML.
        """
        self._headers['Content-Type'] = 'text/xsl; charset=utf-8'
        return {}


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
