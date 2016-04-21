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


from controller import exposed
from kontext import Kontext, MainMenu
from translation import ugettext as _
import plugins
import corplib


class Options(Kontext):

    def __init__(self, request, ui_lang):
        super(Options, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/options/'

    def _set_new_viewopts(self, newctxsize='', refs_up='', ctxunit='', line_numbers=0):
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

    @exposed(access_level=1, vars=('concsize', ), legacy=True)
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
            out['AttrList'] = [{'label': corp.get_conf(n + '.LABEL') or n, 'n': n}
                               for n in corp.get_conf('ATTRLIST').split(',')
                               if n]
        else:
            corp = self._corp()
        out['fixed_attr'] = 'word'
        availstruct = corp.get_conf('STRUCTLIST').split(',')
        structlist = self.args.structs.split(',')
        out['Availstructs'] = [{'n': n,
                                'sel': 'selected' if n in structlist else '',
                                'label': corp.get_conf(n + '.LABEL')}
                               for n in availstruct if n and n != '#']

        availref = corp.get_conf('STRUCTATTRLIST').split(',')
        structattrs = defaultdict(list)
        reflist = self.args.refs.split(',') if self.args.refs else []

        def ref_is_allowed(r):
            return r and r not in (
                '#', plugins.get('corparch').get_corpus_info(self.args.corpname).get('speech_segment'))

        for item in availref:
            if ref_is_allowed(item):
                k, v = item.split('.', 1)
                structattrs[k].append(v)
        out['Availrefs'] = [{
                            'n': '#',
                            'label': _('Token number'),
                            'sel': 'selected' if '#' in reflist else ''
                            }] + \
                           [{
                            'n': '=' + n,
                            'sel': 'selected' if ('=' + n) in reflist else '',
                            'label': (corp.get_conf(n + '.LABEL') or n)
                            }
                            for n in availref if ref_is_allowed(n)
                            ]
        doc = corp.get_conf('DOCSTRUCTURE')
        if doc in availstruct:
            out['Availrefs'].insert(1, {'n': doc, 'label': _('Document number'),
                                        'sel': (doc in reflist and 'selected' or '')})
        out['newctxsize'] = self.args.kwicleftctx[1:]
        out['structattrs'] = structattrs
        out['curr_structattrs'] = self.args.structattrs
        out['query_overview'] = self.concdesc_json().get('Desc', [])
        return out

    @exposed(access_level=1, template='view.tmpl', page_model='view', legacy=True)
    def viewattrsx(self, setattrs=(), allpos='', setstructs=(), setrefs=(), structattrs=(), shuffle=0):
        self._set_new_viewattrs(setattrs=setattrs,
                                allpos=allpos,
                                setstructs=setstructs,
                                setrefs=setrefs,
                                structattrs=structattrs)
        self._save_options(['attrs', 'ctxattrs', 'structs', 'refs', 'structattrs'], self.args.corpname)
        # TODO refs_up ???
        if self.args.q:
            self._redirect_to_conc()
        else:
            self._redirect('/first_form')

    @exposed(access_level=1, legacy=True)
    def viewopts(self):
        self.disabled_menu_items = (MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
        out = {
            'newctxsize': self.args.kwicleftctx[1:]
        }
        return out

    @exposed(access_level=1, template='view.tmpl', page_model='view', legacy=True)
    def viewoptsx(self, newctxsize='', ctxunit='', refs_up='', line_numbers=0):
        self._set_new_viewopts(newctxsize=newctxsize, refs_up=refs_up, ctxunit=ctxunit, line_numbers=line_numbers)
        self._save_options(self.GENERAL_OPTIONS)

        if self.args.q:
            return self._redirect_to_conc()
        else:
            self._redirect(self.get_root_url() + 'first_form')
