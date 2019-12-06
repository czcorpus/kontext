# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
# Modified by Maarten Janssen, 2019
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
      "emptyValuePlaceholders": ["-"],    # an empty string is implicit
      "trees": [
        {
          "id": "default",
          "name": "Default",
          "wordAttr": "word",
          "parentAttr": "parent",
          "parentType": "rel",
          "labelTemplates": ["#{#009EE0}%s", "#{#F0680B}[%s]", "#{#010101}%s", "#{#E2007A}%s"],
          "layerType": "t",
          "detailAttrs": ["lc", "lemma", "lemma_lc", "tag", "pos", "case", "proc", "afun", "prep", "eparent"],
          "attrRefs": {
            "eparent": ["word"]
          },
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
from plugins.abstract.syntax_viewer import SearchBackend, MaximumContextExceeded, BackendDataParseException


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
    def parent_type(self):
        """
        An attribute specifying the type of parent: relative (default), id, or ord
        """
        return self._data.get('parentType')

    @property
    def parent_attr(self):
        """
        An attribute specifying a reference to the parent element.
        This backend expects the references to be defined in a relative way
        (i.e. +2, -4,...). Value 0 (zero) refers to a special root non-word node.
        """
        return self._data['parentAttr']

    @property
    def node_id(self):
        """
        An attribute specifying a reference to the parent element.
        This backend expects the references to be defined in a relative way
        (i.e. +2, -4,...). Value 0 (zero) refers to a special root non-word node.
        """
        return self._data['id']

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
    def layer_type(self):
        return self._data.get('layerType', 'a')

    @property
    def attr_refs(self):
        """
        Returns (dict of list):
            return attributes which should be interpreted as links
            to other tokens. Values of dict are used as keys in
            target nodes to retrieve their values. E.g. we can
            specify that "eparent" attribute should retrieve
            "word" from the referred node as follows: {"eparent":["word"]}
        """
        return self._data.get('attrRefs', {})

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
        return str(self._data)


class ManateeBackendConf(object):
    """
    Handles configuration for all the trees defined for a corpus
    """

    def __init__(self, data):
        self._data = data

    def get_detail_attrs(self, corpus_id, corpus=None):
        for tc in self._data[corpus_id]['trees']:
            if corpus is not None and "*" == (tc["detailAttrs"] or [""])[0]:
                filtered = tc.get("filtered", [])
                tc['detailAttrs'] = [x for x in corpus.get_conf(
                    'ATTRLIST').split(',') if x not in filtered]

    def get_trees(self, corpus_id, corpus=None):
        d = {}
        if corpus_id in self._data:
            for tc in self._data[corpus_id]['trees']:
                if corpus is not None and "*" == (tc["detailAttrs"] or [""])[0]:
                    filtered = tc.get("filtered", [])
                    tc['detailAttrs'] = [x for x in corpus.get_conf(
                        'ATTRLIST').split(',') if x not in filtered]
                d[tc['id']] = TreeConf(tc)
        return d

    def get_tree_display_list(self, corpus_id):
        return [tc['id'] for tc in self._data[corpus_id]['trees']]

    def get_sentence_struct(self, corpus_id):
        return self._data[corpus_id]['sentenceStruct']

    def get_empty_value_placeholders(self, corpus_id):
        """
        Args:
            corpus_id (str): corpus ID

        Returns:
            (list of str)
        """
        return self._data[corpus_id].get('emptyValuePlaceholders', [])


class TreeNodeEncoder(json.JSONEncoder):
    """
    Provides a custom encoding of tree data into the format
    understood by the "JS Treex View" (https://github.com/ufal/js-treex-view)
    library.
    """

    def default(self, obj):
        if isinstance(obj, TreeNode):
            data = {}
            data.update([('id',  obj.id)])
            data.update(obj.data)
            ans = dict(
                parent=obj.parent.id if obj.parent else None,
                hint=None,
                labels=obj.node_labels,
                firstson=obj.children[0].id if len(obj.children) > 0 else None,
                id=obj.id,
                rbrother=obj.rbrother.id if obj.rbrother else None,
                lbrother=obj.lbrother.id if obj.lbrother else None,
                depth=obj.depth,
                data=data,
                order=obj.idx)
            if obj.hidden:
                ans['hidden'] = True
            return ans
        else:
            return obj


class TreeNode(object):
    """
    Defines a syntax tree node.

    Attributes:
        id (str): node identifier used by js-treex-view
        idx (int): node order in the list (zero based)
        data (dict of str:any): a dict containing detailed information about the node
        node_labels (list of str): a list of labels for the nodes
        word (str): a "word" value of the node (i.e. the actual word the node represents)
        parent (int): parent node index in sentence
        children (list of TreeNode): child nodes
        rbrother (TreeNode): nodes right neighbour
        lbrother (TreeNode): nodes left neighbour
        depth (int): depth of the node
    """

    def __init__(self, idx, data, node_labels, word, parent, hidden):
        """
        Args:
            idx (int): node order in the list (zero based)
            data (Dict[str, Any]): a dict containing detailed information about the node
            node_labels (list of str): a list of labels for the nodes
            word (str): a "word" value of the node (i.e. the actual word the node represents)
            parent (int): parent node
            hidden: if True then client should not render the node (this applies mainly for root)
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
        self.hidden = hidden

    def __repr__(self):
        return 'Node[%d] (parent: %s, children: %s)' % (self.idx, self.parent, [c.idx for c in self.children])


class TreexTemplate(object):

    def __init__(self, id_list, tree_list, conf):
        self._id_list = id_list
        self._tree_list = tree_list
        self._conf = conf

    def _generate_desc(self):
        ans = []
        for item in self._tree_list[0]:  # TODO
            ans.append([item.word, item.id])
        return ans

    def export(self):
        sentence = ' '.join(n.word for n in self._tree_list[0])
        graph_list = []
        for i in range(len(self._id_list)):
            graph_list.append({
                'zones': {
                    'cs': {  # TODO
                        'trees': {
                            'default': {
                                'layer': self._conf[self._id_list[i]].layer_type,
                                'nodes': self._tree_list[0]
                            }
                        },
                        'sentence': sentence
                    }
                },
                'desc': self._generate_desc()
            })
        return graph_list


class TreeBuilder(object):
    """
    Builds a node tree (i.e. a list of mutually connected TreeNode instances)
    """

    @staticmethod
    def attach_tree_params(root_node):
        """
        Traverses the tree (in a BFS manner) and attaches information
        about left/right neighbours and depth.

        Args:
            root_node (TreeNode): a node to start in
        """
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

    def process(self, tree_conf, data):
        """
        Runs the build process

        Args:
            tree_conf (TreeConf): a configuration for the tree
            data (list of dict of str:any): a list of dicts containing data fetched
                from Manatee with parent references converted from relative ones to absolute ones plus
                some other updates (see ManateeBackend class)

        Returns (tuple(list_of_nodes, TreeNodeEncoder))
        """

        def export_labels(item):
            values = [v[1] for v in self._dict_portion(item, tree_conf.node_attrs)]
            return [k % (v if v is not None else '') for k, v in zip(tree_conf.label_templates, values)]

        nodes = [TreeNode(idx=i,
                          data=dict(self._dict_portion(d, tree_conf.detail_attrs)),
                          node_labels=export_labels(d),
                          parent=d[tree_conf.parent_attr],
                          word=d[tree_conf.word_attr],
                          hidden=d.get('hidden', False))
                 for i, d in enumerate(data)]
        for n in nodes:
            if n.parent is not None:
                nodes[n.parent].children.append(n)
                n.parent = nodes[n.parent]
        self.attach_tree_params(nodes[0])
        return nodes


class ManateeBackend(SearchBackend):
    """
    This class converts tree data from Manatee to the format
    understood by UFAL's js-treex-view library (see https://github.com/ufal/js-treex-view)
    """

    def __init__(self, conf):
        """
        Args:
        conf (dict): configuration dictionary as obtained by reading
                the configuration JSON and selecting the "corpora"
                object (i.e. not the whole JSON data).
        """
        self._conf = ManateeBackendConf(conf)

    def _load_raw_sent(self, corpus, corpus_id, token_id, kwic_len, tree_attrs):
        """
        Retrieve a sentence via Manatee
        Args:
            corpus (manatee.Corpus): a corpus instance
            corpus_id (str): corpus ID
            token_id (int): token number/id
            kwic_len (int): number of tokens in KWIC
            tree_attrs (list of str): a list of positional attributes required by tree nodes/edges

        Returns (dict):
            data: a list of strings (Manatee raw format)
            kwic_pos: a tuple (first_kwic_idx, kwic_length)
        """
        encoding = corpus.get_conf('ENCODING')
        sentence_struct = self._conf.get_sentence_struct(corpus_id)
        conc = manatee.Concordance(corpus, ' '.join(
            '[#%d]' % k for k in range(token_id, token_id + kwic_len)), 1, -1)
        conc.sync()
        kl = manatee.KWICLines(corpus, conc.RS(True, 0, 1),
                               '-1:%s' % sentence_struct,
                               '1:%s' % sentence_struct,
                               ','.join(tree_attrs),
                               ','.join(tree_attrs), '', '')
        if kl.nextline():
            left_tk = kl.get_left()
            kwic_tk = kl.get_kwic()
            return dict(data=[import_string(s, from_encoding=encoding)
                              for s in left_tk + kwic_tk + kl.get_right()],
                        kwic_pos=(len(left_tk) / 4, len(kwic_tk) / 4))

    @staticmethod
    def _parse_raw_sent(in_data, tree_attrs, empty_val_placeholders):
        """
        Args:
            in_data (list of str): a string-encoded sentence and required attribute metadata (see _load_raw_sent())
            tree_attrs (list of str): a list of attributes used by nodes/edges of the tree
            empty_val_placeholders (list of str): a list of values which may represent an empty
                value in a raw sentence data

        Returns (list of dict):
            a list of dict items representing tree nodes
        """
        import logging
        def import_raw_val(v):
            return None if v in empty_val_placeholders or v == '' else v

        data = []
        logging.getLogger(__name__).debug('in_data: {}'.format(in_data))
        for i in range(0, len(in_data), 4):
            parsed = [import_raw_val(x) for x in in_data[i + 2].split('/')]
            if len(parsed) > len(tree_attrs):
                item = dict(list(zip(tree_attrs, len(tree_attrs) * [None])))
                item['word'] = in_data[i]
                # In case of a parsing error we wrap a partial result into
                # an error and try later to fetch essential data only (= parent
                # and other references to other values).
                data.append(BackendDataParseException(result=item))
            else:
                item = dict(list(zip(tree_attrs, parsed)))
                item['word'] = in_data[i]
                data.append(item)
        logging.getLogger(__name__).debug('>>>> {}'.format(len(data)))
        return data

    def _get_ord_reference(self, curr_idx, data, tree_conf=None):
        """
        * Customizable reference resolution
        OPTION 1: (rel)
        Transform relative parents references as defined in original nodes
        into an sentence-absolute representation (e.g. 5th element referring
        to '-2' translates into reference to '3').
        OPTION 2: (id)
        Transform ID-based parent references into sentence-absolute representation
        OPTION 3: (ord)
        Keep sentence-absolute representation
        Args:
            curr_idx (int): current position within a sentence
            item (dict): processed node
            ref_attr (str): a node attribute used to refer to node's parent

        Returns (list of int):
            sentence-absolute position of the parent or None if nothing found
        """
        if tree_conf is None:
            tree_conf = {}
        # Old arguments from _get_abs_reference
        item = data[curr_idx]
        ref_attr = tree_conf.parent_attr

        if tree_conf.parent_type == 'ord':
            # This already is an nr in the sentence - just return
            return [item[ref_attr]]
        elif tree_conf.parent_type == 'id':
            # Return the sentence element that has this as its ID
            # Check that items have a ID
            if 'id' not in item:
                raise ValueError('ID has not been specified for nodes')
            # Go through all the words to see which matched by ID
            for i in range(len(data)):
                parit = data[i]
                if parit.get('id', '') == item[ref_attr]:
                    return [i]
            return []
        else:
            # Provide an absolute nr from a relative one
            if item[ref_attr]:
                import logging
                logging.getLogger(__name__).debug('importing: {}'.format(item[ref_attr]))
                rel_parents = self.import_parent_values(item[ref_attr])
                return [curr_idx + rp - 1 for rp in rel_parents if rp != 0]
            else:
                return []

    def _process_attr_refs(self, data, curr_idx, attr_refs, tree_conf=None):
        """
        Process indirect node values (values which are actually
        in referred nodes). Please do not confuse this with
        references used to construct the tree. These are just
        "indirect" text values.

        Method updates the 'data' argument and returns None

        Args:
            data (list of dict): list of nodes representing a sentence
            curr_idx (int): current position in the sentence
            attr_refs (dict of str:list): configured indirect values

        """
        if tree_conf is None:
            tree_conf = {}

        if data[0].get('hidden', False):
            corr = -1
        else:
            corr = 0
        import logging
        logging.getLogger(__name__).debug('LEN: {}'.format(len(data)))
        for ident, keys in list(attr_refs.items()):
            abs_refs = self._get_ord_reference(curr_idx, data, tree_conf)

            logging.getLogger(__name__).debug('foo: {}'.format(abs_refs))
            data[curr_idx][ident] = []
            for abs_ref in abs_refs:
                ref_item = data[abs_ref]
                ref_label = ' '.join([ref_item[k] for k in keys])
                data[curr_idx][ident].append((abs_ref + corr, ref_label))

    def _decode_tree_data(self, data, parent_attr, attr_refs, tree_conf=None):
        """
        Args:
            data (list of dict of str:any): parsed sentence
            parent_attr (str): an attribute used to refer to node's parent
            attr_refs (dict of str:list of str): indirect values
        """
        if tree_conf is None:
            tree_conf = {}
        for i in range(1, len(data)):
            abs_parents = self._get_ord_reference(i, data, tree_conf)
            abs_parent = abs_parents[0] if len(abs_parents) > 0 else None
            # Please note that referring to the 0-th node
            # means 'out of range' error too because our 0-th node
            # here is just an auxiliary root element which is referred
            # by an empty/zero value in vertical file.
            if abs_parent is not None and (abs_parent <= 0 or abs_parent >= len(data)):
                raise MaximumContextExceeded(
                    'Absolute parent position %d out of range 0..%d' % (abs_parent, len(data) - 1))
            data[i][parent_attr] = abs_parent if abs_parent is not None else 0
            self._process_attr_refs(data, i, attr_refs, tree_conf)

    def get_detail_attr_orders(self, corpus_id, corpus):
        ans = {}
        for tree_id, conf in list(self._conf.get_trees(corpus_id, corpus).items()):
            ans[tree_id] = conf.detail_attrs
        return ans

    def get_data(self, corpus, corpus_id, token_id, kwic_len):
        tree_configs = self._conf.get_trees(corpus_id, corpus)
        tree_list = []
        tree_id_list = self._conf.get_tree_display_list(corpus_id)
        for tree in tree_id_list:
            conf = tree_configs[tree]
            raw_data = self._load_raw_sent(corpus=corpus, corpus_id=corpus_id, token_id=token_id, kwic_len=kwic_len,
                                           tree_attrs=conf.all_attrs)
            parsed_data = self._parse_raw_sent(raw_data['data'], conf.all_attrs,
                                               self._conf.get_empty_value_placeholders(corpus_id))
            if conf.root_node:
                parsed_data = [conf.root_node] + parsed_data
            self._decode_tree_data(parsed_data, conf.parent_attr, conf.attr_refs, conf)
            tb = TreeBuilder()
            tree_list.append(tb.process(conf, parsed_data))
        template = TreexTemplate(tree_id_list, tree_list, tree_configs)
        return template.export(), TreeNodeEncoder
