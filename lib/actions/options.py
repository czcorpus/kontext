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
from controller.kontext import Kontext, MainMenu
from translation import ugettext as _
import corplib
from argmapping import WidectxArgsMapping


class Options(Kontext):

    def __init__(self, request, ui_lang):
        super(Options, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/options/'

    def _set_new_viewopts(self, newctxsize='', ctxunit='', line_numbers=0, tt_overview=0, cql_editor=0):
        if ctxunit == '@pos':
            ctxunit = ''
        if "%s%s" % (newctxsize, ctxunit) != self.args.kwicrightctx:
            if not newctxsize.isdigit():
                self._exceptmethod = 'viewattrs'
                raise Exception(
                    _('Value [%s] cannot be used as a context width. Please use numbers 0,1,2,...') % newctxsize)
            self.args.kwicleftctx = '-%s%s' % (newctxsize, ctxunit)
            self.args.kwicrightctx = '%s%s' % (newctxsize, ctxunit)
        self.args.line_numbers = line_numbers
        self.args.tt_overview = tt_overview
        self.args.cql_editor = cql_editor

    def _set_new_viewattrs(self, setattrs=(), allpos='', setstructs=(), setrefs=(), structattrs=()):
        self.args.attrs = ','.join(setattrs)
        self.args.structs = ','.join(setstructs)
        self.args.refs = ','.join(setrefs)
        self.args.attr_allpos = allpos
        if allpos == 'all':
            self.args.ctxattrs = self.args.attrs
        else:
            self.args.ctxattrs = 'word'
        self.args.structattrs = structattrs

    @exposed(access_level=1, vars=('concsize', ), legacy=True, return_type='json')
    def viewattrs(self):
        """
        attrs, refs, structs form
        """
        from collections import defaultdict

        if len(self.args.q) == 0:
            self.disabled_menu_items = (MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.VIEW,
                                        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)

        out = {}
        if self.args.maincorp:
            corp = corplib.manatee.Corpus(self.args.maincorp)
        else:
            corp = self.corp
        out['AttrList'] = [{'label': corp.get_conf(n + '.LABEL') or n, 'n': n}
                           for n in corp.get_conf('ATTRLIST').split(',')
                           if n]
        out['fixed_attr'] = 'word'
        out['attr_allpos'] = self.args.attr_allpos
        out['attr_vmode'] = self.args.attr_vmode
        availstruct = corp.get_conf('STRUCTLIST').split(',')
        structlist = set(self.args.structs.split(',')).union(
            set([x.split('.')[0] for x in self.args.structattrs]))
        out['Availstructs'] = [{'n': n,
                                'sel': 'selected' if n in structlist else '',
                                'label': corp.get_conf(n + '.LABEL')}
                               for n in availstruct if n and n != '#']

        availref = corp.get_conf('STRUCTATTRLIST').split(',')
        reflist = self.args.refs.split(',') if self.args.refs else []
        structattrs = defaultdict(list)

        def ref_is_allowed(r):
            return r and r not in (
                '#', self.get_corpus_info(self.args.corpname).get('speech_segment'))

        for item in availref:
            if ref_is_allowed(item):
                k, v = item.split('.', 1)
                structattrs[k].append(v)
        out['Availrefs'] = [dict(n='#', label=_('Token number'),
                                 sel='selected' if '#' in reflist else '')]
        for n in availref:
            if ref_is_allowed(n):
                out['Availrefs'].append(dict(n='=' + n, sel='selected' if ('=' + n) in reflist else '',
                                             label=(corp.get_conf(n + '.LABEL') or n)))

        doc = corp.get_conf('DOCSTRUCTURE')
        if doc in availstruct:
            out['Availrefs'].insert(1, dict(n=doc, label=_('Document number'),
                                            sel=(doc in reflist and 'selected' or '')))
        out['newctxsize'] = self.args.kwicleftctx[1:]
        out['structattrs'] = structattrs
        out['curr_structattrs'] = self.args.structattrs
        out['query_overview'] = self.concdesc_json().get('Desc', [])
        out['CurrentAttrs'] = self.args.attrs.split(',')
        out['use_conc_toolbar'] = settings.get_bool('global', 'use_conc_toolbar')
        return out

    @exposed(access_level=1, template='view.tmpl', page_model='view', legacy=True, http_method='POST')
    def viewattrsx(self, setattrs=(), allpos='', setstructs=(), setrefs=(), structattrs=()):
        self._set_new_viewattrs(setattrs=setattrs,
                                allpos=allpos,
                                setstructs=setstructs,
                                setrefs=setrefs,
                                structattrs=structattrs)
        self._save_options(['attrs', 'attr_vmode', 'ctxattrs', 'structs',
                            'refs', 'structattrs'], self.args.corpname)
        if self.args.format == 'json':
            return dict(widectx_globals=self._get_attrs(WidectxArgsMapping, dict(structs=self._get_struct_opts())))
        elif self.args.q:
            self._redirect_to_conc()
        else:
            self.redirect('/first_form')

    @exposed(access_level=1, return_type='json', http_method='GET', skip_corpus_init=True)
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
            tt_overview=self.args.tt_overview,
            cql_editor=self.args.cql_editor
        )

    @exposed(access_level=1, return_type='json', http_method='POST', legacy=True, skip_corpus_init=True)
    def viewoptsx(self, newctxsize='', ctxunit='', line_numbers=0, tt_overview=0, cql_editor=0):
        self._set_new_viewopts(newctxsize=newctxsize, ctxunit=ctxunit, line_numbers=line_numbers,
                               tt_overview=tt_overview, cql_editor=cql_editor)
        self._save_options(self.GENERAL_OPTIONS)
        return {}

    @exposed(access_level=1, return_type='json', http_method='POST')
    def set_tt_overview(self, request):
        self._save_options(('tt_overview',))
        return {}
