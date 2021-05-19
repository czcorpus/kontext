DROP TABLE IF EXISTS kontext_user_fav_corpus;
DROP TABLE IF EXISTS kontext_corpus_user_fav_corpus;


CREATE TABLE kontext_user_fav_corpus (
    id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    name TEXT NOT NULL,
    subcorpus_id TEXT,
    subcorpus_orig_id TEXT,
    user_id INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE kontext_corpus_user_fav_corpus (
    user_fav_corpus_id INT,
    corpus_name VARCHAR(63),
    CONSTRAINT kontext_corpus_user_fav_corpus_id FOREIGN KEY (user_fav_corpus_id) REFERENCES kontext_user_fav_corpus(id),
    CONSTRAINT kontext_corpus_user_fav_corpus_name FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
