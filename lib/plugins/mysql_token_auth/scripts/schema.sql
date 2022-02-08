CREATE TABLE kontext_api_token (
  value varchar(255) NOT NULL,
  user_id int NOT NULL,
  created timestamp NOT NULL,
  valid_until timestamp NOT NULL,
  active boolean NOT NULL DEFAULT false,
  description text,
  PRIMARY KEY (value, user_id),
  UNIQUE INDEX kontext_api_token_value_unique_idx (value),
  CONSTRAINT kontext_api_token_user_id_fk FOREIGN KEY (user_id) REFERENCES kontext_user (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE kontext_api_token_corpus_access (
  token_value varchar(255) NOT NULL,
  user_id int NOT NULL,
  corpus_name  varchar(63) NOT NULL,
  PRIMARY KEY(token_value, user_id, corpus_name),
  CONSTRAINT kontext_api_token_corpus_access_token_user_fk FOREIGN KEY (token_value, user_id) REFERENCES kontext_api_token (value, user_id),
  CONSTRAINT kontext_api_token_corpus_access_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus (name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
