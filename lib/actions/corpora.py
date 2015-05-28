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

import re
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

    # uses also self.keyword (TODO: cannot define Parameter() here)
    @exposed(legacy=True)
    def corplist(self, max_size='', min_size='', category=''):
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS

        def corp_filter(item):
            if max_size and item['size'] > float(max_size):
                return False
            if min_size and item['size'] < float(min_size):
                return False
            for k in self.keyword:
                if k not in item['metadata']['keywords'].keys():
                    return False
            return True

        corplist = plugins.corptree.get_list(self.permitted_corpora())
        keywords = set()

        for item in corplist:
            full_data = plugins.corptree.get_corpus_info(item['id'], self.ui_lang)
            item['metadata'] = full_data['metadata']
            keywords.update(set(full_data['metadata']['keywords'].items()))

        corplist = filter(corp_filter, corplist)

        for c in corplist:
            c['size'] = l10n.format_number(c['size'])
            c['fullpath'] = '%s%s' % (c['path'], c['id'])

        corplist = sorted(corplist, key=lambda x: x['name'])

        ans = {
            'form': {
                'max_size': max_size,
                'min_size': min_size,
                'category': category
            },
            'corplist': corplist,
            'keywords_labels': l10n.sort(keywords, self.ui_lang, key=lambda elm: elm[0]),
            'keywords': self.keyword,  # singular vs. plural in the attribute name - singular
            'max_size': max_size,      # used because of 'keyword=k1&keyword=k2&...
            'min_size': min_size
        }
        return ans

    @exposed(return_type='json')
    def ajax_list_corpora(self, request):
        corplist = plugins.corptree.get_list(self.permitted_corpora())
        return plugins.corptree.search(corplist, request.args['query'], request.args)

    @exposed(return_type='json', legacy=True)
    def ajax_get_corp_details(self):
        """
        """
        corp_conf_info = plugins.corptree.get_corpus_info(self._corp().corpname)

        ans = {
            'corpname': self._canonical_corpname(self._corp().get_conf('NAME')),
            'description': self._corp().get_info(),
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