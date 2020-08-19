# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

from plugins.abstract.query_suggest import AbstractBackend
import logging
from typing import List
from plugins.common.http import HTTPClient


class ManateeBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super().__init__(ident)

    def find_suggestion(self, ui_lang: str, corpora: List[str], subcorpus: str, value: str, value_type: str,
                        query_type: str, p_attr: str, struct: str, s_attr: str):
        data = {
            'a': 'akát',
            'b': 'blýskavice',
            'c': 'cílovníci',
            'd': 'dálava',
            'e': 'erb',
            'f': 'Filipíny',
            'g': 'Grónská zem',
            'h': 'holubice',
            'i': 'Ivan',
            'j': 'jasmín bílý',
            'k': 'kráková',
            'l': 'lupíneček',
            'm': 'mává',
            'n': 'národ',
            'o': 'ó náš pán',
            'p': 'papírníci',
            'q': 'kvílí orkán',
            'r': 'rarášek',
            's': 'sekera',
            't': 'tón',
            'u': 'uličník',
            'v': 'vyvolený',
            'w': 'Waltrův vůz',
            'x': 'Xénokratés',
            'y': 'ý se ztrácí',
            'z': 'známá žena'
        }
        return [data.get(value[-1], '---'), 'a jiné']


class HTTPBackend(AbstractBackend):
    """
    TODO
    """

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        self._client = HTTPClient(server=conf['server'], port=conf['port'], ssl=conf['ssl'])

    def get_required_attrs(self):
        if 'posAttrs' in self._conf:
            logging.getLogger(__name__).warning(
                'You are using a deprecated "conf.posAttr" value; please use "conf.attrs" instead.')
            return self._conf.get('posAttrs', [])
        else:
            return self._conf.get('attrs', [])

    def find_suggestion(self, ui_lang: str, corpora: List[str], subcorpus: str, value: str, value_type: str,
                        query_type: str, p_attr: str, struct: str, s_attr: str):
        args = dict(
            ui_lang=self.enc_val(ui_lang), corpora=[self.enc_val(c) for c in corpora])
        logging.getLogger(__name__).debug('HTTP Backend args: {0}'.format(args))
        return self._client.request('GET', self._conf['path'], args)
