DROP TABLE IF EXISTS kontext_settings;

CREATE TABLE kontext_settings (
    user_id int NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (user_id),
    CONSTRAINT kontext_settings_user_id_fk FOREIGN KEY (user_id) REFERENCES kontext_user(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

DROP TABLE IF EXISTS kontext_corpus_settings;

CREATE TABLE kontext_corpus_settings (
    user_id int NOT NULL,
    corpus_name varchar(63) NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (user_id, corpus_name),
    CONSTRAINT kontext_corpus_settings_user_id_fk FOREIGN KEY (user_id) REFERENCES kontext_user(id),
    CONSTRAINT kontext_corpus_settings_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
