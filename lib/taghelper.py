# -*- coding: utf-8 -*-
import settings
import os
import re
import json
import logging
import locale

try:
    _
except NameError, e:
    _ = lambda s : s

class TagGeneratorException(Exception):
    pass


class TagVariantLoader(object):
    """
    """

    def __init__(self, corp_name, num_tag_pos):
        """
        """
        self.corp_name = corp_name
        self.num_tag_pos = num_tag_pos
        self.tags_file = open('%s/%s' % (settings.get('corpora', 'tags_src_dir'), self.corp_name))
        self.cache_dir = '%s/%s' % (settings.get('corpora', 'tags_cache_dir'), self.corp_name)

    def get_variant(self, selected_tags):
        """
        """
        path = '%s/tag-%s.%s.json' % (self.cache_dir, selected_tags, locale.getlocale()[0])
        data = '{}'
        if not os.path.exists(path):
            data = json.dumps(self.calculate_variant(selected_tags))
            with open(path, 'w') as f:
                f.write(data)
                f.close()
        else:
            with open(path) as f:
                data = f.read()
                f.close()
        return data

    def get_fixed_positions(self, pattern):
        """
        """
        pass

    def get_initial_values(self):
        """
        """
        path = '%s/initial-values.%s.json' % (self.cache_dir, locale.getlocale()[0])
        data = '[]'

        if not os.path.exists(path):
            ans = [set() for i in range(self.num_tag_pos)]
            for line in self.tags_file:
                line = line.strip() + (self.num_tag_pos - len(line.strip())) * '-'
                for i in range(self.num_tag_pos):
                    if line[i] == '-':
                        ans[i].add(('-', ''))
                    elif line[i] in translationTable[i]:
                        ans[i].add((line[i], '%s - %s' % (line[i], translationTable[i][line[i]])))
                    else:
                        ans[i].add((line[i], line[i]))
                        logging.getLogger(__name__).warn('Tag value import - item %s at position %d not found in translation table' % (line[i], i))
            ans = [sorted(x, key=lambda item : item[0]) for x in ans]
            for i in range(len(ans)):
                if len(ans[i]) == 1:
                    ans[i] = ()
                elif '-' not in (x[0] for x in ans[i]):
                    ans[i].insert(0, ('-', ''))
            data = json.dumps(ans)
            with open(path, 'w') as f:
                f.write(data)
                f.close()
        else:
            with open(path, 'r') as f:
                data = f.read()
                f.close()
        return data

    def calculate_variant(self, selected_tags):
        """
        """
        patt = re.compile(selected_tags.replace('-', r'[\w\-]'))
        matching_tags = []
        for line in self.tags_file:
            line = line.strip() + (self.num_tag_pos - len(line.strip())) * '-'
            if patt.match(line):
                matching_tags.append(line)


        ans = {}
        for item in matching_tags:
            for i in range(len(selected_tags)):
                if i not in ans:
                    ans[i] = set()
                if item[i] == '-':
                    ans[i].add((item[i], ''))
                elif item[i] in translationTable[i]:
                    ans[i].add((item[i], '%s - %s' % (item[i], translationTable[i][item[i]])))
                else:
                    ans[i].add((item[i], '%s - %s' % (item[i], item[i])))

        for key in ans:
            used_keys = [x[0] for x in ans[key]]
            if '-' in used_keys:
                if len(used_keys) == 1:
                    ans[key] = ()
                elif len(used_keys) == 2:
                    ans[key].remove(('-', ''))
            elif len(used_keys) > 1:
                ans[key].add(('-', ''))
            ans[key] = sorted(ans[key], key=lambda item: item[0]) if ans[key] is not None else None
        return ans

    def cache_variant(self, selected_positions):
        """
        """
        pass


