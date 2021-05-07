CREATE TABLE kontext_user (
    id int PRIMARY KEY AUTO_INCREMENT,
    username varchar(127) UNIQUE,
    pwd_hash varchar(255) NOT NULL,
    firstname varchar(255) NOT NULL,
    lastname varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    affiliation TEXT,
    group_access int(11)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE kontext_user_access (
  user_id int NOT NULL,
  corpus_name varchar(63) NOT NULL,
  limited tinyint(1) NOT NULL,
  PRIMARY KEY (user_id, corpus_name),
  CONSTRAINT kontext_user_access_user_id_fk FOREIGN KEY (user_id) REFERENCES kontext_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE kontext_group_access (
  corpus_name varchar(63) NOT NULL,
  group_access int(11) NOT NULL,
  limited tinyint(1) NOT NULL,
  PRIMARY KEY (corpus_name, group_access),
  CONSTRAINT kontext_group_access_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE kontext_sign_up_token (
    id int(11) PRIMARY KEY AUTO_INCREMENT,
    token_value varchar(255) UNIQUE NOT NULL,
    label TEXT,
    created timestamp NOT NULL,
    ttl int(11) NOT NULL,
    username varchar(127) NOT NULL,
    pwd_hash varchar(255) NOT NULL,
    firstname varchar(255) NOT NULL,
    lastname varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    affiliation TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO kontext_user (id, username, firstname, lastname, email, pwd_hash)
VALUES (1, 'anonymous', 'anonymous', 'user', 'anonymous@localhost', '---');
