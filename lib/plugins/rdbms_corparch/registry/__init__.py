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

import re


def should_be_quoted(attr, s):
    """
    Test whether a registry value should be wrapped
    in quotes. We play it safe here and quote all the stuff.
    """
    return True


def split_clean(sc, val):
    return [v for v in re.split(sc, val) if v != ''] if val is not None else []


class RecordNotFound(Exception):
    pass


class SimpleAttr(object):
    """
    A simple configuration pair of NAME => VALUE
    where VALUE is a primitive type (string, number).
    """

    def __init__(self, name, value=None):
        self.name = name
        self.value = value

    def __unicode__(self):
        return u'({0} => {1})'.format(self.name, self.value)

    def __repr__(self):
        return self.__unicode__().encode('utf-8')


class Attribute(object):
    """
    An attribute used to define either
    positional attributes or structural attributes.
    """

    def __init__(self, name=None, attrs=None):
        self.name = name
        self.attrs = attrs if attrs else []

    def __unicode__(self):
        return u'PosAttr({0} -> {1})'.format(self.name, u', '.join(x.__unicode__() for x in self.attrs))

    def __repr__(self):
        return self.__unicode__().encode('utf-8')

    @property
    def last_item(self):
        return self.attrs[-1] if len(self.attrs) > 0 else None

    def new_item(self, attr):
        self.attrs.append(attr)

    @property
    def non_empty_items(self):
        return [attr for attr in self.attrs if attr.value is not None]


class Struct(object):
    """
    A structure prescription which
    contains either simple config values
    or structural attributes.
    """

    def __init__(self, name=None, attrs=None):
        self.name = name
        self.attrs = attrs if attrs else []

    def __unicode__(self):
        return u'Struct({0} -> {1})'.format(self.name, self.attrs)

    def __repr__(self):
        return self.__unicode__().encode('utf-8')

    @property
    def last_item(self):
        return self.attrs[-1] if len(self.attrs) > 0 else None

    def new_item(self, attr):
        self.attrs.append(attr)

    @property
    def attributes(self):
        return (x for x in self.attrs if isinstance(x, Attribute))

    @property
    def simple_items(self):
        return (x for x in self.attrs if isinstance(x, SimpleAttr))


class RegistryConf(object):
    """
    Main registry configuration object.
    """

    def __init__(self, corpus_id, variant, backend):
        self._id = None
        self._corpus_id = corpus_id
        self._variant = variant
        self._items = []
        self._backend = backend

    def __iter__(self):
        return self._items.__iter__()

    def add_item(self, item):
        self._items.append(item)

    @property
    def simple_items(self):
        return (x for x in self._items if isinstance(x, SimpleAttr))

    @property
    def posattrs(self):
        return (x for x in self._items if isinstance(x, Attribute))

    @property
    def structs(self):
        return (x for x in self._items if isinstance(x, Struct))

    @property
    def subcorpattrs(self):
        for item in self.simple_items:
            if item.name == 'SUBCORPATTRS':
                return split_clean(r'[|,]', item.value)
        return []

    def set_subcorpattrs(self, items):
        scitem = None
        for item in self.simple_items:
            if item.name == 'SUBCORPATTRS':
                scitem = item
                break
        if scitem is None:
            scitem = SimpleAttr(name='SUBCORPATTRS')
            self.add_item(scitem)
        scitem.value = ','.join(items) if len(items) > 0 else None

    def set_freqttattrs(self, items):
        ftitem = None
        for item in self.simple_items:
            if item.name == 'FREQTTATTRS':
                ftitem = item
                break
        if ftitem is None:
            ftitem = SimpleAttr(name='FREQTTATTRS')
            self.add_item(ftitem)
        ftitem.value = ','.join(items) if len(items) > 0 else None

    def set_aligned(self, items):
        aitem = None
        for item in self.simple_items:
            if item.name == 'ALIGNED':
                aitem = item
                break
        if aitem is None:
            aitem = SimpleAttr(name='ALIGNED')
            self.add_item(aitem)
        aitem.value = ','.join(items) if len(items) > 0 else None

    @property
    def freqttattrs(self):
        for item in self.simple_items:
            if item.name == 'FREQTTATTRS':
                return split_clean(r'[|,]', item.value)
        return []

    @property
    def encoding(self):
        enc = 'utf-8'
        for item in self.simple_items:
            if item.name == 'ENCODING':
                enc = item.value
                break
        return enc

    @property
    def aligned(self):
        for item in self.simple_items:
            if item.name == 'ALIGNED':
                return split_clean(',', item.value)
        return []

    def save(self):
        # top level keys and values
        reg_id = self._backend.save_registry_table(
            self._corpus_id, self._variant, [(x.name, x.value) for x in self.simple_items])

        # positional attributes
        posattr_map = {}
        for pos in self.posattrs:
            new_id = self._backend.save_registry_posattr(
                reg_id, pos.name, [(x.name, x.value) for x in pos.attrs])
            posattr_map[pos.name] = new_id

        # now we fill in self references
        for pos in self.posattrs:
            fromattr_id = None
            mapto_id = None
            for pitem in pos.attrs:
                if pitem.name == 'FROMATTR':
                    fromattr_id = posattr_map[pitem.value]
                elif pitem.name == 'MAPTO':
                    mapto_id = posattr_map[pitem.value]
            if fromattr_id is not None or mapto_id is not None:
                self._backend.update_registry_posattr_references(
                    posattr_map[pos.name], fromattr_id, mapto_id)

        # structures
        structattr_map = {}
        for struct in self.structs:
            struct_id = self._backend.save_registry_structure(
                reg_id, struct.name, [(x.name, x.value) for x in struct.simple_items])
            for attr in struct.attributes:
                sa_id = self._backend.save_registry_structattr(
                    struct_id, attr.name, [(x.name, x.value) for x in attr.attrs])
                structattr_map['{0}.{1}'.format(struct.name, attr.name)] = sa_id

        for i, sc in enumerate(self.subcorpattrs):
            self._backend.save_subcorpattr(structattr_map[sc], i)

        for i, fc in enumerate(self.freqttattrs):
            self._backend.save_freqttattr(structattr_map[fc], i)

        self._backend.commit()

        return dict(id=reg_id, corpus_id=self._corpus_id, aligned=self.aligned)

    def load(self):
        self._items = []
        data = self._backend.load_registry_table(self._corpus_id, variant=self._variant)
        if data is None:
            raise RecordNotFound(u'Corpus record not found for {0} (variant: {1})'.format(
                self._corpus_id, self._variant if self._variant else '-'))
        self._id = data['id']
        for k, v in dict(data).items():
            if re.match(r'[A-Z_]+', k):
                self._items.append(SimpleAttr(name=k, value=v))
        self.set_subcorpattrs(self._backend.load_subcorpattrs(self._id))
        self.set_freqttattrs(self._backend.load_freqttattrs(self._id))
        self.set_aligned(self._backend.load_registry_alignments(self._id))

        for item in self._backend.load_registry_posattrs(self._id):
            pa = Attribute(name=item['name'])
            for k, v in [x for x in dict(item).items() if x[0].upper() == x[0]]:
                pa.new_item(SimpleAttr(k, value=v))
            fromattr, mapto = self._backend.load_registry_posattr_references(item['id'])
            if fromattr:
                pa.new_item(SimpleAttr('FROMATTR', fromattr))
            if mapto:
                pa.new_item(SimpleAttr('MAPTO', mapto))
            self.add_item(pa)

        for item in self._backend.load_registry_structures(self._id):
            st = Struct(name=item['name'])
            for k, v in [x for x in dict(item).items() if x[0].upper() == x[0]]:
                st.new_item(SimpleAttr(k, value=v))
            for sattr in self._backend.load_registry_structattrs(item['id']):
                sobj = Attribute(name=sattr['name'])
                for k, v in [x for x in dict(sattr).items() if x[0].upper() == x[0]]:
                    sobj.new_item(SimpleAttr(k, value=v))
                st.new_item(sobj)
            self.add_item(st)


