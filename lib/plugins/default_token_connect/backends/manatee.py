# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from plugins.abstract.token_connect import AbstractBackend, BackendException
import conclib
from argmapping import WidectxArgsMapping
import manatee
import logging


class ManateeWideCtxBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf

    def fetch(self, corpora, maincorp, token_id, num_tokens, query_args, lang):
        """
        display a hit in a wider context
        """
        p_attrs = self._conf['attrs']
        structs = [v['element'] for k, v in self._conf['features'].items()]
        # prefer 'word' but allow other attr if word is off
        attrs = ['word'] if 'word' in p_attrs else p_attrs[0:1]
        data = conclib.get_detail_context(corp=maincorp, pos=token_id, attrs=attrs, structs=','.join(structs),
                                          hitlen=num_tokens)
        logging.getLogger(__name__).debug('data: {}'.format(data))
        logging.getLogger(__name__).debug('corp: {}, data: {}'.format(maincorp, data))
        # if int(getattr(self.args, 'detail_left_ctx', 0)) >= int(data['maxdetail']):
        #    data['expand_left_args'] = None
        # if int(getattr(self.args, 'detail_right_ctx', 0)) >= int(data['maxdetail']):
        #    data['expand_right_args'] = None
        # data['widectx_globals'] = self._get_mapped_attrs(WidectxArgsMapping,
        #                                                 dict(structs=self._get_struct_opts()))
        data['features'] = self._conf['features']
        return data, True
