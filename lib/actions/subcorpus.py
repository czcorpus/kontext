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


class Subcorpus(Kontext):

    def __init__(self, request, ui_lang):
        super(Subcorpus, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/subcorpus/'

    def _create_subcorpus(self, request):
        """
        req. arguments:
        subcname -- name of new subcorpus
        create -- bool, sets whether to create new subcorpus
        within_condition -- custom within condition; if non-empty then clickable form is omitted
        within_struct -- a structure the within_condition will be applied to
        """
        subcname = request.form['subcname']
        within_condition = request.form['within_condition']
        within_struct = request.form['within_struct']
        corp_encoding = self._corp().get_conf('ENCODING')

        if within_condition and within_struct:  # user entered a subcorpus query manually
            tt_query = [(export_string(within_struct, to_encoding=corp_encoding),
                        export_string(within_condition, to_encoding=corp_encoding))]
        else:
            tt_query = self._texttype_query(request)
            within_struct = import_string(tt_query[0][0], from_encoding=corp_encoding)
            within_condition = import_string(tt_query[0][1], from_encoding=corp_encoding)

        basecorpname = self.corpname.split(':')[0]
        if not subcname:
            raise ConcError(_('No subcorpus name specified!'))

        path = os.path.join(self.subcpath[-1], basecorpname)
        if not os.path.isdir(path):
            os.makedirs(path)
        path = os.path.join(path, subcname) + '.subc'
        if not tt_query:
            raise ConcError(_('Nothing specified!'))

        # Even if _texttype_query() parsed multiple structures into tt_query,
        # Manatee can accept directly only one (but with arbitrarily complex attribute
        # condition).
        # For this reason, we choose only the first struct+condition pair.
        # It is up to the user interface to deal with it.
        structname, subquery = tt_query[0]
        if type(path) == unicode:
            path = path.encode("utf-8")
        if corplib.create_subcorpus(path, self._corp(), structname, subquery):
            if plugins.has_plugin('subc_restore'):
                try:
                    plugins.subc_restore.store_query(user_id=self._session_get('user', 'id'),
                                                     corpname=self.corpname,
                                                     subcname=subcname,
                                                     structname=within_struct,
                                                     condition=within_condition)
                    raise Exception('foo')
                except Exception as e:
                    logging.getLogger(__name__).warning('Failed to store subcorpus query: %s' % e)
                    self.add_system_message('warning',
                                            _('Subcorpus created but there was a problem saving a backup copy.'))
            return {}
        else:
            raise ConcError(_('Empty subcorpus!'))


    @exposed(access_level=1, template='subcorpus/subcorp_form.tmpl', page_model='subcorpForm')
    def subcorp(self, request):
        try:
            ans = self._create_subcorpus(request)
            self._redirect('subcorpus/subcorp_list?corpname=%s' % self.corpname)
        except Exception:
            ans = self.subcorp_form(request)
        return ans

    @exposed()
    def subcorp_form(self, request):
        """
        Displays a form to create a new subcorpus
        """
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS
        self._reset_session_conc()
        method = request.form.get('method', 'gui')
        within_condition = request.form.get('within_condition', None)
        within_struct = request.form.get('within_struct', None)
        subcname = request.form.get('subcname', None)

        try:
            tt_sel = self._texttypes_with_norms()
        except UserActionException as e:
            tt_sel = {'Normslist': [], 'Blocks': []}
            self.add_system_message('warning', e)
        structs_and_attrs = {}
        for s, a in [t.split('.') for t in self._corp().get_conf('STRUCTATTRLIST').split(',')]:
            if s not in structs_and_attrs:
                structs_and_attrs[s] = []
            structs_and_attrs[s].append(a)

        out = {'SubcorpList': ()}
        if self.environ['REQUEST_METHOD'] == 'POST':
            out['checked_sca'] = {}
            for p in request.form.keys():
                if p.startswith('sca_'):
                    out['checked_sca'][p[4:]] = request.form.getlist(p)

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
        Displays a list of user subcorpora. In case there is a 'subc_restore' plug-in
        installed then the list is enriched by additional re-use/undelete information.
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

        # TODO sorting does not work
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
        return {
            'subCorpusName': subcname,
            'corpusSize': format_number(sc.size()),
            'subCorpusSize': format_number(sc.search_size())
        }
