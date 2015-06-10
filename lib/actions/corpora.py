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

import logging

from controller import exposed
from kontext import Kontext
from kontext import UserActionException
import plugins
import l10n
from translation import ugettext as _


class Corpora(Kontext):

    def get_mapping_url_prefix(self):
        return '/corpora/'

    @exposed()
    def corplist(self, request):
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS
        return dict(
            corplist_params=plugins.corptree.initial_search_params(request.args.get('query'),
                                                                   request.args),
            corplist_data=plugins.corptree.search(self.permitted_corpora(),
                                                  request.args.get('query'), request.args)
        )

    @exposed(return_type='json')
    def ajax_list_corpora(self, request):
        return plugins.corptree.search(self.permitted_corpora(), request.args['query'],
                                       request.args)

    @exposed(return_type='json', legacy=True)
    def ajax_get_corp_details(self):
        """
        """
        corp_conf_info = plugins.corptree.get_corpus_info(self._corp().corpname)
        encoding = self._corp().get_conf('ENCODING')

        ans = {
            'corpname': l10n.import_string(self._canonical_corpname(self._corp().get_conf('NAME')),
                                           from_encoding=encoding),
            'description': l10n.import_string(self._corp().get_info(), from_encoding=encoding),
            'size': l10n.format_number(int(self._corp().size())),
            'attrlist': [],
            'structlist': [],
            'web_url': corp_conf_info['web'] if corp_conf_info is not None else ''
        }
        try:
            ans['attrlist'] = [{'name': item, 'size': l10n.format_number(int(self._corp().get_attr(item).id_range()))}
                               for item in self._corp().get_conf('ATTRLIST').split(',')]
        except RuntimeError as e:
            logging.getLogger(__name__).warn('%s' % e)
            ans['attrlist'] = {'error': _('Failed to load')}
        ans['structlist'] = [{'name': item, 'size': l10n.format_number(int(self._corp().get_struct(item).size()))}
                             for item in self._corp().get_conf('STRUCTLIST').split(',')]
        return ans

    @exposed(return_type='json', legacy=True)
    def ajax_get_structs_details(self):
        """
        """
        ans = {}
        for item in self._corp().get_conf('STRUCTATTRLIST').split(','):
            k, v = item.split('.')
            if k not in ans:
                ans[k] = []
            ans[k].append(v)
        return ans

    @exposed(return_type='json', legacy=True)
    def ajax_get_tag_variants(self, pattern=''):
        """
        """
        try:
            tag_loader = plugins.taghelper.loader(self.corpname,
                                                  plugins.corptree.get_corpus_info(self.corpname)['tagset'],
                                                  self.ui_lang)
        except IOError:
            raise UserActionException(_('Corpus %s is not supported by this widget.') % self.corpname)

        if len(pattern) > 0:
            ans = tag_loader.get_variant(pattern)
        else:
            ans = tag_loader.get_initial_values()
        return ans