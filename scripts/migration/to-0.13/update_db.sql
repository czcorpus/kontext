-- for users of rdbms_corparch

CREATE TABLE kontext_corpus_user (
     user_id INTEGER NOT NULL,
     corpus_id TEXT NOT NULL,
     variant TEXT,
     CONSTRAINT kontext_corpus_user_pkey PRIMARY KEY (user_id, corpus_id),
     CONSTRAINT kontext_corpus_user_corpus_name_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id)
 );