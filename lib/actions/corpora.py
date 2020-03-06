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
from controller.kontext import Kontext
import plugins
from plugins.abstract.corpora import AbstractSearchableCorporaArchive
import l10n
from translation import ugettext as translate


class Corpora(Kontext):

    def get_mapping_url_prefix(self):
        return '/corpora/'

    @exposed(skip_corpus_init=True)
    def corplist(self, request):
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS
        with plugins.runtime.CORPARCH as corparch_plugin:
            if isinstance(corparch_plugin, AbstractSearchableCorporaArchive):
                params = corparch_plugin.initial_search_params(self._plugin_api, request.args.get('query'),
                                                               request.args)
                data = corparch_plugin.search(plugin_api=self._plugin_api,
                                              query=False,
                                              offset=0,
                                              limit=request.args.get('limit', None),
                                              filter_dict=request.args)
            else:
                params = {}
                data = corparch_plugin.get_all(self._plugin_api)
            data['search_params'] = params
            return dict(corplist_data=data)

    @exposed(return_type='json', skip_corpus_init=True)
    def ajax_list_corpora(self, request):
        with plugins.runtime.CORPARCH as cp:
            return cp.search(plugin_api=self._plugin_api, query=request.args['query'],
                             offset=request.args.get('offset', None), limit=request.args.get('limit', None),
                             filter_dict=request.args)

    @exposed(return_type='json', skip_corpus_init=True)
    def ajax_get_corp_details(self, request):
        """
        """
        corp_conf_info = self.get_corpus_info(request.args['corpname'])
        corpus = self.cm.get_Corpus(request.args['corpname'])
        citation_info = corp_conf_info.get('citation_info', None)
        citation_info = citation_info.to_dict() if citation_info else {}

        if corpus.get_conf('NAME'):
            corpus_name = corpus.get_conf('NAME')
        else:
            corpus_name = corpus.corpname

        with plugins.runtime.CORPARCH as corparch_plugin:
            keywords = [
                {'name': name, 'color': corparch_plugin.get_label_color(ident)}
                for (ident, name) in corp_conf_info.metadata.keywords
            ]

        ans = {
            'corpname': corpus_name,
            'description': corpus.get_info(),
            'size': int(corpus.size()),
            'attrlist': [],
            'structlist': [],
            'web_url': corp_conf_info['web'] if corp_conf_info is not None else '',
            'citation_info': citation_info,
            'keywords': keywords
        }
        try:
            ans['attrlist'] = [{'name': item, 'size': int(corpus.get_attr(item).id_range())}
                               for item in corpus.get_conf('ATTRLIST').split(',')]
        except RuntimeError as e:
            logging.getLogger(__name__).warning('%s' % e)
            ans['attrlist'] = {'error': translate('Failed to load')}
        ans['structlist'] = [{'name': item, 'size': int(corpus.get_struct(item).size())}
                             for item in corpus.get_conf('STRUCTLIST').split(',')]
        return ans

    @exposed(return_type='json')
    def ajax_get_structattrs_details(self, _):
        """
        Provides a map (struct_name=>[list of attributes]). This is used
        by 'insert within' widget.
        """
        speech_segment = self.get_corpus_info(self.args.corpname).speech_segment
        ans = defaultdict(lambda: [])
        for item in self.corp.get_conf('STRUCTATTRLIST').split(','):
            if item != speech_segment:
                k, v = item.split('.')
                ans[k].append(v)
        return dict(structattrs=dict((k, v) for k, v in list(ans.items()) if len(v) > 0))

    @exposed(return_type='json')
    def bibliography(self, request):
        with plugins.runtime.LIVE_ATTRIBUTES as liveatt:
            return dict(bib_data=liveatt.get_bibliography(self._plugin_api, self.corp, item_id=request.args.get('id')))
