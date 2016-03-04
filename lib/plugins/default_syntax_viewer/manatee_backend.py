# Copyright (c) 2016 Czech National Corpus
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

"""
An expected configuration:

{
    "syn2015": {
          "sentenceStruct": "s",
          "trees": [
            {
              "id": "default",
              "name": "Default",
              "wordAttr": "word",
              "parentAttr": "parent",
              "labelTemplates": ["#{#009EE0}%s", "#{#F0680B}[%s]", "#{#010101}%s", "#{#E2007A}%s"],
              "detailAttrs": ["lc", "lemma", "lemma_lc", "tag", "pos", "case", "proc", "afun", "prep"],
              "nodeAttrs": ["word", "afun"],
              "rootNode": {
                "id": "root",
                "word": "",
                "node_labels": ["root", "-"],
                "parent": null
              }
            }
          ]
    },
    "another_corpus": {
      ...
    }
}
"""

import json
import manatee

from l10n import import_string
from plugins.abstract.syntax_viewer import SearchBackend


class TreeConf(object):
    """
    A single tree configuration access
    """
    DEFAULT_LABEL_TEMPLATES = ('#{#000000}%s', '#{#000000}%s', '#{#000000}%s', '#{#000000}%s')

    def __init__(self, data):
        """
        arguments:
        data -- a dictionary
        """
        self._data = data

    @property
    def name(self):
        return self._data['name']

    @property
    def word_attr(self):
        """
        An attribute specifying a 'word'
        """
        return self._data['wordAttr']

    @property
    def parent_attr(self):
        """
        An attribute specifying a reference to the parent element.
        This backend expects the references to be defined in a relative way
        (i.e. +2, -4,...). Value 0 (zero) refers to a special root non-word node.
        """
        return self._data['parentAttr']

    @property
    def node_attrs(self):
        """
        A list of attributes shown as a part of node's text label
        """
        return tuple(self._data['nodeAttrs'])

    @property
    def detail_attrs(self):
        """
        A list of attributes show in the 'details' box
        """
        return tuple(self._data['detailAttrs'])

    @property
    def root_node(self):
        """
        Root node definition.
        """
        return self._data.get('rootNode', None)

    @property
    def label_templates(self):
        """
        List of string interpolations used to specify colors for node labels
        """
        return self._data.get('labelTemplates', TreeConf.DEFAULT_LABEL_TEMPLATES)

    @property
    def all_attrs(self):
        """
        Returns all the attributes. This is used to fetch all the required values
        from Manatee.
        """
        ans = set([self.parent_attr]).union(self.node_attrs).union(self.detail_attrs)
        ans = ans - set([self.word_attr])
        return (self.word_attr, ) + tuple(ans)   # word attr must be first

    def __repr__(self):
        return unicode(self._data)


class ManateeBackendConf(object):
    """
    Handles configuration for all the trees defined for a corpus
    """
    def __init__(self, data):
        self._data = data

    def get_trees(self, canonical_corpus_id):
        return dict((tc['id'], TreeConf(tc))
                    for tc in self._data[canonical_corpus_id]['trees'])

    def get_sentence_struct(self, canonical_corpus_id):
        return self._data[canonical_corpus_id]['sentenceStruct']


class TreeNodeEncoder(json.JSONEncoder):
    """
    Provides a custom encoding of tree data into the format
    understood by the "JS Treex View" (https://github.com/ufal/js-treex-view)
    library.
    """
    def default(self, obj):
        if isinstance(obj, TreeNode):
            data = {'id': obj.id}
            data.update(obj.data)
            return {
                'parent': obj.parent.id if obj.parent else None,
                'hint': '',
                'labels': obj.node_labels,
                'firstson': obj.children[0].id if len(obj.children) > 0 else None,
                'id': obj.id,
                'rbrother': obj.rbrother.id if obj.rbrother else None,
                'lbrother': obj.lbrother.id if obj.lbrother else None,
                'depth': obj.depth,
                'data': data,
                'order': obj.idx
            }
        else:
            return obj


class TreeNode(object):
    """
    Defines a syntax tree node.
    """

    def __init__(self, idx, data, node_labels, word, parent):
        """
        arguments:
        idx -- node order in the list (zero based)
        data -- a dict containing detailed information about the node
        node_labels -- a list of strings to be used as labels of the node
        word -- a "word" value of the node (i.e. the actual word the node represents)
        parent -- parent node (i.e. an another TreeNode instance)
        """
        self.id = 'n%d' % idx
        self.idx = idx
        self.data = data
        self.parent = parent
        self.children = []
        self.rbrother = None
        self.lbrother = None
        self.depth = None
        self.node_labels = node_labels
        self.word = word

    def __repr__(self):
        return 'Node[%d] (parent: %s, children: %s)' % (self.idx, self.parent, [c.idx for c in self.children])


