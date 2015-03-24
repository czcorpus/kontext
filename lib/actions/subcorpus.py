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

import urllib
import os
import logging

import settings
from controller import exposed
from kontext import Kontext, ConcError, MainMenu
from translation import ugettext as _
import plugins
import l10n
from l10n import export_string, format_number
import corplib


class Subcorpus(Kontext):

    def __init__(self, request, ui_lang):
        super(Subcorpus, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/subcorpus/'

    def _create_subcorpus(self, request):
        """
        req. arguments:
        subcname -- name of new subcorpus
        delete -- sets whether to delete existing subcorpus; any non-empty value means 'delete'
        create -- bool, sets whether to create new subcorpus
        within_condition -- custom within condition; if non-empty then clickable form is omitted
        within_struct -- a structure the within_condition will be applied to
        method -- {'raw', 'gui'} a flag indicating whether user used raw query or clickable attribute list; this is
                  actually used only to display proper user interface (i.e. not to detect which values to use when
                  creating the subcorpus)
        """
        # subcname, delete, create, within_condition, within_struct, method
        subcname = request.form['subcname']
        delete = int(request.form.get('delete', 0))
        create = int(request.form.get('create', 0))
        within_condition = request.form['within_condition']
        within_struct = request.form['within_struct']

        if self.get_http_method() != 'POST':
            self.last_corpname = self.corpname
            self._save_options(['last_corpname'])
            self._redirect('%ssubcorp_form?corpname=%s' % (self.get_root_url(), self.corpname))
            return None
        if delete:
            base = os.path.join(self.subcpath[-1], self.corpname, subcname)
            for e in ('.subc', '.used'):
                if os.path.isfile((base + e).encode('utf-8')):
                    os.unlink((base + e).encode('utf-8'))

        if within_condition and within_struct:
            within_struct = export_string(within_struct, to_encoding=self._corp().get_conf('ENCODING'))
            within_condition = export_string(within_condition, to_encoding=self._corp().get_conf('ENCODING'))
            tt_query = [(within_struct, within_condition)]
        else:
            tt_query = self._texttype_query(request)
        basecorpname = self.corpname.split(':')[0]
        if create and not subcname:
            raise ConcError(_('No subcorpus name specified!'))
        if (not subcname or (not tt_query and delete)
                or (subcname and not delete and not create)):
            # an error => generate subc_form parameters
            subc_list = self.cm.subcorp_names(basecorpname)
            for item in subc_list:
                item['selected'] = False
            if subc_list:
                subcname = subc_list[0]['n']
                subc_list[0]['selected'] = True
                sc = self.cm.get_Corpus('%s:%s' % (basecorpname, subcname))
                corp_size = format_number(sc.size())
                subcorp_size = format_number(sc.search_size())
            else:
                subc_list = []
                corp_size = 0
                subcorp_size = 0

            return {
                'subcname': subcname,
                'corpsize': corp_size,
                'subcsize': subcorp_size,
                'SubcorpList': subc_list,
                'fetchSubcInfo': 'false'  # this is ok (it is used as a JavaScript value)
            }
        path = os.path.join(self.subcpath[-1], basecorpname)
        if not os.path.isdir(path):
            os.makedirs(path)
        path = os.path.join(path, subcname) + '.subc'
        # XXX ignoring more structures
        if not tt_query:
            raise ConcError(_('Nothing specified!'))
        structname, subquery = tt_query[0]
        if type(path) == unicode:
            path = path.encode("utf-8")
        if corplib.create_subcorpus(path, self._corp(), structname, subquery):
            if plugins.has_plugin('subc_restore'):
                try:
                    plugins.subc_restore.store_query(user_id=self._session_get('user', 'id'), corpname=self.corpname,
                                                     subcname=subcname, structname=tt_query[0][0],
                                                     condition=tt_query[0][1])
                except Exception as e:
                    logging.getLogger(__name__).warning('Failed to store subcorpus query: %s' % e)
            return {}
        else:
            raise ConcError(_('Empty subcorpus!'))


    @exposed(access_level=1)
    def subcorp(self, request):
        ans = self._create_subcorpus(request)
        self._redirect('subcorpus/subcorp_list?corpname=%s' % self.corpname)
        return ans

    @exposed(legacy=True)
    def subcorp_form(self, subcorpattrs='', subcname='', within_condition='', within_struct='', method='gui'):
        """
        arguments:
        subcorpattrs -- ???
        within_condition -- the same meaning as in subcorp()
        within_struct -- the same meaning as in subcorp()
        method -- the same meaning as in subcorp()
        """
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS
        self._reset_session_conc()

        tt_sel = self._texttypes_with_norms()
        structs_and_attrs = {}
        for s, a in [t.split('.') for t in self._corp().get_conf('STRUCTATTRLIST').split(',')]:
            if not s in structs_and_attrs:
                structs_and_attrs[s] = []
            structs_and_attrs[s].append(a)

        out = {}
        out['SubcorpList'] = ()
        if self.environ['REQUEST_METHOD'] == 'POST':
            out['checked_sca'] = {}
            for p in self._url_parameters:
                if p.startswith('sca_'):
                    for checked_value in getattr(self, p):
                        out['checked_sca'][checked_value] = True

        if 'error' in tt_sel:
            out.update({
                'message': ('error', tt_sel['error']),
                'TextTypeSel': tt_sel,
                'structs_and_attrs': structs_and_attrs,
                'method': method,
                'within_condition': '',
                'within_struct': '',
                'subcname': ''
            })
        else:
            out.update({
                'TextTypeSel': tt_sel,
                'structs_and_attrs': structs_and_attrs,
                'method': method,
                'within_condition': within_condition,
                'within_struct': within_struct,
                'subcname': subcname
            })
        return out


    @exposed(access_level=1, return_type='json')
    def ajax_create_subcorpus(self, request):
        return self._create_subcorpus(request)

    def _delete_subcorpora(self, subc_list):
        base = self.subcpath[-1]
        for subcorp_id in subc_list:
            try:
                corp, subcorp = subcorp_id.split(':', 1)
                os.unlink(os.path.join(base, corp, subcorp).encode('utf-8') + '.subc')
            except Exception as e:
                self.add_system_message('error', e)

    def _create_full_subc_list(self, queries, subc_files):
        pass


    @exposed(access_level=1)
    def subcorp_list(self, request):
        """
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)

        sort = 'n'  # TODO
        show_deleted = int(request.args.get('show_deleted', 0))
        current_corp = self.corpname
        if self.get_http_method() == 'POST':
            selected_subc = request.form.getlist('selected_subc')
            self._delete_subcorpora(selected_subc)

        data = []
        corplist = plugins.auth.get_corplist(self._session_get('user', 'id'))
        for corp in corplist:
            try:
                self.cm.get_Corpus(corp)
                basecorpname = corp.split(':')[0]
                for item in self.cm.subcorp_names(basecorpname):
                    sc = self.cm.get_Corpus(corp, item['n'])
                    subc_id = '%s:%s' % (corp, item['n'])
                    data.append({
                        'n': subc_id,
                        'v': item['n'],
                        'size': sc.search_size(),
                        'created': sc.created,
                        'corpname': corp,
                        'usesubcorp': item['n'],
                        'deleted': False
                    })
            except Exception as e:
                logging.getLogger(__name__).warn('Failed to fetch information about subcorpus of [%s]: %s' % (corp, e))

        if plugins.has_plugin('subc_restore'):
            try:
                full_list = plugins.subc_restore.extend_subc_list(data, self._session_get('user', 'id'),
                                                                  bool(show_deleted), 0)
            except Exception as e:
                logging.getLogger(__name__).error('subc_restore plug-in failed to list queries: %s' % e)
                full_list = []
        else:
            full_list = data

        sort_key, rev = Kontext._parse_sorting_param(sort)
        if sort_key in ('size', 'created'):
            data = sorted(data, key=lambda x: x[sort_key], reverse=rev)
        else:
            data = l10n.sort(data, loc=self.ui_lang, key=lambda x: x[sort_key], reverse=rev)

        sort_keys = dict([(x, (x, '')) for x in ('n', 'size', 'created')])
        if not rev:
            sort_keys[sort_key] = ('-%s' % sort_key, '&#8593;')
        else:
            sort_keys[sort_key] = (sort_key, '&#8595;')

        self.cm.get_Corpus(current_corp)  # this is necessary to reset manatee module back to its original state
        return {
            'subcorp_list': full_list,
            'sort_keys': sort_keys,
            'show_deleted': show_deleted,
            'rev': rev
        }

    @exposed(access_level=1, return_type='json', legacy=True)
    def ajax_subcorp_info(self, subcname=''):
        sc = self.cm.get_Corpus(self.corpname, subcname)
        return {'subCorpusName': subcname,
                'corpusSize': format_number(sc.size()),
                'subCorpusSize': format_number(sc.search_size())}

    @exposed(legacy=True)
    def delsubc_form(self):
        subc = corplib.create_str_vector()
        corplib.find_subcorpora(self.subcpath[-1], subc)
        return {'Subcorplist': [{'n': c} for c in subc],
                'subcorplist_size': min(len(subc), 20)}

    @exposed(template='subcorp_form', legacy=True)
    def delsubc(self, subc=()):
        base = self.subcpath[-1]
        for subcorp in subc:
            cn, sn = subcorp.split(':', 1)
            try:
                os.unlink(os.path.join(base, cn, sn) + '.subc')
            except:
                pass
        return 'Done'
