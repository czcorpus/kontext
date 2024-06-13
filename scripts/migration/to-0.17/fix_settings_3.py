import mysql.connector
import sys
import json

def find_settings(db):
    cur = db.cursor()
    cur.execute("SELECT user_id, data FROM kontext_settings WHERE data like '%omezeni%'")
    return cur.fetchall()

def fix_settings(db, user_id, data):
    tdata = json.loads(data)
    fixed_data = {}
    for k, v in tdata.items():
        if k.startswith('omezeni/'):
            k_new = k[len('omezeni/'):]
        else:
            k_new = k
        fixed_data[k_new] = v
    print(fixed_data)

def fix(db):
    for item in find_settings(db):
        fix_settings(db, item[0], item[1])

if __name__ == '__main__':
    pwd = input('db password: ')
    db = mysql.connector.connect(
        host="skalicka",
        user="manatee",
        database="manatee",
        password=pwd,
    )
    fix(db)
    db.commit()
