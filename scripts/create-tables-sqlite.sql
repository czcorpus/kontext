CREATE TABLE user (
  user TEXT NOT NULL,
  pass TEXT NOT NULL,
  host TEXT,
  hardcut INTEGER,
  content INTEGER,
  corplist TEXT,
  subcorp TEXT,
  fullname TEXT,
  email TEXT,
  regist TEXT,
  expire TEXT,
  valid INTEGER,
  sketches INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user)
);

CREATE TABLE corpora (
  id INTEGER NOT NULL,
  name TEXT,
  PRIMARY KEY (id)
);

CREATE TABLE relation (
  corplist INTEGER NOT NULL,
  corpora INTEGER NOT NULL,
  PRIMARY KEY (corplist, corpora)
);

CREATE TABLE corplist (
  id INTEGER NOT NULL,
  name TEXT,
  PRIMARY KEY (id)
);