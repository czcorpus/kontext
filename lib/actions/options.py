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

import os
import logging

from controller import exposed
from kontext import Kontext, ConcError, MainMenu, UserActionException
from translation import ugettext as _
import plugins
import l10n
from l10n import export_string, import_string, format_number
import corplib


class Options(Kontext):

    def __init__(self, request, ui_lang):
        super(Options, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/options/'

    def _set_new_viewopts(self, newctxsize='', refs_up='', ctxunit=''):
        if ctxunit == '@pos':
            ctxunit = ''
        if "%s%s" % (newctxsize, ctxunit) != self.kwicrightctx:
            if not newctxsize.isdigit():
                self.exceptmethod = 'viewattrs'
                raise Exception(
                    _('Value [%s] cannot be used as a context width. Please use numbers 0,1,2,...') % newctxsize)
            self.kwicleftctx = '-%s%s' % (newctxsize, ctxunit)
            self.kwicrightctx = '%s%s' % (newctxsize, ctxunit)

    def _set_new_viewattrs(self, setattrs=(), allpos='', setstructs=(), setrefs=(), structattrs=()):
        self.attrs = ','.join(setattrs)
        self.structs = ','.join(setstructs)
        self.refs = ','.join(setrefs)
        self.attr_allpos = allpos
        if allpos == 'all':
            self.ctxattrs = self.attrs
        else:
            self.ctxattrs = 'word'
        self.structattrs = structattrs

    @exposed(access_level=1, vars=('concsize', ), legacy=True)
    def viewattrs(self):
        """
        attrs, refs, structs form
        """
        from collections import defaultdict

        self.disabled_menu_items = (MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
        out = {}
        if self.maincorp:
            corp = corplib.manatee.Corpus(self.maincorp)
            out['AttrList'] = [{'label': corp.get_conf(n + '.LABEL') or n, 'n': n}
                               for n in corp.get_conf('ATTRLIST').split(',')
                               if n]
        else:
            corp = self._corp()
        availstruct = corp.get_conf('STRUCTLIST').split(',')
        structlist = self.structs.split(',')
        out['Availstructs'] = [{'n': n,
                                'sel': (((n in structlist)
                                         and 'selected') or ''),
                                'label': corp.get_conf(n + '.LABEL')}
                               for n in availstruct if n and n != '#']

        availref = corp.get_conf('STRUCTATTRLIST').split(',')
        structattrs = defaultdict(list)
        reflist = self.refs.split(',')

        ref_is_allowed = lambda r: r and r not in (
            '#', plugins.corptree.get_corpus_info(self.corpname).get('speech_segment'))

        for item in availref:
            if ref_is_allowed(item):
                k, v = item.split('.', 1)
                structattrs[k].append(v)
                if not k in reflist:
                    reflist.append(k)

        out['Availrefs'] = [{
                            'n': '#',
                            'label': _('Token number'),
                            'sel': ((('#' in reflist) and 'selected') or '')
                            }] + \
                           [{
                            'n': '=' + n,
                            'sel': ((('=' + n in reflist) and 'selected') or ''),
                            'label': (corp.get_conf(n + '.LABEL') or n)
                            }
                            for n in availref if ref_is_allowed(n)
                            ]
        doc = corp.get_conf('DOCSTRUCTURE')
        if doc in availstruct:
            out['Availrefs'].insert(1, {'n': doc, 'label': _('Document number'),
                                        'sel': (doc in reflist and 'selected' or '')})
        out['newctxsize'] = self.kwicleftctx[1:]
        out['structattrs'] = structattrs
        out['curr_structattrs'] = self.structattrs
        return out

    @exposed(access_level=1, template='view.tmpl', page_model='view', legacy=True)
    def viewattrsx(self, setattrs=(), allpos='', setstructs=(), setrefs=(), structattrs=(), shuffle=0):
        self._set_new_viewattrs(setattrs=setattrs,
                                allpos=allpos,
                                setstructs=setstructs,
                                setrefs=setrefs,
                                structattrs=structattrs)
        self._save_options(['attrs', 'ctxattrs', 'structs', 'refs', 'structattrs'], self.corpname)
        # TODO refs_up ???
        if self.q:
            self._redirect_to_conc()
        else:
            self._redirect('/first_form')

    @exposed(access_level=1, legacy=True)
    def viewopts(self):
        self.disabled_menu_items = (MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
        out = {
            'newctxsize': self.kwicleftctx[1:]
        }
        return out

    @exposed(access_level=1, template='view.tmpl', page_model='view', legacy=True)
    def viewoptsx(self, newctxsize='', ctxunit='', refs_up='', shuffle=0):
        # TODO pagesize?
        self._set_new_viewopts(newctxsize=newctxsize, refs_up=refs_up, ctxunit=ctxunit)
        self._save_options(self.GENERAL_OPTIONS)

        if self.q:
            return self.view()
        else:
            self._redirect('/first_form')