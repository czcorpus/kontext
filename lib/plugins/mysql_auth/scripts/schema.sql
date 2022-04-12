CREATE TABLE kontext_user (
    id int PRIMARY KEY AUTO_INCREMENT,
    username varchar(127) UNIQUE,
    pwd_hash varchar(255) NOT NULL,
    firstname varchar(255) NOT NULL,
    lastname varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    affiliation TEXT,
    group_access int(11)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE kontext_user_access (
  user_id int NOT NULL,
  corpus_name varchar(63) NOT NULL,
  limited tinyint(1) NOT NULL,
  PRIMARY KEY (user_id, corpus_name),
  CONSTRAINT kontext_user_access_user_id_fk FOREIGN KEY (user_id) REFERENCES kontext_user(id),
  CONSTRAINT kontext_user_access_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE kontext_user_pc_access (
  user_id int(11) NOT NULL,
  parallel_corpus_id int(11) NOT NULL,
  limited tinyint(1) NOT NULL,
  PRIMARY KEY (user_id, parallel_corpus_id),
  KEY user_parallel_corpus_fk_parallel_corpus_id (parallel_corpus_id),
  CONSTRAINT user_parallel_corpus_fk_parallel_corpus_id FOREIGN KEY (parallel_corpus_id) REFERENCES kontext_parallel_corpus (id),
  CONSTRAINT user_parallel_corpus_fk_user_id FOREIGN KEY (user_id) REFERENCES kontext_user (id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE kontext_group_access (
  corpus_name varchar(63) NOT NULL,
  group_access int(11) NOT NULL,
  limited tinyint(1) NOT NULL,
  PRIMARY KEY (corpus_name, group_access),
  CONSTRAINT kontext_group_access_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE kontext_group_pc_access (
  parallel_corpus_id int(11) NOT NULL,
  group_access varchar(63) NOT NULL,
  limited tinyint(1) NOT NULL,
  PRIMARY KEY (parallel_corpus_id, group_access),
  KEY corplist_parallel_corpus_fk_parallel_corpus_id (parallel_corpus_id),
  CONSTRAINT corplist_parallel_corpus_fk_parallel_corpus_id FOREIGN KEY (parallel_corpus_id) REFERENCES kontext_parallel_corpus (id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

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
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT INTO kontext_user (id, username, firstname, lastname, email, pwd_hash)
VALUES (1, 'anonymous', 'anonymous', 'user', 'anonymous@localhost', '---');
INSERT INTO kontext_user_access (user_id, corpus_name, limited) VALUES (1, 'susanne', 0);
