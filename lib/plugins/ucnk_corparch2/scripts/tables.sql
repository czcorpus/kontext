SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS kontext_corpus;
CREATE TABLE kontext_corpus (
	id VARCHAR(63) NOT NULL,
	size INT NOT NULL DEFAULT 0,
	group_name VARCHAR(255) NOT NULL,
	version int NOT NULL DEFAULT 1,
	created int NOT NULL,
	updated int NOT NULL,
	active int NOT NULL,
	web VARCHAR(255),
	sentence_struct_id INT,
	tagset VARCHAR(255),
    collator_locale VARCHAR(255),
    speech_segment VARCHAR(255),
    speaker_id_attr VARCHAR(255),
    speech_overlap_attr VARCHAR(255),
    speech_overlap_val VARCHAR(255),
    use_safe_font int,
    requestable int DEFAULT 0,
    CONSTRAINT kontext_corpus_pkey PRIMARY KEY (id),
    CONSTRAINT kontext_corpus_sentence_struct_id_fkey FOREIGN KEY (sentence_struct_id) REFERENCES registry_structure(id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS kontext_article;
CREATE TABLE kontext_article (
    id INTEGER NOT NULL AUTO_INCREMENT,
    entry TEXT NOT NULL,
    CONSTRAINT kontext_article_pkey PRIMARY KEY (id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS kontext_metadata;
CREATE TABLE kontext_metadata (
	corpus_id VARCHAR(63) NOT NULL,
	db VARCHAR(255),
	label_attr VARCHAR(255),
	id_attr VARCHAR(255),
	featured INTEGER DEFAULT 0,
	ttdesc_id INTEGER,
	CONSTRAINT kontext_metadata_pkey PRIMARY KEY (corpus_id),
	CONSTRAINT kontext_metadata_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
	CONSTRAINT kontext_metadata_ttdesc_id_fkey FOREIGN KEY (ttdesc_id) REFERENCES kontext_ttdesc(id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS kontext_ttdesc;
CREATE TABLE kontext_ttdesc (
    id int NOT NULL AUTO_INCREMENT,
    text_cs TEXT,
    text_en TEXT,
    CONSTRAINT kontext_ttdesc_pkey PRIMARY KEY (id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS kontext_corpus_article;
CREATE TABLE kontext_corpus_article (
	article_id INTEGER NOT NULL,
	corpus_id VARCHAR(63) NOT NULL,
	role VARCHAR(255) NOT NULL,
	CONSTRAINT kontext_corpus_article_pkey PRIMARY KEY (article_id, corpus_id),
	CONSTRAINT kontext_corpus_article_article_id_fkey FOREIGN KEY (article_id) REFERENCES kontext_article(id),
	CONSTRAINT kontext_corpus_article_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
	CHECK (role IN ('default', 'standard', 'other'))
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS kontext_keyword;
CREATE TABLE kontext_keyword (
	id VARCHAR(63) NOT NULL,
	label_cs VARCHAR(255) NOT NULL,
	label_en VARCHAR(255) NOT NULL,
	color VARCHAR(255),
	CONSTRAINT kontext_keyword_pkey PRIMARY KEY (id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS kontext_keyword_corpus;
CREATE TABLE kontext_keyword_corpus (
	corpus_id VARCHAR(63) NOT NULL,
	keyword_id VARCHAR(63) NOT NULL,
	CONSTRAINT kontext_keyword_corpus_pkey PRIMARY KEY (corpus_id, keyword_id),
	CONSTRAINT kontext_keyword_corpus_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
	CONSTRAINT kontext_keyword_corpus_keyword_id_fkey FOREIGN KEY (keyword_id) REFERENCES kontext_keyword(id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS kontext_tckc_corpus;
CREATE TABLE kontext_tckc_corpus (
	corpus_id VARCHAR(63) NOT NULL,
	provider VARCHAR(127),
	type VARCHAR(63),
	CONSTRAINT kontext_tckc_corpus_pkey PRIMARY KEY (corpus_id, provider, type),
	CONSTRAINT kontext_tckc_corpus_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id)
) ENGINE = INNODB CHARSET=utf8;

/* --------------------------------------- */

DROP TABLE IF EXISTS registry_conf;
CREATE TABLE registry_conf (
    id INTEGER NOT NULL AUTO_INCREMENT,
    corpus_id VARCHAR(63) NOT NULL,
    variant VARCHAR(255),
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    name VARCHAR(255),
    path VARCHAR(255) NOT NULL,
    vertical VARCHAR(255),
    language VARCHAR(255),
    locale VARCHAR(255),
    rencoding VARCHAR(255) NOT NULL,
    docstructure VARCHAR(255),
    info TEXT,
    shortref VARCHAR(255),
    freqttattrs TEXT,
    tagsetdoc VARCHAR(255),
    wposlist TEXT,
    docstructure_id INTEGER,
    maxcontext INTEGER,
    maxdetail INTEGER,
    maxkwic INTEGER,
    wsdef TEXT,
    wsattr_id INTEGER,
    wsbase TEXT,
    wsthes TEXT,
    alignstruct TEXT,
    aligndef TEXT,
    CONSTRAINT registry_conf_pkey PRIMARY KEY (id),
    CONSTRAINT registry_conf_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
    CONSTRAINT registry_conf_docstructure_id_fkey FOREIGN KEY (docstructure_id) REFERENCES registry_structure(id),
    CONSTRAINT registry_conf_wsattr_id_fkey FOREIGN KEY (wsattr_id) REFERENCES registry_attribute(id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS registry_alignment;
CREATE TABLE registry_alignment (
    registry1_id INTEGER NOT NULL,
    registry2_id INTEGER NOT NULL,
    CONSTRAINT registry_alignment_pkey PRIMARY KEY (registry1_id, registry2_id),
    CONSTRAINT registry_alignment_registry1_id_fkey FOREIGN KEY (registry1_id) REFERENCES registry_conf(id),
    CONSTRAINT registry_alignment_registry2_id_fkey FOREIGN KEY (registry2_id) REFERENCES registry_conf(id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS registry_attribute;
CREATE TABLE registry_attribute (
    id INTEGER NOT NULL AUTO_INCREMENT,
    registry_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    position INT NOT NULL,
    type ENUM('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE'),
    label VARCHAR(255),
    dynamic VARCHAR(255),
    dynlib VARCHAR(255),
    arg1 VARCHAR(255),
    arg2 VARCHAR(255),
    fromattr_id INTEGER,
    funtype ENUM('0', 'c', 's', 'i', 'cc', 'ii', 'ss', 'ci', 'cs', 'sc', 'si', 'ic', 'is'),
    dyntype ENUM('plain', 'lexicon', 'index', 'freq'), /* TODO former 'type' ? */
    transquery ENUM('yes', 'no', 'y', 'n'),
    mapto_id INTEGER,
    multivalue ENUM('yes', 'no', 'y', 'n'),
    multisep VARCHAR(255),
    CONSTRAINT registry_attribute_pkey PRIMARY KEY (id),
    CONSTRAINT registry_attribute_registry_id_fkey FOREIGN KEY (registry_id) REFERENCES registry_conf(id),
    CONSTRAINT registry_attribute_fromattr_id_fkey FOREIGN KEY (fromattr_id) REFERENCES registry_attribute(id),
    CONSTRAINT registry_attribute_mapto_id_fkey FOREIGN KEY (mapto_id) REFERENCES registry_attribute(id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS registry_structure;
CREATE TABLE registry_structure (
    id INTEGER NOT NULL AUTO_INCREMENT,
    registry_id int NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('file32', 'map32', 'file64', 'map64'),
    displaytag ENUM('0', '1'),
    displaybegin VARCHAR(255),
    CONSTRAINT registry_structure_pkey PRIMARY KEY (id),
    CONSTRAINT registry_structure_registry_id_fkey FOREIGN KEY (registry_id) REFERENCES registry_conf(id)
) ENGINE = INNODB CHARSET=utf8;

DROP TABLE IF EXISTS registry_structattr;
CREATE TABLE registry_structattr (
    id INTEGER NOT NULL AUTO_INCREMENT,
    rstructure_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE'),
    locale VARCHAR(255),
    multivalue ENUM('yes', 'no', 'y', 'n'),
    multisep VARCHAR(255),
    maxlistsize INTEGER,
    defaultvalue VARCHAR(255),
    attrdoc VARCHAR(255),
    attrdoclabel VARCHAR(255),
    rnumeric ENUM('yes', 'no', 'y', 'n'),
    subcorpattrs_idx INTEGER DEFAULT -1,
    freqttattrs_idx INTEGER DEFAULT -1,
    CONSTRAINT registry_structattr_pkey PRIMARY KEY (id),
    CONSTRAINT registry_structattr_rstructure_id_fkey FOREIGN KEY (rstructure_id) REFERENCES registry_structure(id)
) ENGINE = INNODB CHARSET=utf8;

/* --------------------------------------------- */

DROP TABLE IF EXISTS registry_conf_user;
CREATE TABLE registry_conf_user (
    user_id INTEGER NOT NULL,
    registry_conf_id INTEGER NOT NULL,
    CONSTRAINT registry_conf_user_pkey PRIMARY KEY (user_id, registry_conf_id),
    CONSTRAINT registry_conf_user_registry_conf_id_fkey FOREIGN KEY (registry_conf_id) REFERENCES registry_conf(id)
) ENGINE = INNODB CHARSET=utf8;


/* THIS PROCEDURE IS A MOCK REPLACEMENT TO SIMULATE PRODUCTION ENVIRONMENT */
DROP PROCEDURE IF EXISTS user_corpus_proc;
DELIMITER $$
CREATE PROCEDURE user_corpus_proc (user_id int)
BEGIN
SELECT user_id, kc.id, rc.variant, IF(rc.variant IS NOT NULL, CONCAT(rc.variant, '/', kc.id), kc.id)
FROM registry_conf AS rc
JOIN kontext_corpus AS kc ON kc.id = rc.corpus_id
WHERE rc.variant IS NULL;
END $$
DELIMITER ;


DROP VIEW IF EXISTS registry_overview;
CREATE VIEW  registry_overview AS
SELECT kc.id AS corpus_id, rc.id AS registry_id, rc.variant
FROM kontext_corpus AS kc
JOIN registry_conf AS rc ON kc.id = rc.corpus_id;




