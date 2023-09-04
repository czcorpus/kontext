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
    within_cond TEXT,
    text_types TEXT,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived TIMESTAMP NULL,
    public_description TEXT,
    version TINYINT NOT NULL DEFAULT 3,
    CONSTRAINT kontext_subcorpus_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
    CONSTRAINT kontext_subcorpus_user_id_fk FOREIGN KEY (user_id) REFERENCES kontext_user(id),
    CONSTRAINT kontext_subcorpus_author_id_fk FOREIGN KEY (author_id) REFERENCES kontext_user(id)
);

DROP TABLE IF EXISTS kontext_preflight_subc;
CREATE TABLE kontext_preflight_subc (
    id VARCHAR(32),
    corpus_name varchar(63) NOT NULL,
    CONSTRAINT kontext_preflight_subc_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
    CONSTRAINT kontext_preflight_subc_id_fk FOREIGN KEY (id) REFERENCES kontext_subcorpus(id)
);
CREATE UNIQUE INDEX kontext_preflight_subc_just_one_corp ON kontext_preflight_subc(corpus_name);

DROP TABLE IF EXISTS kontext_preflight_stats;
CREATE TABLE kontext_preflight_stats (
    id VARCHAR(40) NOT NULL,
    corpus_name VARCHAR(63) NOT NULL,
    subc_id VARCHAR(64),
    query_cql TEXT,
    has_checked_tt TINYINT(1) NOT NULL DEFAULT 0,
    estimated_size INT,
    actual_size INT,
    PRIMARY KEY(id, corpus_name, subc_id),
    CONSTRAINT kontext_preflight_stats_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT kontext_preflight_stats_id_fk FOREIGN KEY (subc_id) REFERENCES kontext_subcorpus(id) ON DELETE CASCADE ON UPDATE CASCADE
);

DROP VIEW IF EXISTS kontext_preflight_subc_evaluation;
CREATE VIEW kontext_preflight_subc_evaluation AS
SELECT corpus_name, subc_id, AVG(ABS(estimated_size - actual_size)) AS avg_error
FROM kontext_preflight_stats
GROUP BY corpus_name, subc_id;

-- for CNC, use:
-- CONSTRAINT kontext_kontext_subcorpus_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES corpora(name),
-- CONSTRAINT kontext_kontext_subcorpus_user_id_fk FOREIGN KEY (user_id) REFERENCES `user`(id),
-- CONSTRAINT kontext_kontext_subcorpus_author_id_fk FOREIGN KEY (author_id) REFERENCES `user`(id)
