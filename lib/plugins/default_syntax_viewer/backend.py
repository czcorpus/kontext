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

import os
import json
import sqlite3
import manatee
import logging

from l10n import import_string
from plugins.abstract.syntax_viewer import SearchBackend


class SyntaxDataBackendError(Exception):
    pass


class TreeNodeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, TreeNode):
            data = {'id': obj.id}
            data.update(obj.data)
            return {
                'parent': obj.parent.id if obj.parent else None,
                'hint': '',
                'labels': [
                    obj.data.get('word', '??'),
                    '#{#00008b}Sb',
                    '#{#004048}PRP'
                ],
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

    def __init__(self, idx, data, parent):
        self.id = 'n%d' % idx
        self.idx = idx
        self.data = data
        self.parent = parent
        self.children = []
        self.rbrother = None
        self.lbrother = None
        self.depth = None

    def __repr__(self):
        return 'Node[%d] (parent: %s, children: %s)' % (self.idx, self.parent, [c.idx for c in self.children])


class TreeBuilder(object):

    def __init__(self):
        pass

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
    def create_tree(nodes):
        sentence = ' '.join(n.data['word'] for n in nodes)
        return [
            {
                'zones': {
                    'en': {
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

    def process(self, data):
        nodes = [TreeNode(i, d, d['parent']) for i, d in enumerate(data)]
        for n in nodes:
            if n.parent is not None:
                nodes[n.parent].children.append(n)
                n.parent = nodes[n.parent]
        self.walk_through(nodes[0])
        full_nodes = self.create_tree(nodes)
        return full_nodes, TreeNodeEncoder


class ManateeBackend(SearchBackend):

    def __init__(self, conf):
        self._conf = conf

    @staticmethod
    def _load_raw_sent(corpus, token_id, tree_attrs):
        encoding = corpus.get_conf('ENCODING')
        conc = manatee.Concordance(corpus, '[#%d]' % token_id, 1, -1)
        conc.sync()
        kl = manatee.KWICLines(corpus, conc.RS(True, 0, 1), '-1:s', '1:s',
                               ','.join(tree_attrs), ','.join(tree_attrs), '', '')
        if kl.nextline():
            return [import_string(s, from_encoding=encoding) for s in kl.get_left() + kl.get_kwic() + kl.get_right()]

    @staticmethod
    def _parse_raw_sent(in_data, tree_attrs):
        data = []
        for i in range(0, len(in_data), 4):
            item = dict(zip(tree_attrs, in_data[i + 2].split('/')))
            item['word'] = in_data[i]
            data.append(item)
        return data

    def get_data(self, corpus, canonical_corpus_id, token_id):
        tree_attrs = ('word', 'tag', 'pos', 'lemma')  # TODO
        raw_data = self._load_raw_sent(corpus, token_id, tree_attrs)
        parsed_data = self._parse_raw_sent(raw_data, tree_attrs)
        # TESTING ####
        import random
        for i in range(len(parsed_data)):
            item = parsed_data[i]
            item['parent'] = random.randint(0, max(0, i - 1))
        parsed_data[0]['parent'] = None
        # TESTING ####
        tb = TreeBuilder()
        return tb.process(parsed_data)


class Sqlite3SearchBackend(SearchBackend):
    """
    Required database table:
    CREATE TABLE data ( id text primary key, json text );
    """

    def __init__(self, conf):
        self._conf = conf

    def _open_db(self, name):
        return sqlite3.connect(self._conf[name]['path'])

    def get_corpus_sent_keys(self, corpname):
        try:
            return self._conf[corpname]['sentenceUniqueAttributes']
        except KeyError:
            raise SyntaxDataBackendError('Corpus %s not found in the configuration' % (corpname,))

    def get_sent_keys_values(self, corp, canonical_corpname, token_id):
        keys = self.get_corpus_sent_keys(canonical_corpname)
        ans = []
        for k in keys:
            attr = corp.get_attr(k)
            ans.append(attr.pos2str(token_id))
        return tuple(ans)

    def get_data(self, corpus, canonical_corpus_id, token_id):
        db = self._open_db(canonical_corpus_id)
        cursor = db.cursor()
        sentence_id = ':'.join(self.get_sent_keys_values(corpus, canonical_corpus_id))
        cursor.execute('SELECT zjson FROM data WHERE id = ?', (sentence_id,))
        ans = cursor.fetchone()
        path = os.path.join(os.path.dirname(__file__), 'test2.json')
        with open(path, 'rb') as f:
            return json.load(f)

