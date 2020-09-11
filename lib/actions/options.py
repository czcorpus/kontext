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

    def __init__(self, request, ui_lang):
        super(Options, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/options/'

    def _set_new_viewopts(self, newctxsize=0, ctxunit='', line_numbers=0, cql_editor=0):
        if ctxunit == '@pos':
            ctxunit = ''
        if "%s%s" % (newctxsize, ctxunit) != self.args.kwicrightctx:
            self.args.kwicleftctx = '-%s%s' % (newctxsize, ctxunit)
            self.args.kwicrightctx = '%s%s' % (newctxsize, ctxunit)
        self.args.line_numbers = line_numbers
        self.args.cql_editor = cql_editor

    def _set_new_corp_options(self, setattrs=(), setattr_vmode='', setstructs=(), setrefs=(),
                              setstructattrs=(), setqs_visibility_mode=2):
        if self.BASE_ATTR not in setattrs:
            setattrs = (self.BASE_ATTR, ) + tuple(setattrs)
        self.args.attrs = ','.join(setattrs)
        self.args.structs = ','.join(setstructs)
        self.args.refs = ','.join(setrefs)
        self.args.attr_vmode = setattr_vmode
        self.args.structattrs = setstructattrs
        self.args.qs_visibility_mode = setqs_visibility_mode

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
        out['AttrList'] = [{'label': corp.get_conf(n + '.LABEL') or n, 'n': n}
                           for n in corp.get_conf('ATTRLIST').split(',')
                           if n]
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
        out['qs_visibility_mode'] = self.args.qs_visibility_mode

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

    @exposed(access_level=0, template='view.html', page_model='view', func_arg_mapped=True, http_method='POST')
    def viewattrsx(self, setattrs=(), setattr_vmode='', setstructs=(), setrefs=(),
                   setstructattrs=(), setqs_visibility_mode=2):
        self._set_new_corp_options(setattrs=setattrs,
                                   setattr_vmode=setattr_vmode,
                                   setstructs=setstructs,
                                   setrefs=setrefs,
                                   setstructattrs=setstructattrs,
                                   setqs_visibility_mode=setqs_visibility_mode)
        self._save_options(['attrs', 'attr_vmode', 'structs', 'refs', 'structattrs', 'base_viewattr',
                            'qs_visibility_mode'],
                           self.args.corpname)
        if self.args.format == 'json':
            return dict(widectx_globals=self._get_mapped_attrs(
                WidectxArgsMapping, dict(structs=self._get_struct_opts())))
        elif self.args.q:
            self._redirect_to_conc()
        else:
            self.redirect('/query')

    @exposed(access_level=0, return_type='json', http_method='GET', skip_corpus_init=True)
    def viewopts(self, _):
        return dict(
            pagesize=self.args.pagesize,
            newctxsize=self.args.kwicleftctx[1:],
            ctxunit='@pos',
            line_numbers=self.args.line_numbers,
            shuffle=self.args.shuffle,
            wlpagesize=self.args.wlpagesize,
            fmaxitems=self.args.fmaxitems,
            citemsperpage=self.args.citemsperpage,
            cql_editor=self.args.cql_editor
        )

    @exposed(access_level=0, return_type='json', http_method='POST', func_arg_mapped=True, skip_corpus_init=True)
    def viewoptsx(self, newctxsize=0, ctxunit='', line_numbers=0, cql_editor=0):
        self._set_new_viewopts(newctxsize=newctxsize, ctxunit=ctxunit, line_numbers=line_numbers,
                               cql_editor=cql_editor)
        self._save_options(self.GENERAL_OPTIONS)
        return {}

    @exposed(access_level=1, skip_corpus_init=True, return_type='json', http_method='POST')
    def toggle_conc_dashboard(self, request):
        return {}
