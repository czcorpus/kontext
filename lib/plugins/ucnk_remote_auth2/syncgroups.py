# Copyright 2015 Institute of the Czech National Corpus
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

import argparse
import json
import MySQLdb
from lxml import etree

import mysqlops


class Loader(mysqlops.Db):
    def __init__(self, conn):
        super(Loader, self).__init__(conn)

    def load_groups(self):
        cursor = self.query("SELECT c.name, cc.name " +
                            "FROM corpora c JOIN relation r JOIN corplist cc " +
                            "ON c.id = r.corpora and r.corplist = cc.id order by c.name")
        return cursor.fetchall()


class Config(object):
    def __init__(self, path):
        with open(path, 'rb') as f:
            self._doc = etree.parse(f)

    def update_corpus(self, corp_id, groups):
        corp_id = corp_id.rsplit('/', 1)[-1]
        match = filter(lambda x: x.attrib['ident'].lower() == corp_id.lower(), self._doc.findall('//corpus'))
        if len(match) == 1:
            item = match[0]
            ag = item.find('access_groups')
            if ag is not None:
                item.remove(ag)
            ag_elm = etree.SubElement(item, 'access_groups')
            for g in groups:
                item_elm = etree.SubElement(ag_elm, 'item')
                item_elm.text = g
        else:
            print('>>> problem configuring %s' % corp_id)

    def dump_to_text(self):
        return etree.tostring(self._doc, encoding='utf-8', pretty_print=True)


def run(syncdb_conf_path, kontext_conf):
    mysql_conf = json.load(open(syncdb_conf_path, 'rb'))['mysql']
    mysql_conn = MySQLdb.connect(host=mysql_conf['hostname'], user=mysql_conf['user'],
                                 passwd=mysql_conf['passwd'], db=mysql_conf['dbname'],
                                 use_unicode=mysql_conf['use_unicode'], charset=mysql_conf['charset'])
    loader = Loader(mysql_conn)
    updater = Config(kontext_conf)

    last_corp = None
    group = []
    for item in loader.load_groups():
        if item[0] != last_corp:
            if last_corp is not None:
                updater.update_corpus(item[0], group)
                group = []
            last_corp = item[0]
        group.append(item[1])
    updater.update_corpus(last_corp, group)
    return updater.dump_to_text()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fetch groups of corpora and import them to corplist.xml')
    parser.add_argument('conf_path', metavar='CONF_PATH', type=str, help='Path to a config file')
    parser.add_argument('corplist_path', metavar='CORPLIST_PATH', type=str, help='Path to a source corplist.xml')
    parser.add_argument('-p', '--print', action='store_const', const=True,
                        help='Print result instead of writing it to a file')

    args = parser.parse_args()
    result_xml = run(args.conf_path, args.corplist_path)
    if getattr(args, 'print'):
        print(result_xml)
    else:
        output_path = '%s.new.xml' % args.corplist_path.rsplit('.', 1)[0]
        with open(output_path, 'wb') as f:
            f.write(result_xml)
            print('DONE!\nConverted config written to %s\n' % output_path)
