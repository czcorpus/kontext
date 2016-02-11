CREATE TABLE subc_archive2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  corpname TEXT NOT NULL,
  subcname TEXT NOT NULL,
  cql TEXT NOT NULL,
  timestamp INTEGER NOT NULL);

INSERT INTO subc_archive2 (id, user_id, corpname, subcname, cql, timestamp)
SELECT id, user_id, corpname, subcname, 'within <' || struct_name || ' ' || condition || ' />', timestamp
FROM subc_archive;

ALTER TABLE subc_archive rename TO subc_archive_old;
ALTER TABLE subc_archive2 rename TO subc_archive;

