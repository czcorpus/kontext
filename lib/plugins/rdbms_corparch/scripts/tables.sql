CREATE TABLE corpus (
	id text NOT NULL,
	list_pos int NOT NULL,
	web text,
	sentence_struct text,
	tagset text,
    collator_locale text,
    speech_segment text,
    speaker_id_attr text,
    speech_overlap_attr text,
    speech_overlap_val text,
    use_safe_font int,
    PRIMARY KEY(id)
);

CREATE TABLE metadata (
	corpus_id text NOT NULL,
	database text,
	label_attr text,
	id_attr text,
	featured text,
	reference_default text,
	reference_other text,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id)
);

CREATE TABLE ttdesc (
    id int NOT NULL,
    text_cs text,
    text_en text,
    PRIMARY KEY (id)
);

CREATE TABLE ttdesc_corpus (
    corpus_id text NOT NULL,
    ttdesc_id int NOT NULL,
    FOREIGN KEY (corpus_id) REFERENCES corpus(id)
    FOREIGN KEY (ttdesc_id) REFERENCES ttdesc(id)
);

CREATE TABLE reference_article (
	id int NOT NULL,
	corpus_id text,
	article text,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id)
);

CREATE TABLE keyword (
	id text NOT NULL,
	label_cs text NOT NULL,
	label_en text NOT NULL,
	color text,
	PRIMARY KEY (id)
);

CREATE TABLE keyword_corpus (
	corpus_id text NOT NULL,
	keyword_id text NOT NULL,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id),
	FOREIGN KEY (keyword_id) REFERENCES keyword(id)
);

CREATE TABLE tckc_corpus (
	corpus_id text NOT NULL,
	provider text,
	type text,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id)
);




