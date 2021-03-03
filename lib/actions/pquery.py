# Copyright(c) 2021 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

from controller import exposed
from controller.kontext import Kontext
from argmapping.pquery import PqueryFormArgs
from controller.kontext import AsyncTaskStatus
from werkzeug import Request
import plugins
from texttypes import TextTypesCache
import bgcalc
import settings
import re


"""
This module contains HTTP actions for the "Paradigmatic query" functionality
"""


class ParadigmaticQuery(Kontext):

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)

    def get_mapping_url_prefix(self):
        return '/pquery/'

    @exposed(template='pquery/index.html', http_method='GET', page_model='pquery')
    def index(self, request):
        query_id = request.args.get('query_id')
        data = None
        if query_id:
            with plugins.runtime.QUERY_PERSISTENCE as qs:
                data = qs.open(query_id)
        ans = {
            'corpname': self.args.corpname,
            'form_data': data,
            'calculate': False
        }
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, ans)
        return ans

    @exposed(template='pquery/index.html', http_method='GET', page_model='pquery')
    def result(self, request):
        query_id = request.args.get('query_id')
        data = None
        if query_id:
            with plugins.runtime.QUERY_PERSISTENCE as qs:
                data = qs.open(query_id)
        ans = {
            'corpname': self.args.corpname,
            'form_data': data,
            'calculate': True
        }
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, ans)
        return ans

    @exposed(http_method='POST', return_type='json')
    def freq_intersection(self, request):
        """
        TODO
        1) create N async task for freq. calculation
        2) store task IDs using _store_async_task and AsyncTaskStatus
        3) return task ids (i.e. do not wait for the task to complete)

        JSON:
        corpname:string;
        usesubcorp:string;
        conc_ids:Array<string>;
        min_freq:number;
        attr:string;
        position:string;
        """
        def is_non_structural_attr(criteria):
            crit_attrs = set(re.findall(r'(\w+)/\s+-?[0-9]+[<>][0-9]+\s*', criteria))
            if len(crit_attrs) == 0:
                crit_attrs = set(re.findall(r'(\w+\.\w+)\s+[0-9]+', criteria))
            attr_list = set(self.corp.get_conf('ATTRLIST').split(','))
            return crit_attrs <= attr_list

        app = bgcalc.calc_backend_client(settings)
        corp_info = self.get_corpus_info(self.args.corpname)
        fcrit = f'{request.json.get("attr")} {request.json.get("position")}'
        if is_non_structural_attr(fcrit):
            rel_mode = 1
        else:
            rel_mode = 0

        task_ids = {}
        for conc_id in request.json.get('conc_ids'):
            args = bgcalc.freq_calc.FreqCalsArgs()
            args.corpname = self.corp.corpname
            args.subcname = getattr(self.corp, 'subcname', None)
            args.subcpath = self.subcpath
            args.user_id = self.session_get('user', 'id')
            args.q = [f'~{conc_id}']
            args.fromp = 0
            args.pagesize = 50
            args.samplesize = 0
            args.flimit = 0
            args.fcrit = fcrit
            args.freq_sort = 'freq'
            args.ftt_include_empty = False
            args.rel_mode = rel_mode
            args.collator_locale = corp_info.collator_locale
            args.fmaxitems = 10000
            args.fpage = 0

            res = app.send_task(
                'calculate_freqs',
                args=(args.to_dict(),),
                time_limit=60
            )
            self._store_async_task(AsyncTaskStatus(
                status=res.status,
                ident=res.id,
                category=AsyncTaskStatus.CATEGORY_PQUERY,
                label=f'{fcrit}:{conc_id}',
                args={
                    'corpname': request.json.get('corpname'),
                    'usesubcorp': request.json.get('usesubcorp'),
                    'conc_id': conc_id,
                    'attr': request.json.get('attr'),
                    'position': request.json.get('position')
                }
            ))
            task_ids[conc_id] = res.id

        return task_ids

    @exposed(http_method='POST', return_type='json', skip_corpus_init=True)
    def save_query(self, request):
        args = PqueryFormArgs()
        args.update_by_user_query(request.json)
        with plugins.runtime.QUERY_STORAGE as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
            query_id = qp.store(user_id=self.session_get('user', 'id'), curr_data=args.to_dict())
            qh.write(user_id=self.session_get('user', 'id'), query_id=query_id, qtype='pquery')
        return dict(ok=True, query_id=query_id)
