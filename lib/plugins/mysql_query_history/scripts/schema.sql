DROP TABLE IF EXISTS kontext_query_history;

CREATE TABLE kontext_query_history (
    corpus_name varchar(63) NOT NULL,
    query_id VARCHAR(191) NOT NULL,
    user_id int NOT NULL,
    q_supertype VARCHAR(32) NOT NULL,
    name TEXT,
    created int NOT NULL,
    PRIMARY KEY (query_id, user_id, created),
    CONSTRAINT kontext_query_history_corpus_name FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
