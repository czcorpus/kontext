DROP TABLE IF EXISTS kontext_user_fav_item;
DROP TABLE IF EXISTS kontext_corpus_user_fav_item;


CREATE TABLE kontext_user_fav_item (
    id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    name TEXT NOT NULL,
    subcorpus_id varchar(127),
    subcorpus_orig_id varchar(127),
    user_id INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE kontext_corpus_user_fav_item (
    user_fav_corpus_id INT,
    corpus_name VARCHAR(63),
    CONSTRAINT kontext_corpus_user_fav_item_id FOREIGN KEY (user_fav_corpus_id) REFERENCES kontext_user_fav_item(id),
    CONSTRAINT kontext_corpus_user_fav_item_name FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
    -- note: for the CNC installation, kontext_corpus is actually 'corpora':
    -- CONSTRAINT kontext_corpus_user_fav_item_name FOREIGN KEY (corpus_name) REFERENCES corpora(name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