class TreeBuilder(object):
    """
    Builds a node tree (i.e. a list of mutually connected TreeNode instances)
    """

    @staticmethod
    def walk_through(root_node):
        root_node.depth = 0
        queue = [root_node]
        while len(queue) > 0:
            curr_node = queue.pop(0)
            for i in range(len(curr_node.children)):
                curr_node.children[i].depth = curr_node.depth + 1
                if i > 0:
                    curr_node.children[i].lbrother = curr_node.children[i - 1]
                if i < len(curr_node.children) - 1:
                    curr_node.children[i].rbrother = curr_node.children[i + 1]
            queue += curr_node.children

    @staticmethod
    def _dict_portion(data, attrs):
        return [(k, data.get(k, None)) for k in attrs]

    @staticmethod
    def create_tree(nodes):
        sentence = ' '.join(n.word for n in nodes)
        return [
            {
                'zones': {
                    'en': {  # TODO
                        'trees': {
                            'en-a': {  # TODO
                                'layer': 'a',  # TODO
                                'nodes': nodes
                            }
                        },
                        'sentence': sentence
                    }
                },
                'desc': []  # TODO
            }
        ]

    def process(self, data, tree_conf):
        """
        Runs the build process

        arguments:
        data -- a list of dicts containg data fetched from Manatee with parent
                references converted from relative ones to absolute ones plus
                some other updates (see ManateeBackend class)
        tree_conf -- a configuration for the tree

        returns:
        a 2-tuple (list_of_nodes, TreeNodeEncoder)
        """
        def export_labels(item):
            values = [v[1] for v in self._dict_portion(item, tree_conf.node_attrs)]
            return [k % v for k, v in zip(tree_conf.label_templates, values)]

        nodes = [TreeNode(idx=i,
                          data=dict(self._dict_portion(d, tree_conf.detail_attrs)),
                          node_labels=export_labels(d),
                          parent=d[tree_conf.parent_attr],
                          word=d[tree_conf.word_attr])
                 for i, d in enumerate(data)]
        for n in nodes:
            if n.parent is not None:
                nodes[n.parent].children.append(n)
                n.parent = nodes[n.parent]
        self.walk_through(nodes[0])
        full_nodes = self.create_tree(nodes)
        return full_nodes, TreeNodeEncoder


class ManateeBackend(SearchBackend):
    """
    This class converts tree data from Manatee to the format
    understood by UFAL's js-treex-view library (see https://github.com/ufal/js-treex-view)
    """

    def __init__(self, conf):
        """
        arguments:
        conf -- configuration dictionary as obtained by reading
                the configuration JSON and selecting the "corpora"
                object (i.e. not the whole JSON data).
        """
        self._conf = ManateeBackendConf(conf)

    def _load_raw_sent(self, corpus, canonical_corpus_id, token_id, tree_attrs):
        encoding = corpus.get_conf('ENCODING')
        sentence_struct = self._conf.get_sentence_struct(canonical_corpus_id)
        conc = manatee.Concordance(corpus, '[#%d]' % token_id, 1, -1)
        conc.sync()
        kl = manatee.KWICLines(corpus, conc.RS(True, 0, 1),
                               '-1:%s' % sentence_struct,
                               '1:%s' % sentence_struct,
                               ','.join(tree_attrs),
                               ','.join(tree_attrs), '', '')
        if kl.nextline():
            return [import_string(s, from_encoding=encoding)
                    for s in kl.get_left() + kl.get_kwic() + kl.get_right()]

    @staticmethod
    def _parse_raw_sent(in_data, tree_attrs):
        data = []
        for i in range(0, len(in_data), 4):
            item = dict(zip(tree_attrs, in_data[i + 2].split('/')))
            item['word'] = in_data[i]
            data.append(item)
        return data

    @staticmethod
    def _decode_tree_data(data, parent_attr):
        for i in range(1, len(data)):
            rel_parent = int(data[i][parent_attr])
            if rel_parent != 0:
                data[i][parent_attr] = i + int(data[i][parent_attr])
            else:
                data[i][parent_attr] = 0

    def get_data(self, corpus, canonical_corpus_id, token_id):
        """
        arguments:
        corpus -- a manatee.Corpus instance
        canonical_corpus_id -- a raw corpus identifier
                               (i.e. "public/my_corpus" should be inserted as just "corpus")
        token_id -- a token within a sentence of the interest

        returns:
        a 2-tuple (list_of_nodes, TreeNodeEncoder)
        """
        tree_configs = self._conf.get_trees(canonical_corpus_id)
        conf = tree_configs['default']  # TODO (currently we provide a single tree)
        raw_data = self._load_raw_sent(corpus, canonical_corpus_id, token_id, conf.all_attrs)
        parsed_data = self._parse_raw_sent(raw_data, conf.all_attrs)
        if conf.root_node:
            parsed_data = [conf.root_node] + parsed_data
        self._decode_tree_data(parsed_data, conf.parent_attr)
        tb = TreeBuilder()
        return tb.process(parsed_data, conf)

