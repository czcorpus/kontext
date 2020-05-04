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

"""
A minor modification of default_syntax_viewer as used in
the Czech National Corpus. The client-side part is linked
from the default plug-in implementation (see conf bellow).

Required config.xml/plugins entries (RelaxNG compact format):

element syntax_viewer {
    element module { "ucnk_syntax_viewer" }
    element js_module { "defaultSyntaxViewer" }  # here we use default plug-in implementation
    element config_path {
        attribute extension-by { "default" }
        text # a path to JSON config file (see below)
    }
}
"""

import plugins
import plugins.default_syntax_viewer as dsv
import plugins.default_syntax_viewer.manatee_backend as mbk
from plugins.abstract.syntax_viewer import BackendDataParseException


class UcnkTreeTemplate(mbk.TreexTemplate):

    def __init__(self, tree_id, tree_data, kwic_pos, conf):
        super(UcnkTreeTemplate, self).__init__([tree_id], [tree_data], conf)
        self._kwic_pos = range(kwic_pos[0], kwic_pos[0] + kwic_pos[1])

    def export(self):
        ans = super(UcnkTreeTemplate, self).export()
        ans[0]['kwicPosition'] = self._kwic_pos
        return ans


class UcnkManateeBackend(mbk.ManateeBackend):
    def __init__(self, conf):
        super(UcnkManateeBackend, self).__init__(conf)

    def import_parent_values(self, v):
        return [int(x) for x in v.split('|') if x != '']

    def _fetch_fallback_info(self, corpus, corpus_id, token_id, kwic_len, parent_attr, ref_attrs):
        attrs = ['word', parent_attr] + ref_attrs.keys()
        raw_data = self._load_raw_sent(corpus, corpus_id, token_id, kwic_len, attrs)
        return self._parse_raw_sent(raw_data['data'], attrs, self._conf.get_empty_value_placeholders(corpus_id))

    def get_data(self, corpus, corpus_id, token_id, kwic_len):
        tree_configs = self._conf.get_trees(corpus_id)
        tree_id = self._conf.get_tree_display_list(corpus_id)[0]
        conf = tree_configs[tree_id]
        raw_data = self._load_raw_sent(corpus, corpus_id, token_id, kwic_len, conf.all_attrs)
        parsed_data = self._parse_raw_sent(raw_data['data'], conf.all_attrs,
                                           self._conf.get_empty_value_placeholders(corpus_id))

        fallback_parse = None
        for i in range(len(parsed_data)):
            if self.is_error_node(parsed_data[i]):
                replac = dict(parsed_data[i].result.items())
                if fallback_parse is None:
                    fallback_parse = self._fetch_fallback_info(corpus, corpus_id, token_id, kwic_len, conf.parent_attr,
                                                               conf.attr_refs)
                if self.is_error_node(fallback_parse[i]):
                    # even fallback is broken - nothing we can do
                    raise BackendDataParseException('Failed to parse sentence')
                for k, v in parsed_data[i].result.items():
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
        return template.export(), mbk.TreeNodeEncoder


@plugins.inject(plugins.runtime.AUTH)
def create_instance(conf, auth):
    corpora_conf = dsv.load_plugin_conf(conf)
    return dsv.SyntaxDataProvider(corpora_conf, UcnkManateeBackend(corpora_conf), auth)
