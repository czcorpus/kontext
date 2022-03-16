# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import plugins.default_syntax_viewer.manatee_backend as mbk
from plugin_types.syntax_viewer import BackendDataParseException
from plugins.syntax_viewer2.tree import UcnkTreeTemplate


class ManateeBackend2(mbk.ManateeBackend):
    def __init__(self, conf):
        super().__init__(conf)

    def import_parent_values(self, v):
        if type(v) is int:
            return [v]
        return [int(x) for x in v.split('|') if x != '']

    def _fetch_fallback_info(self, corpus, corpus_id, token_id, kwic_len, parent_attr, ref_attrs):
        attrs = ['word', parent_attr] + list(ref_attrs.keys())
        raw_data = self._load_raw_sent(corpus, corpus_id, token_id, kwic_len, attrs)
        return self._parse_raw_sent(raw_data['data'], attrs, self._conf.get_empty_value_placeholders(corpus_id))

    async def get_data(self, corpus, corpus_id, token_id, kwic_len):
        tree_configs = self._conf.get_trees(corpus_id)
        tree_id = self._conf.get_tree_display_list(corpus_id)[0]
        conf = tree_configs[tree_id]
        raw_data = self._load_raw_sent(corpus, corpus_id, token_id, kwic_len, conf.all_attrs)
        parsed_data = self._parse_raw_sent(raw_data['data'], conf.all_attrs,
                                           self._conf.get_empty_value_placeholders(corpus_id),
                                           multival_separ=self._conf.get_multival_lemmata_separator(corpus_id))
        fallback_parse = None
        for i, parsed_item in enumerate(parsed_data):
            if self.is_error_node(parsed_item):
                replac = dict(list(parsed_item.result.items()))
                if fallback_parse is None:
                    fallback_parse = self._fetch_fallback_info(corpus, corpus_id, token_id, kwic_len, conf.parent_attr,
                                                               conf.attr_refs)
                if self.is_error_node(fallback_parse[i]):
                    # even fallback is broken - nothing we can do
                    raise BackendDataParseException('Failed to parse sentence')
                for k, v in list(parsed_item.result.items()):
                    if k == conf.parent_attr or k in conf.attr_refs:
                        replac[k] = fallback_parse[i][k]
                    elif v is None:
                        replac[k] = 'N/A'
                parsed_data[i] = replac

        if conf.root_node:
            parsed_data = [conf.root_node] + parsed_data
        self._decode_tree_data(parsed_data, conf.parent_attr, conf.attr_refs, conf.parent_type)
        tb = mbk.TreeBuilder()
        tree_data = tb.process(conf, parsed_data)
        template = UcnkTreeTemplate(tree_id, tree_data, raw_data['kwic_pos'], tree_configs)
        return await template.export(), mbk.TreeNodeEncoder
