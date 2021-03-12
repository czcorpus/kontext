# Copyright (c) 2015 Institute of the Czech National Corpus
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


import settings
from controller import exposed
from controller.kontext import Kontext
from translation import ugettext as translate
import corplib
from argmapping import WidectxArgsMapping


class Options(Kontext):

    def get_mapping_url_prefix(self):
        return '/options/'

    def _set_new_viewopts(self, pagesize=0, newctxsize=0, ctxunit='',
                          line_numbers=False, shuffle=False, wlpagesize=0,
                          fmaxitems=0, citemsperpage=0, pqueryitemsperpage=0, rich_query_editor=False):
        self.args.pagesize = pagesize
        if ctxunit == '@pos':
            ctxunit = ''
        new_kwicright = f'{newctxsize}{ctxunit}'
        if new_kwicright != self.args.kwicrightctx:
            self.args.kwicleftctx = f'-{new_kwicright}'
            self.args.kwicrightctx = new_kwicright
        self.args.line_numbers = line_numbers
        self.args.shuffle = int(shuffle)
        self.args.wlpagesize = wlpagesize
        self.args.fmaxitems = fmaxitems
        self.args.citemsperpage = citemsperpage
        self.args.pqueryitemsperpage = pqueryitemsperpage
        self.args.rich_query_editor = rich_query_editor

    def _set_new_corp_options(self, attrs=(), attr_vmode='', structs=(), refs=(),
                              structattrs=(), base_viewattr='word', qs_enabled=True):
        if self.BASE_ATTR not in attrs:
            attrs = (self.BASE_ATTR, ) + tuple(attrs)
        self.args.attrs = ','.join(attrs)
        self.args.structs = ','.join(structs)
        self.args.refs = ','.join(refs)
        self.args.attr_vmode = attr_vmode
        self.args.structattrs = structattrs
        self.args.base_viewattr = base_viewattr
        self.args.qs_enabled = qs_enabled

    @exposed(access_level=0, vars=('concsize', ), return_type='json')
    def viewattrs(self, _):
        """
        attrs, refs, structs form
        """
        from collections import defaultdict

        out = {}
        if self.args.maincorp:
            corp = corplib.manatee.Corpus(self.args.maincorp)
        else:
            corp = self.corp
        out['AttrList'] = [{
            'label': corp.get_conf(n + '.LABEL') or n,
            'n': n,
            'multisep': corp.get_conf(n + '.MULTISEP')
        } for n in corp.get_conf('ATTRLIST').split(',') if n]
        out['fixed_attr'] = 'word'
        out['attr_vmode'] = self.args.attr_vmode
        availstruct = corp.get_conf('STRUCTLIST').split(',')
        structlist = set(self.args.structs.split(',')).union(
            set([x.split('.')[0] for x in self.args.structattrs]))
        out['Availstructs'] = [{'n': n,
                                'sel': 'selected' if n in structlist else '',
                                'label': corp.get_conf(n + '.LABEL')}
                               for n in availstruct if n and n != '#']
        out['base_viewattr'] = self.args.base_viewattr
        availref = corp.get_conf('STRUCTATTRLIST').split(',')
        reflist = self.args.refs.split(',') if self.args.refs else []
        structattrs = defaultdict(list)
        out['qs_enabled'] = self.args.qs_enabled

        def ref_is_allowed(r):
            return r and r not in (
                '#', self.get_corpus_info(self.args.corpname).get('speech_segment'))

        for item in availref:
            if ref_is_allowed(item):
                k, v = item.split('.', 1)
                structattrs[k].append(v)
        out['Availrefs'] = [dict(n='#', label=translate('Token number'),
                                 sel='selected' if '#' in reflist else '')]
        for n in availref:
            if ref_is_allowed(n):
                out['Availrefs'].append(dict(n='=' + n, sel='selected' if ('=' + n) in reflist else '',
                                             label=(corp.get_conf(n + '.LABEL') or n)))

        doc = corp.get_conf('DOCSTRUCTURE')
        if doc in availstruct:
            out['Availrefs'].insert(1, dict(n=doc, label=translate('Document number'),
                                            sel=(doc in reflist and 'selected' or '')))
        out['newctxsize'] = self.args.kwicleftctx[1:]
        out['structattrs'] = structattrs
        out['curr_structattrs'] = self.args.structattrs
        out['query_overview'] = self.concdesc_json().get('Desc', [])
        out['CurrentAttrs'] = self.args.attrs.split(',')
        out['use_conc_toolbar'] = settings.get_bool('global', 'use_conc_toolbar')
        return out

    @exposed(access_level=0, return_type='json', http_method='POST')
    def viewattrsx(self, request):
        self._set_new_corp_options(attrs=request.json.get('attrs'),
                                   attr_vmode=request.json.get('attr_vmode'),
                                   structs=request.json.get('structs'),
                                   refs=request.json.get('refs', ()),
                                   structattrs=request.json.get('structattrs'),
                                   qs_enabled=request.json.get('qs_enabled'),
                                   base_viewattr=request.json.get('base_viewattr'))
        self._save_options(['attrs', 'attr_vmode', 'structs', 'refs', 'structattrs', 'base_viewattr',
                            'qs_enabled'],
                           self.args.corpname)
        return dict(
            widectx_globals=self._get_mapped_attrs(
                WidectxArgsMapping, dict(structs=self._get_struct_opts())),
            conc_args=self._get_curr_conc_args()
        )

    @exposed(access_level=0, return_type='json', http_method='GET', skip_corpus_init=True)
    def viewopts(self, _):
        return dict(
            pagesize=self.args.pagesize,
            newctxsize=self.args.kwicleftctx[1:],
            ctxunit='@pos',
            line_numbers=self.args.line_numbers,
            shuffle=bool(self.args.shuffle),
            wlpagesize=self.args.wlpagesize,
            fmaxitems=self.args.fmaxitems,
            citemsperpage=self.args.citemsperpage,
            pqueryitemsperpage=self.args.pqueryitemsperpage,
            rich_query_editor=self.args.rich_query_editor
        )

    @exposed(access_level=0, return_type='json', http_method='POST', skip_corpus_init=True)
    def viewoptsx(self, request):
        self._set_new_viewopts(
            pagesize=request.json.get('pagesize'),
            newctxsize=request.json.get('newctxsize'),
            ctxunit=request.json.get('ctxunit'),
            line_numbers=request.json.get('line_numbers'),
            shuffle=request.json.get('shuffle'),
            wlpagesize=request.json.get('wlpagesize'),
            fmaxitems=request.json.get('fmaxitems'),
            citemsperpage=request.json.get('citemsperpage'),
            pqueryitemsperpage=request.json.get('pqueryitemsperpage'),
            rich_query_editor=request.json.get('rich_query_editor')
        )
        self._save_options(self.GENERAL_OPTIONS)
        return {}

    @exposed(access_level=1, skip_corpus_init=True, return_type='json', http_method='POST')
    def toggle_conc_dashboard(self, request):
        return {}
