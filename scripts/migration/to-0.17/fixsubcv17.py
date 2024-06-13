import argparse
import mysql.connector
import os
import sys
from datetime import datetime
from dataclasses import dataclass
import traceback

@dataclass
class Subc:
    id: str
    author_id: int
    name: str
    corpus_name: str
    created: datetime


def find_subc_ctime(root_path: str, user_id: int, corpus_id: str, subc_name: str):
    path = os.path.join(root_path, str(user_id), corpus_id, subc_name + '.subc')
    try:
        return datetime.fromtimestamp(os.path.getctime(path))
    except FileNotFoundError:
        return None

def update_subcorpus(db, id: str, created: datetime, dry_run: bool):
    if dry_run:
        print(
            'SQL: UPDATE kontext_subcorpus '
            f'SET version = 1, created = {created} ' 
            f'WHERE id = {id}')
    else:
        cursor = db.cursor()
        cursor.execute(
            'UPDATE kontext_subcorpus '
            'SET version = 1, created = %s ' 
            'WHERE id = %s',
            (created.strftime("%Y-%m-%dT%H:%M:%S%z"), id))


def delete_invalid_subcorpus(db, id: str, dry_run: bool):
    if dry_run:
        print('SQL: DELETE FROM kontext_subcorpus WHERE id = {}'.format(id))
    else:
        cursor = db.cursor()
        cursor.execute('DELETE FROM kontext_subcorpus WHERE id = %s', (id, ))

def fix_subcorpus(db, root_path: str, subc: Subc, dry_run: bool):
    ctime = find_subc_ctime(root_path, subc.author_id, subc.corpus_name, subc.name)
    print('actual ctime is {}'.format(ctime))
    if ctime is None:
        print(f'SUBC {subc.name} NOT FOUND, going to delete it')
        delete_invalid_subcorpus(db, subc.id, dry_run)
    else:
        update_subcorpus(db, subc.id, ctime, dry_run)


def list_all_subcorpora(db):
    cursor = db.cursor()
    cursor.execute('SELECT id, name, author_id, corpus_name, created FROM kontext_subcorpus WHERE name NOT LIKE \'%preflight\'')
    for row in cursor.fetchall():
        yield Subc(id=row[0], name=row[1], author_id=row[2], corpus_name=row[3], created=row[4])



if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fix user subcorpora')
    parser.add_argument('--mysql-host', type=str, default='localhost')
    parser.add_argument('--mysql-port', type=int, default=3306)
    parser.add_argument('--mysql-db', type=str, default='kontext')
    parser.add_argument('--mysql-user', type=str, default='kontext')
    parser.add_argument('--mysql-pwd', type=str)
    parser.add_argument('--subc-dir', type=str)
    parser.add_argument('--dry-run', action='store_true',
                        default=False, help='Only print changes')
    args = parser.parse_args()

    mysql_client = mysql.connector.connect(
        host=args.mysql_host, port=args.mysql_port, user=args.mysql_user, password=args.mysql_pwd, database=args.mysql_db)

    try:
        for subc in list_all_subcorpora(mysql_client):
            fix_subcorpus(mysql_client, args.subc_dir, subc, args.dry_run)
        mysql_client.commit()
    except Exception as ex:
        print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
        traceback.print_exc()
        sys.exit(1)

    mysql_client.close()