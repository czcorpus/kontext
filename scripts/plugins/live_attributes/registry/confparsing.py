# Copyright 2014 Institute of the Czech National Corpus
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from grako.contexts import Closure


class ConfigSemantics(object):
    """
    This is used by the generated parser to modify AST to fit our needs
    """

    def __init__(self):
        self.structures = []
        self.curr_struct = None

    def lbracket(self, ast):
        return None

    def rbracket(self, ast):
        return None

    def quot(self, ast):
        return None

    def _default(self, ast):
        return ast


class Structure(object):
    """
    Represents a structure definition
    """

    def __init__(self, name=None):
        self.name = name
        self.attributes = []

    def add_item(self, attr):
        self.attributes.append(attr)

    def __repr__(self):
        return 'Structure[%s] (%s)' % (self.name, ', '.join(['%r' % a for a in self.attributes]))


class Attribute(object):
    """
    Represents an attribute definition
    """
    def __init__(self, name=None):
        self.name = name
        self.values = {}

    def __getitem__(self, k):
        return self.values[k]

    def __setitem__(self, k, v):
        self.values[k] = v

    def __repr__(self):
        if len(self.values) > 0:
            return 'Attribute[%s] (%s)' % (self.name, ', '.join(['%s: %s' % (k, v) for k, v in self.values.items()]))
        else:
            return 'Attribute[%s]' % self.name


class Registry(object):
    """
    Represents a registry file with a bunch of key -> value pairs and lists of structures and attributes
    """

    def __init__(self):
        self.values = {}
        self.items = []

    def __getitem__(self, k):
        return self.values[k]

    def __setitem__(self, k, v):
        self.values[k] = v

    def __repr__(self):
        return 'Conf (\n%s,\n%s\n)' % ('\n'.join(['\t%s : %s' % (k, v) for k, v in self.values.items()]),
                                       '\n'.join(['\t%r' % o for o in self.items]))

    def add_item(self, item):
        self.items.append(item)

    def get_structattrs(self):
        ans = []
        for t in self.items:
            if isinstance(t, Structure):
                for t2 in t.attributes:
                    ans.append((t.name, t2.name))
        return ans


class TreeWalker(object):
    """
    Walks through AST and creates a Registry instance with all respective items
    """

    def __init__(self, tree):
        self.tree = tree
        self.curr_type = None

    def is_other_key(self, v):
        return (type(v) is unicode or type(v) is str) and v.isupper()

    def process(self, subtree, parent_obj):
        curr_obj = None

        for node in subtree:
            if node == 'STRUCTURE':
                self.curr_type = node
            elif node == 'ATTRIBUTE':
                self.curr_type = node
            elif isinstance(node, Closure):
                self.process(node, curr_obj)
            elif self.is_other_key(node):
                self.curr_type = node
            else:
                if self.curr_type == 'STRUCTURE':
                    curr_obj = Structure(node)
                    parent_obj.add_item(curr_obj)
                elif self.curr_type == 'ATTRIBUTE':
                    curr_obj = Attribute(node)
                    parent_obj.add_item(curr_obj)
                else:
                    parent_obj[self.curr_type] = node
                self.curr_type = None

    def run(self):
        root = Registry()
        self.process(self.tree, root)
        return root
