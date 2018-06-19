SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS kontext_corpus;
CREATE TABLE kontext_corpus (
    id INT NOT NULL AUTO_INCREMENT,
	name VARCHAR(63) NOT NULL,
	size INT NOT NULL DEFAULT 0,
	group_name VARCHAR(255) NOT NULL,
	version int NOT NULL DEFAULT 1,
	created int NOT NULL,
	updated int NOT NULL,
	active int NOT NULL,
	web VARCHAR(255),
	sentence_struct VARCHAR(63),
	tagset VARCHAR(255),
    collator_locale VARCHAR(255),
    speech_segment_struct VARCHAR(63),
    speech_segment_attr VARCHAR(63),
    speaker_id_struct VARCHAR(63),
    speaker_id_attr VARCHAR(63),
    speech_overlap_struct VARCHAR(63),
    speech_overlap_attr VARCHAR(63),
    speech_overlap_val VARCHAR(255),
    use_safe_font int,
    requestable int DEFAULT 0,
    text_types_db VARCHAR(255),
    bib_label_struct VARCHAR(63),
	bib_label_attr VARCHAR(63),
	bib_id_struct VARCHAR(63),
	bib_id_attr VARCHAR(63),
	featured INTEGER DEFAULT 0,
	ttdesc_id INTEGER,
    CONSTRAINT kontext_corpus_pkey PRIMARY KEY (id),
    CONSTRAINT kontext_corpus_name_uniq UNIQUE (name),
    CONSTRAINT kontext_corpus_sentence_struct_fkey FOREIGN KEY (name, sentence_struct) REFERENCES corpus_structure(corpus_name, name),
    CONSTRAINT kontext_corpus_speech_segment_structattr_fkey FOREIGN KEY (name, speech_segment_struct, speech_segment_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name),
    CONSTRAINT kontext_corpus_speaker_id_attr_fkey FOREIGN KEY (name, speaker_id_struct, speaker_id_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name),
    CONSTRAINT kontext_corpus_speech_overlap_attr_fkey FOREIGN KEY (name, speech_overlap_struct, speech_overlap_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name),
    CONSTRAINT kontext_corpus_bib_label_structattr_fkey FOREIGN KEY (name, bib_label_struct, bib_label_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name),
    CONSTRAINT kontext_corpus_bib_id_structattr_fkey FOREIGN KEY (name, bib_id_struct, bib_id_attr) REFERENCES  corpus_structattr(corpus_name, structure_name, name),
    CONSTRAINT kontext_corpus_ttdesc_id_fkey FOREIGN KEY (ttdesc_id) REFERENCES kontext_ttdesc(id)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- CORPUS ALIGNMENT * ---------------- */

DROP TABLE IF EXISTS kontext_corpus_alignment;
CREATE TABLE kontext_corpus_alignment (
    corpus_name_1 VARCHAR(63) NOT NULL,
    corpus_name_2 VARCHAR(63) NOT NULL,
    CONSTRAINT kontext_corpus_alignment_pkey PRIMARY KEY (corpus_name_1, corpus_name_2),
    CONSTRAINT kontext_corpus_alignment_corpus_name_1_fkey FOREIGN KEY (corpus_name_1) REFERENCES kontext_corpus(name),
    CONSTRAINT kontext_corpus_alignment_corpus_name_2_fkey FOREIGN KEY (corpus_name_2) REFERENCES kontext_corpus(name)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- ARTICLE ------------------------ */

DROP TABLE IF EXISTS kontext_article;
CREATE TABLE kontext_article (
    id INTEGER NOT NULL AUTO_INCREMENT,
    entry TEXT NOT NULL,
    CONSTRAINT kontext_article_pkey PRIMARY KEY (id)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- TEXTY TYPES DESCRIPTION ------------------------ */

DROP TABLE IF EXISTS kontext_ttdesc;
CREATE TABLE kontext_ttdesc (
    id int NOT NULL AUTO_INCREMENT,
    text_cs TEXT,
    text_en TEXT,
    CONSTRAINT kontext_ttdesc_pkey PRIMARY KEY (id)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- CORPUS ARTICLE M:N ------------------------ */

DROP TABLE IF EXISTS kontext_corpus_article;
CREATE TABLE kontext_corpus_article (
	article_id INTEGER NOT NULL,
	corpus_name VARCHAR(63) NOT NULL,
	role ENUM('default', 'standard', 'other') NOT NULL,
	CONSTRAINT kontext_corpus_article_pkey PRIMARY KEY (article_id, corpus_name),
	CONSTRAINT kontext_corpus_article_article_id_fkey FOREIGN KEY (article_id) REFERENCES kontext_article(id),
	CONSTRAINT kontext_corpus_article_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- SEARCH KEYWORDS ('tags') ------------------- */

DROP TABLE IF EXISTS kontext_keyword;
CREATE TABLE kontext_keyword (
	id VARCHAR(63) NOT NULL,
	label_cs VARCHAR(255) NOT NULL,
	label_en VARCHAR(255) NOT NULL,
	color VARCHAR(31),
	CONSTRAINT kontext_keyword_pkey PRIMARY KEY (id)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- CORPUS - KEYWORD M:N ------------------- */

DROP TABLE IF EXISTS kontext_keyword_corpus;
CREATE TABLE kontext_keyword_corpus (
	corpus_name VARCHAR(63) NOT NULL,
	keyword_id VARCHAR(63) NOT NULL,
	CONSTRAINT kontext_keyword_corpus_pkey PRIMARY KEY (corpus_name, keyword_id),
	CONSTRAINT kontext_keyword_corpus_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
	CONSTRAINT kontext_keyword_corpus_keyword_id_fkey FOREIGN KEY (keyword_id) REFERENCES kontext_keyword(id)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- TOKEN/KWIC CONNECT PROVIDERS FOR CORPORA ------ */

DROP TABLE IF EXISTS kontext_tckc_corpus;
CREATE TABLE kontext_tckc_corpus (
	corpus_name VARCHAR(63) NOT NULL,
	provider VARCHAR(127) NOT NULL,
	type VARCHAR(63),
	CONSTRAINT kontext_tckc_corpus_pkey PRIMARY KEY (corpus_name, provider, type),
	CONSTRAINT kontext_tckc_corpus_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE = INNODB CHARSET=utf8;

/* -------------------------------- MAIN REGISTRY CONF. FILE ------- */

DROP TABLE IF EXISTS registry_conf;
CREATE TABLE registry_conf (
    corpus_name VARCHAR(63) NOT NULL,
    name VARCHAR(255),
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    path VARCHAR(255) NOT NULL,
    vertical VARCHAR(255),
    language VARCHAR(255),
    locale VARCHAR(255),
    rencoding VARCHAR(255) NOT NULL,
    info TEXT,
    shortref VARCHAR(255),
    freqttattrs TEXT,
    tagsetdoc VARCHAR(255),
    wposlist TEXT,
    docstructure VARCHAR(63),
    wsdef TEXT,
    wsattr VARCHAR(63),
    wsbase TEXT,
    wsthes TEXT,
    alignstruct TEXT,
    aligndef TEXT,
    CONSTRAINT registry_conf_pkey PRIMARY KEY (corpus_name),
    CONSTRAINT registry_conf_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
    CONSTRAINT registry_conf_docstructure_fkey FOREIGN KEY (corpus_name, docstructure) REFERENCES corpus_structure(corpus_name, name),
    CONSTRAINT registry_conf_wsattr_id_fkey FOREIGN KEY (corpus_name, wsattr) REFERENCES corpus_posattr(corpus_name, name)
) ENGINE = INNODB CHARSET=utf8;

/* --------------------- VARIABLE (CUSTOMIZABLE) PART OF THE MAIN REGISTRY FILE ------------ */

DROP TABLE IF EXISTS registry_variable;
CREATE TABLE registry_variable (
    id INTEGER NOT NULL AUTO_INCREMENT,
    corpus_name VARCHAR(63) NOT NULL,
    variant VARCHAR(63),
    maxcontext INTEGER,
    maxdetail INTEGER,
    maxkwic INTEGER,
    CONSTRAINT registry_varible_pkey PRIMARY KEY (id),
    CONSTRAINT registry_varible_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
    CONSTRAINT registry_variable_corp_variant_uniq UNIQUE (corpus_name, variant)
) ENGINE = INNODB CHARSET=utf8;



DROP TABLE IF EXISTS corpus_posattr;
CREATE TABLE corpus_posattr (
    corpus_name VARCHAR(63) NOT NULL,
    name VARCHAR(63) NOT NULL,
    position INT NOT NULL,
    type ENUM('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE'),
    label VARCHAR(255),
    dynamic VARCHAR(255),
    dynlib VARCHAR(255),
    arg1 VARCHAR(255),
    arg2 VARCHAR(255),
    fromattr VARCHAR(63), /* a self reference */
    funtype ENUM('0', 'c', 's', 'i', 'cc', 'ii', 'ss', 'ci', 'cs', 'sc', 'si', 'ic', 'is'),
    dyntype ENUM('plain', 'lexicon', 'index', 'freq'), /* TODO former 'type' ? */
    transquery ENUM('yes', 'no', 'y', 'n'),
    mapto VARCHAR(63), /* a self reference */
    multivalue ENUM('yes', 'no', 'y', 'n'),
    multisep VARCHAR(31),
    CONSTRAINT corpus_posattr_pkey PRIMARY KEY (corpus_name, name),
    CONSTRAINT corpus_posattr_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
    CONSTRAINT corpus_posattr_fromattr_fkey FOREIGN KEY (corpus_name, fromattr) REFERENCES corpus_posattr(corpus_name, name),
    CONSTRAINT corpus_posattr_mapto_fkey FOREIGN KEY (corpus_name, mapto) REFERENCES corpus_posattr(corpus_name, name)
) ENGINE = INNODB CHARSET=utf8;


DROP TABLE IF EXISTS corpus_structure;
CREATE TABLE corpus_structure (
    corpus_name VARCHAR(63) NOT NULL,
    name VARCHAR(63) NOT NULL,
    type ENUM('file32', 'map32', 'file64', 'map64'),
    displaytag ENUM('0', '1'),
    displaybegin VARCHAR(255),
    CONSTRAINT corpus_structure_pkey PRIMARY KEY (corpus_name, name),
    CONSTRAINT corpus_structure_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE = INNODB CHARSET=utf8;


DROP TABLE IF EXISTS corpus_structattr;
CREATE TABLE corpus_structattr (
    corpus_name VARCHAR(63) NOT NULL,
    structure_name VARCHAR(63) NOT NULL,
    name VARCHAR(63) NOT NULL,
    `type` ENUM('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE'),
    locale VARCHAR(31),
    multivalue ENUM('yes', 'no', 'y', 'n'),
    multisep VARCHAR(31),
    maxlistsize INTEGER,
    defaultvalue VARCHAR(255),
    attrdoc VARCHAR(255),
    attrdoclabel VARCHAR(255),
    rnumeric ENUM('yes', 'no', 'y', 'n'),
    subcorpattrs_idx INTEGER DEFAULT -1,
    freqttattrs_idx INTEGER DEFAULT -1,
    CONSTRAINT corpus_structattr_pkey PRIMARY KEY (corpus_name, structure_name, name),
    CONSTRAINT corpus_structattr_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
    CONSTRAINT corpus_structattr_structure_name_fkey FOREIGN KEY (corpus_name, structure_name) REFERENCES corpus_structure(corpus_name, name)
) ENGINE = INNODB CHARSET=utf8;

/* --------------------------------------------- */
/* THIS IS ONLY FOR LOCAL DEVEL PURPOSES */
DROP TABLE IF EXISTS kontext_corpus_user;
CREATE TABLE kontext_corpus_user (
    user_id INTEGER NOT NULL,
    corpus_name VARCHAR(63) NOT NULL,
    variant VARCHAR(63),
    CONSTRAINT kontext_corpus_user_pkey PRIMARY KEY (user_id, corpus_name),
    CONSTRAINT kontext_corpus_user_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name)
) ENGINE = INNODB CHARSET=utf8;


/* THIS PROCEDURE IS A MOCK REPLACEMENT TO SIMULATE PRODUCTION ENVIRONMENT */
DROP PROCEDURE IF EXISTS user_corpus_proc;
DELIMITER $$
CREATE PROCEDURE user_corpus_proc (user_id int)
BEGIN
SELECT user_id, kc.name, NULL AS variant, kc.name
FROM kontext_corpus AS kc;
END $$
DELIMITER ;

/* THIS IS ONLY FOR LOCAL DEVEL PURPOSES */
DROP VIEW IF EXISTS registry_overview;
CREATE VIEW  registry_overview AS
SELECT kc.name AS corpus_id, rv.variant
FROM kontext_corpus AS kc
JOIN registry_variable AS rv ON kc.name = rv.corpus_name;




