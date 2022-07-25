DROP TABLE IF EXISTS kontext_subcorpus;

    CREATE TABLE kontext_subcorpus (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(127) NOT NULL,
      user_id INTEGER, -- if NULL then the subcorpus is deleted for the user but it still exists (e.g. to be avail. if published)
      author_id INTEGER NOT NULL,
      corpus_name varchar(63) NOT NULL,
      size INTEGER NOT NULL,
      cql TEXT,
      within_cond TEXT,
      text_types TEXT,
      created TIMESTAMP NOT NULL,
      archived TIMESTAMP NULL,
      published TIMESTAMP NULL,
      public_description TEXT,
      data_path VARCHAR(255) NOT NULL,
      CONSTRAINT kontext_subcorpus_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
      CONSTRAINT kontext_subcorpus_user_id_fk FOREIGN KEY (user_id) REFERENCES kontext_user(id),
      CONSTRAINT kontext_subcorpus_author_id_fk FOREIGN KEY (author_id) REFERENCES kontext_user(id)
    );

-- for CNC, use:
-- CONSTRAINT kontext_subc_archive_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES corpora(name),
-- CONSTRAINT kontext_subc_archive_user_id_fk FOREIGN KEY (user_id) REFERENCES `user`,
-- CONSTRAINT kontext_subc_archive_author_id_fk FOREIGN KEY (author_id) REFERENCES `user`(id),

