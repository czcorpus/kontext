# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import ujson as json
from plugin_types.query_suggest import AbstractBackend
from plugins.common.http import HTTPRequester


class KorpusDBBackend(AbstractBackend):

    API_PATH = '/api/cunits/_view'

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        port_str = ':{}'.format(self._conf.get('port')) if self._conf.get('port') else ''
        if self._conf['ssl']:
            self._requester = HTTPRequester('https://{}{}'.format(self._conf['server'], port_str))
        else:
            self._requester = HTTPRequester('http://{}{}'.format(self._conf['server'], port_str))

    async def find_suggestion(
            self, plugin_ctx, ui_lang, user_id, maincorp, corpora, subcorpus, value, value_type, value_subformat,
            query_type, p_attr, struct, s_attr):
        body = {
            'feats': [":form:attr:cnc:w"],
            'sort': [{
                'feats._i_value': {
                    'order': 'desc',
                    'nested': {
                        'path': 'feats',
                        'filter': {
                            'term': {
                                'feats.type': ':stats:fq:abs:cnc'
                            }
                        }
                    }
                }
            }],
            'query': {
                'feats': [
                    {
                        'type': self._conf['search_attr'],
                        'value': value,
                        'ci': True
                    }
                ],
                'type': ':token:form'
            },
            'page': {
                'from': 0,
                'size': 100
            },
            '_client': 'kontext'
        }

        resp, is_found = await self._requester.request(
            plugin_ctx.http_client,
            'POST',
            self.API_PATH,
            {},
            json.dumps(body),
            {'Content-type': 'application/json', 'User-Agent': 'python-http.client'}
            # NOTE: the current KorpusDB version fails to response in case there is no User-Agent
        )

        if is_found:
            data = json.loads(resp)
            return list(set(
                filler[self._conf['crit_attr']]
                for item in data['data']
                for slot in item['_slots']
                for filler in slot['_fillers']
            ))
        else:
            return []