translationTable = [
    { # position 1
        'A' : _(u'adjektivum (přídavné jméno)'),
        'C' : _(u'numerál (číslovka, nebo číselný výraz s číslicemi)'),
        'D' : _(u'adverbium (příslovce)'),
        'I' : _(u'interjekce (citoslovce)'),
        'J' : _(u'konjunkce (spojka)'),
        'N' : _(u'substantivum (podstatné jméno)'),
        'P' : _(u'pronomen (zájmeno)'),
        'R' : _(u'prepozice (předložka)'),
        'T' : _(u'partikule (částice)'),
        'V' : _(u'verbum (sloveso)'),
        'X' : _(u'neznámý, neurčený, neurčitelný slovní druh'),
        'Z' : _(u'interpunkce, hranice věty')
    },
    { # position 2
        '!' : _(u'zkratka jako adverbium'),
        '*' : _(u'slovo "krát" (slovní druh: spojka)'),
        ',' : _(u'spojka podřadicí (vč. "aby" a "kdyby" ve všech tvarech)'),
        '.' : _(u'zkratka jako adjektivum'),
        ':' : _(u'interpunkce všeobecně'),
        ';' : _(u'zkratka jako substantivum'),
        '=' : _(u'číslo psané číslicemi (značkováno jako slovní druh: číslovka - \'C\')'),
        '?' : _(u'číslovka "kolik"'),
        '^' : _(u'spojka souřadicí'),
        '}' : _(u'číslovka psaná římskými číslicemi'),
        '~' : _(u'zkratka jako sloveso'),
        '@' : _(u'slovní tvar, který nebyl morfologickou analýzou rozpoznán (značkováno jako slovní druh: neznámý - \'X\')'),
        '0' : _(u'předložka s připojeným "-ň" (něj), "proň", "naň", atd. (značkováno jako slovní druh: zájmeno - \'P\')'),
        '1' : _(u'vztažné přivlastňovací zájmeno "jehož", "jejíž", ...'),
        '2' : _(u'slovo před pomlčkou'),
        '3' : _(u'zkratka jako číslovka'),
        '4' : _(u'vztažné nebo tázací zájmeno s adjektivním skloňováním (obou typů: "jaký", "který", "čí", ...)'),
        '5' : _(u'zájmeno "on" ve tvarech po předložce (tj. "n-": "něj", "něho", ...)'),
        '6' : _(u'reflexívní zájmeno "se" v dlouhých tvarech ("sebe", "sobě", "sebou")'),
        '7' : _(u'reflexívní zájmeno "se", "si" pouze v těchto tvarech, a dále "ses", "sis"'),
        '8' : _(u'přivlastňovací zájmeno "svůj"'),
        '9' : _(u'vztažné zájmeno "jenž", "již", ... po předložce ("n-": "něhož", "níž", ...)'),
        'A' : _(u'adjektivum obyčejné'),
        'B' : _(u'sloveso, tvar přítomného nebo budoucího času'),
        'C' : _(u'adjektivum, jmenný tvar'),
        'D' : _(u'zájmeno ukazovací ("ten", "onen", ...)'),
        'E' : _(u'vztažné zájmeno "což"'),
        'F' : _(u'součást předložky, která nikdy nestojí samostatně ("nehledě", "vzhledem", ...)'),
        'G' : _(u'přídavné jméno odvozené od slovesného tvaru přítomného přechodníku'),
        'H' : _(u'krátké tvary osobních zájmen ("mě", "mi", "ti", "mu", ...)'),
        'I' : _(u'citoslovce (značkováno jako slovní druh: citoslovce - \'I\')'),
        'J' : _(u'vztažné zájmeno "jenž" ("již", ...), bez předložky'),
        'K' : _(u'zájmeno tázací nebo vztažné "kdo", vč. tvarů s "-ž" a "-s"'),
        'L' : _(u'zájmeno neurčité "všechen", "sám"'),
        'M' : _(u'přídavné jméno odvozené od slovesného tvaru minulého přechodníku'),
        'N' : _(u'substantivum, obyčejné'),
        'O' : _(u'samostatně stojící zájmena "svůj", "nesvůj", "tentam"'),
        'P' : _(u'osobní zájmena (vč. tvaru "tys")'),
        'Q' : _(u'zájmeno tázací/vztažné "co", "copak", "cožpak"'),
        'R' : _(u'předložka, obyčejná'),
        'S' : _(u'zájmeno přivlastňovací "můj", "tvůj", "jeho" (vč. plurálu)'),
        'T' : _(u'částice (slovní druh \'T\')'),
        'U' : _(u'adjektivum přivlastňovací (na "-ův" i "-in")'),
        'V' : _(u'předložka vokalizovaná ("ve", "pode", "ku", ...)'),
        'W' : _(u'zájmena záporná ("nic", "nikdo", "nijaký", "žádný", ...)'),
        'X' : _(u'slovní tvar, který byl rozpoznán, ale značka (ve slovníku) chybí'),
        'Y' : _(u'zájmeno "co" spojené s předložkou ("oč", "nač", "zač")'),
        'Z' : _(u'zájmeno neurčité ("nějaký", "některý", "číkoli", "cosi", ...)'),
        'a' : _(u'číslovka neurčitá ("mnoho", "málo", "tolik", "několik", "kdovíkolik", ...)'),
        'b' : _(u'příslovce (bez určení stupně a negace; "pozadu", "naplocho", ...)'),
        'c' : _(u'kondicionál slovesa být ("by", "bych", "bys", "bychom", "byste")'),
        'd' : _(u'číslovka druhová, adjektivní skloňování ("jedny", "dvojí", "desaterý", ...)'),
        'e' : _(u'slovesný tvar přechodníku přítomného ("-e", "-íc", "-íce")'),
        'f' : _(u'slovesný tvar: infinitiv'),
        'g' : _(u'příslovce (s určením stupně a negace; "velký", "zajímavý", ...)'),
        'h' : _(u'číslovky druhové "jedny" a "nejedny"'),
        'i' : _(u'slovesný tvar rozkazovacího způsobu'),
        'j' : _(u'číslovka druhová >= 4, substantivní postavení ("čtvero", "desatero", ...)'),
        'k' : _(u'číslovka druhová >= 4, adjektivní postavení, krátký tvar ("čtvery", ...)'),
        'l' : _(u'číslovky základní 1-4, "půl", ...; sto a tisíc v nesubstantivním skloňování'),
        'm' : _(u'slovesný tvar přechodníku minulého, příp. (zastarale) přechodník přítomný dokonavý'),
        'n' : _(u'číslovky základní >= 5'),
        'o' : _(u'číslovky násobné neurčité ("-krát": "mnohokrát", "tolikrát", ...)'),
        'p' : _(u'slovesné tvary minulého aktivního příčestí (včetně přidaného "-s")'),
        'q' : _(u'archaické slovesné tvary minulého aktivního příčestí (zakončení "-ť")'),
        'r' : _(u'číslovky řadové'),
        's' : _(u'slovesné tvary pasívního příčestí (vč. přidaného "-s")'),
        't' : _(u'archaické slovesné tvary přítomného a budoucího času (zakončení "-ť")'),
        'u' : _(u'číslovka tázací násobná "kolikrát"'),
        'v' : _(u'číslovky násobné ("-krát": "pětkrát", "poprvé" ...)'),
        'w' : _(u'číslovky neurčité s adjektivním skloňováním ("nejeden", "tolikátý", "několikátý" ...)'),
        'x' : _(u'zkratka, slovní druh neurčen/neznámý'),
        'y' : _(u'zlomky zakončené na "-ina" (značkováno jako slovní druh: číslovka - \'C\')'),
        'z' : _(u'číslovka tázací řadová "kolikátý"')
    },
    { # position 3
        '-' : _(u'neurčuje se'),
        'F' : _(u'femininum (ženský rod)'),
        'H' : _(u'femininum nebo neutrum (tedy nikoli maskulinum)* '),
        'I' : _(u'maskulinum inanimatum (rod mužský neživotný)'),
        'M' : _(u'maskulinum animatum (rod mužský životný)'),
        'N' : _(u'neutrum (střední rod)'),
        'Q' : _(u'femininum singuláru nebo neutrum plurálu (pouze u příčestí a jmenných adjektiv)*'),
        'T' : _(u'masculinum inanimatum nebo femininum (jen plurál u příčestí a jmenných adjektiv)*'),
        'X' : _(u'libovolný rod (F/M/I/N)'),
        'Y' : _(u'masculinum (animatum nebo inanimatum)*'),
        'Z' : _(u'\'nikoli femininum\' (tj. M/I/N; především u příslovcí)*'),
    },
    { # position 4
        '-' : _(u'neurčuje se'),
        'D' : _(u'duál (pouze 7. pád feminin)'),
        'P' : _(u'plurál (množné číslo)'),
        'S' : _(u'singulár (jednotné číslo)'),
        'W' : _(u'pouze v kombinaci s jmenným rodem \'Q\' (singulár pro feminina, plurál pro neutra)*'),
        'X' : _(u'libovolné číslo (P/S/D)'),
    },

    { # position 5
        '-' : _(u'neurčuje se'),
        '1' : _(u'nominativ (1. pád)'),
        '2' : _(u'genitiv (2. pád)'),
        '3' : _(u'dativ (3. pád)'),
        '4' : _(u'akuzativ (4. pád)'),
        '5' : _(u'vokativ (5. pád)'),
        '6' : _(u'lokativ (6. pád)'),
        '7' : _(u'instrumentál (7. pád)'),
        'X' : _(u'libovolný pád (1/2/3/4/5/6/7)*'),
    },

    { # position 6
        '-' : _(u'neurčuje se'),
        'F' : _(u'femininum (ženský rod)'),
        'M' : _(u'maskulinum animatum (rod mužský životný)'),
        'X' : _(u'libovolný rod (F/M/I/N)'),
        'Z' : _(u'\'nikoli femininum\' (tj. M/I/N; u přivlastňovacích adjektiv)*'),
    },

    { # position 7
        '-' : _(u'neurčuje se'),
        'P' : _(u'plurál (množné číslo)'),
        'S' : _(u'singulár (jednotné číslo)'),
    },

    { # position 8
        '-' : _(u'neurčuje se'),
        '1' : _(u'1. osoba'),
        '2' : _(u'2. osoba'),
        '3' : _(u'3. osoba'),
        'X' : _(u'libovolná osoba (1/2/3)*'),
    },

    { # position 9
        '-' : _(u'neurčuje se'),
        'F' : _(u'futurum (budoucí čas)'),
        'H' : _(u'minulost nebo přítomnost (P/R)*'),
        'P' : _(u'prézens (přítomný čas)'),
        'R' : _(u'minulý čas'),
        'X' : _(u'libovolný čas (F/R/P)*'),
    },

    { # position 10
        '-' : _(u'neurčuje se'),
        '1' : _(u'1. stupeň'),
        '2' : _(u'2. stupeň'),
        '3' : _(u'3. stupeň'),
    },

    { # position 11
        '-' : _(u'neurčuje se'),
        'A' : _(u'afirmativ (bez negativní předpony "ne-")'),
        'N' : _(u'negace (tvar s negativní předponou "ne-")'),
    },

    { # position 12
        '-' : _(u'neurčuje se'),
        'A' : _(u'aktivum nebo \'nikoli pasívum\''),
        'P' : _(u'pasívum'),
    },

    { # position 13
        '-' : _(u'neurčuje se'),
    },

    { # position 14
        '-' : _(u'neurčuje se'),
    },

    { # position 15
        '-' : _(u'neurčuje se ("základní" tvar pro kategorie v pozicích 1-14)'),
        '1' : _(u'varianta, víceméně rovnocenná ("méně častá")'),
        '2' : _(u'řídká, archaická nebo knižní varianta'),
        '3' : _(u'velmi archaický tvar, též hovorový'),
        '4' : _(u'velmi archaický nebo knižní tvar, pouze spisovný (ve své době)'),
        '5' : _(u'hovorový tvar, ale v zásadě tolerovaný ve veřejných projevech'),
        '6' : _(u'hovorový tvar (koncovka standardní obecné češtiny)'),
        '7' : _(u'hovorový tvar (koncovka standardní obecné češtiny), varianta k \'6\''),
        '8' : _(u'zkratky'),
        '9' : _(u'speciální použití (tvary zájmen po předložkách apod.)'),
    },

    { # position 16
        'P' : _(u'perfektivum (dokonavé sloveso)'),
        'I' : _(u'imperfektivum (nedokonavé sloveso)'),
        'B' : _(u'obouvidé sloveso'),
    },
]

