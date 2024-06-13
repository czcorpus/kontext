import mysql.connector


def find_subcorpora(db):
    cur = db.cursor()
    cur.execute('SELECT * FROM kontext_subcorpus')
    return cur.fetchall()

def fix_subcorpus(db, item):
    print(item)

def fix_subcorpus(db):
    for item in find_subcorpora(db):
        fix_subcorpus(db, item)


if __name__ == '__main__':
    pwd = input('db password: ')
    db = mysql.connector.connect(
        host="skalicka",
        user="manatee",
        database="manatee",
        password=pwd,
    )

