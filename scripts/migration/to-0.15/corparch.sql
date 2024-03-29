ALTER TABLE kontext_corpus
ADD column default_view_opts TEXT,
ADD syntax_viewer_conf_json TEXT;

CREATE TABLE kontext_interval_attr (
    corpus_name TEXT NOT NULL,
    interval_struct TEXT NOT NULL,
    interval_attr TEXT NOT NULL,
    widget TEXT NOT NULL,
    CONSTRAINT kontext_interval_attr_pkey PRIMARY KEY (corpus_name, interval_struct, interval_attr),
    CONSTRAINT kontext_interval_attr_interval_attr_fkey FOREIGN KEY (corpus_name, interval_struct, interval_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name)
);


ALTER TABLE `kontext_corpus_taghelper`
ADD `widget_enabled` INT NOT NULL DEFAULT 0,
ADD `doc_url_local` TEXT NULL,
ADD `doc_url_en` TEXT NULL;

update kontext_corpus_taghelper set widget_enabled = 1;