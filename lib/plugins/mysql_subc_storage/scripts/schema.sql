DROP TABLE IF EXISTS kontext_subcorpus;
CREATE TABLE kontext_subcorpus (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(127) NOT NULL,
    user_id INTEGER, -- if NULL then the subcorpus is deleted for the user but it still exists (e.g. to be avail. if published)
    author_id INTEGER NOT NULL,
    corpus_name varchar(63) NOT NULL,
    aligned TEXT,
    is_draft TINYINT NOT NULL DEFAULT 0,
    size BIGINT NOT NULL,
    cql TEXT,
    within_cond JSON DEFAULT NULL,
    text_types JSON DEFAULT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived TIMESTAMP NULL,
    public_description TEXT,
    version TINYINT NOT NULL DEFAULT 3,
    CONSTRAINT kontext_subcorpus_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
    CONSTRAINT kontext_subcorpus_user_id_fk FOREIGN KEY (user_id) REFERENCES kontext_user(id),
    CONSTRAINT kontext_subcorpus_author_id_fk FOREIGN KEY (author_id) REFERENCES kontext_user(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- for CNC, use:
-- CONSTRAINT kontext_kontext_subcorpus_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES corpora(name),
-- CONSTRAINT kontext_kontext_subcorpus_user_id_fk FOREIGN KEY (user_id) REFERENCES `user`(id),
-- CONSTRAINT kontext_kontext_subcorpus_author_id_fk FOREIGN KEY (author_id) REFERENCES `user`(id)