class RegModelSerializer(object):

    INDENT = '\t'

    def __init__(self, add_heading=False):
        self._add_heading = add_heading

    def _sprint_simple(self, obj):
        v = obj.value if obj.value is not None else ''
        return u'{0} {1}'.format(obj.name, u'"{0}"'.format(v) if should_be_quoted(obj.name, v) else v)

    def _sprint_posattr(self, obj, plus_indent=''):
        if len(obj.non_empty_items) > 0:
            values = ''.join(u'{0}{1}\n'.format(self.INDENT + plus_indent,
                                                self._sprint_simple(x)) for x in obj.non_empty_items if x.value is not None)
            return u'{0}ATTRIBUTE {1} {{\n{2}{3}}}'.format(plus_indent, obj.name, values, plus_indent)
        return u'{0}ATTRIBUTE {1}'.format(plus_indent, obj.name)

    def _sprint_structattrs(self, items):
        ans = []
        for item in items:
            if isinstance(item, SimpleAttr) and item.value != '' and item.value is not None:
                ans.append(u'{0}{1}\n'.format(self.INDENT, self._sprint_simple(item)))
            elif isinstance(item, Attribute):
                ans.append(u'{0}\n'.format(self._sprint_posattr(item, self.INDENT)))
        return ''.join(ans)

    def sprint_struct(self, obj):
        if len(obj.attrs) > 0:
            return u'STRUCTURE {0} {{\n{1}}}'.format(obj.name, self._sprint_structattrs(obj.attrs))
        return u'STRUCTURE {0}'.format(obj.name)

    @staticmethod
    def _cmp_names(x1, x2):
        if x1.name == 'NAME':
            return -1
        elif x2.name == 'NAME':
            return 1
        elif x1.name < x2.name:
            return -1
        elif x1.name > x2.name:
            return 1
        else:
            return 0

    def serialize(self, conf):
        ans = u''
        if self._add_heading:
            ans += '###### This file was generated automatically by KonText. Please do not edit. ######\n'
        for item in sorted(conf.simple_items, cmp=self._cmp_names):
            if item.value is not None:
                ans += self._sprint_simple(item)
                ans += '\n'
        for item in sorted(conf.posattrs, key=lambda x: x.name):
            ans += '\n' + self._sprint_posattr(item)
            ans += '\n'
        for item in sorted(conf.structs, key=lambda x: x.name):
            ans += '\n' + self.sprint_struct(item)
            ans += '\n'
        return ans
