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
from functools import partial
from collections import defaultdict

from controller import exposed
from kontext import Kontext
import plugins
import l10n
from translation import ugettext as _


class Corpora(Kontext):

    def get_mapping_url_prefix(self):
        return '/corpora/'

    @exposed(skip_corpus_init=True)
    def corplist(self, request):
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS
        return dict(
            corplist_params=plugins.get('corparch').initial_search_params(request.args.get('query'),
                                                                          request.args),
            corplist_data=plugins.get('corparch').search(plugin_api=self._plugin_api,
                                                         user_id=self._session_get('user', 'id'),
                                                         query=False,
                                                         offset=0,
                                                         filter_dict=request.args)
        )

    @exposed(return_type='json', skip_corpus_init=True)
    def ajax_list_corpora(self, request):
        return plugins.get('corparch').search(plugin_api=self._plugin_api,
                                              user_id=self._session_get('user', 'id'),
                                              query=request.args['query'],
                                              offset=request.args.get('offset', None),
                                              limit=request.args.get('limit', None),
                                              filter_dict=request.args)

    @exposed(return_type='json', skip_corpus_init=True)
    def ajax_get_corp_details(self, request):
        """
        """
        corp_conf_info = plugins.get('corparch').get_corpus_info(request.args['corpname'])
        corpus = self.cm.get_Corpus(request.args['corpname'])
        citation_info = corp_conf_info.get('citation_info', None)
        citation_info = citation_info.to_dict() if citation_info else {}

        import_str = partial(l10n.import_string, from_encoding=corpus.get_conf('ENCODING'))

        if corpus.get_conf('NAME'):
            corpus_name = corpus.get_conf('NAME')
        else:
            corpus_name = self._canonical_corpname(corpus.corpname)

        ans = {
            'corpname': import_str(corpus_name),
            'description': import_str(corpus.get_info()),
            'size': l10n.format_number(int(corpus.size())),
            'attrlist': [],
            'structlist': [],
            'web_url': corp_conf_info['web'] if corp_conf_info is not None else '',
            'citation_info': citation_info
        }
        try:
            ans['attrlist'] = [{'name': item, 'size': l10n.format_number(int(corpus.get_attr(item).id_range()))}
                               for item in corpus.get_conf('ATTRLIST').split(',')]
        except RuntimeError as e:
            logging.getLogger(__name__).warn('%s' % e)
            ans['attrlist'] = {'error': _('Failed to load')}
        ans['structlist'] = [{'name': item, 'size': l10n.format_number(int(corpus.get_struct(item).size()))}
                             for item in corpus.get_conf('STRUCTLIST').split(',')]
        return ans

    @exposed(return_type='json', legacy=True)
    def ajax_get_structs_details(self):
        """
        Provides a map (struct_name=>[list of attributes]). This is used
        by 'insert within' widget.
        """
        speech_segment = plugins.get('corparch').get_corpus_info(self.args.corpname).speech_segment
        ans = defaultdict(lambda: [])
        for item in self._corp().get_conf('STRUCTATTRLIST').split(','):
            if item != speech_segment:
                k, v = item.split('.')
                ans[k].append(v)
        return dict((k, v) for k, v in ans.items() if len(v) > 0)

    @exposed(return_type='json', legacy=True)
    def bibliography(self, id=''):
        bib_data = plugins.get('live_attributes').get_bibliography(self._corp(), item_id=id)
        return {'bib_data': bib_data}
