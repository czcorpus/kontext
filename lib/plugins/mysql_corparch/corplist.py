# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

from plugin_types.corparch import CorplistProvider
import l10n
import re


def parse_query(tag_prefix, query):
    """
    Parses a search query:

    <query> ::= <label> | <desc_part>
    <label> ::= <tag_prefix> <desc_part>

    returns:
    2-tuple (list of description substrings, list of labels/keywords)
    """
    if query is not None:
        tokens = re.split(r'\s+', query.strip())
    else:
        tokens = []
    query_keywords = []
    substrs = []
    for t in tokens:
        if len(t) > 0:
            if t[0] == tag_prefix:
                query_keywords.append(t[1:])
            else:
                substrs.append(t)
    return substrs, query_keywords


class DefaultCorplistProvider(CorplistProvider):
    """
    Corpus listing and filtering service
    """

    def __init__(self, plugin_ctx, corparch, tag_prefix):
        """
        arguments:
        plugin_ctx -- a controller.PluginCtx instance
        corparch -- a plugin_types.corparch.AbstractSearchableCorporaArchive instance
        tag_prefix -- a string determining how a tag (= keyword or label) is recognized
        """
        self._plugin_ctx = plugin_ctx
        self._corparch = corparch
        self._tag_prefix = tag_prefix

    def search(self, plugin_ctx, query, offset=0, limit=None, filter_dict=None):
        if query is False:  # False means 'use default values'
            query = ''
        if filter_dict.get('minSize'):
            min_size = l10n.desimplify_num(filter_dict.get('minSize'), strict=False)
        else:
            min_size = 0
        if filter_dict.get('maxSize'):
            max_size = l10n.desimplify_num(filter_dict.get('maxSize'), strict=False)
        else:
            max_size = None
        if filter_dict.get('requestable'):
            requestable = bool(int(filter_dict.get('requestable')))
        else:
            requestable = False
        if filter_dict.get('favOnly'):
            favourites_only = bool(int(filter_dict.get('favOnly')))
        else:
            favourites_only = False

        if offset is None:
            offset = 0
        else:
            offset = int(offset)

        if limit is None:
            limit = int(self._corparch.max_page_size)
        else:
            limit = int(limit)

        user_items = self._corparch.user_items.get_user_items(plugin_ctx)
        favourite_corpora = {
            item.main_corpus_id: item.ident for item in user_items if item.is_single_corpus}

        def get_found_in(corp, phrases):
            ans = []
            for phrase in phrases:
                phrase = phrase.lower()
                name = corp.name.lower() if corp.name is not None else ''
                desc = corp.description.lower() if corp.description is not None else ''
                if phrase not in name and phrase in desc:
                    ans.append('defaultCorparch__found_in_desc')
                    break
            return ans

        query_substrs, query_keywords = parse_query(self._tag_prefix, query)
        normalized_query_substrs = [s.lower() for s in query_substrs]
        used_keywords = set()
        rows = list(self._corparch.list_corpora(
            plugin_ctx, substrs=normalized_query_substrs,
            min_size=min_size, max_size=max_size, requestable=requestable,
            offset=offset, limit=limit + 1, keywords=query_keywords,
            favourites=tuple(favourite_corpora.keys()) if favourites_only else ()).values())
        ans = []
        for i, corp in enumerate(rows):
            used_keywords.update(corp.keywords)
            corp.keywords = self._corparch.get_l10n_keywords(corp.keywords, plugin_ctx.user_lang)
            corp.fav_id = favourite_corpora.get(corp.id, None)
            corp.found_in = get_found_in(corp, normalized_query_substrs)
            ans.append(corp.to_dict())
            if i == limit - 1:
                break
        return dict(rows=ans,
                    nextOffset=offset + limit if len(rows) > limit else None,
                    keywords=l10n.sort(used_keywords, loc=plugin_ctx.user_lang),
                    query=query,
                    current_keywords=query_keywords,
                    filters=dict(filter_dict))

