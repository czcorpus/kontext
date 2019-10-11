/* We assume there is a table called 'corpora' available
CREATE TABLE corpora (
    id INT NOT NULL AUTO_INCREMENT,
	name VARCHAR(63) NOT NULL,
	CONSTRAINT kontext_corpus_pkey PRIMARY KEY (id)
) ENGINE = INNODB CHARSET=utf8;
INSERT INTO corpora (name) VALUES ('syn2010'), ('syn2015'), ('intercorp_v10_cs'), ('intercorp_v10_en'), ('intercorp_v10_mk'),
('intercorp_v10_pl'), ('oral2006'), ('oral2008'), ('oral2013'), ('susanne'), ('capek'), ('camus'), ('diakorp_v6'),
('koditex');
*/
SET FOREIGN_KEY_CHECKS=0;
/*
ALTER TABLE corpora DROP INDEX corpora_name_uniq;
ALTER TABLE corpora DROP FOREIGN KEY corpora_sentence_struct_fkey;
ALTER TABLE corpora DROP FOREIGN KEY corpora_speech_segment_structattr_fkey;
ALTER TABLE corpora DROP FOREIGN KEY corpora_speaker_id_attr_fkey;
ALTER TABLE corpora DROP FOREIGN KEY corpora_speech_overlap_attr_fkey;
ALTER TABLE corpora DROP FOREIGN KEY corpora_bib_label_structattr_fkey;
ALTER TABLE corpora DROP FOREIGN KEY corpora_bib_id_structattr_fkey;
ALTER TABLE corpora DROP FOREIGN KEY corpora_ttdesc_id_fkey;
ALTER TABLE corpora DROP COLUMN `size`;
ALTER TABLE corpora DROP COLUMN group_name;
ALTER TABLE corpora DROP COLUMN version;
ALTER TABLE corpora DROP COLUMN created;
ALTER TABLE corpora DROP COLUMN updated;
ALTER TABLE corpora DROP COLUMN active;
ALTER TABLE corpora DROP COLUMN web;
ALTER TABLE corpora DROP COLUMN sentence_struct;
ALTER TABLE corpora DROP COLUMN tagset;
ALTER TABLE corpora DROP COLUMN collator_locale;
ALTER TABLE corpora DROP COLUMN speech_segment_struct;
ALTER TABLE corpora DROP COLUMN speech_segment_attr;
ALTER TABLE corpora DROP COLUMN speaker_id_struct;
ALTER TABLE corpora DROP COLUMN speaker_id_attr;
ALTER TABLE corpora DROP COLUMN speech_overlap_struct;
ALTER TABLE corpora DROP COLUMN speech_overlap_attr;
ALTER TABLE corpora DROP COLUMN speech_overlap_val;
ALTER TABLE corpora DROP COLUMN use_safe_font;
ALTER TABLE corpora DROP COLUMN requestable;
ALTER TABLE corpora DROP COLUMN text_types_db;
ALTER TABLE corpora DROP COLUMN bib_label_struct;
ALTER TABLE corpora DROP COLUMN bib_label_attr;
ALTER TABLE corpora DROP COLUMN bib_id_struct;
ALTER TABLE corpora DROP COLUMN bib_id_attr;
ALTER TABLE corpora DROP COLUMN featured;
ALTER TABLE corpora DROP COLUMN featured;
ALTER TABLE corpora DROP COLUMN ttdesc_id;
*/

SET FOREIGN_KEY_CHECKS=0;
ALTER TABLE corpora
	ADD COLUMN size INT NOT NULL DEFAULT 0,
	ADD COLUMN group_name VARCHAR(255) NOT NULL,
	ADD COLUMN version int NOT NULL DEFAULT 1,
	ADD COLUMN created VARCHAR(25),
	ADD COLUMN updated VARCHAR(25),
	ADD COLUMN active int NOT NULL,
	ADD COLUMN web VARCHAR(255),
	ADD COLUMN sentence_struct VARCHAR(63),
	ADD COLUMN tagset VARCHAR(255),
    ADD COLUMN collator_locale VARCHAR(255),
    ADD COLUMN speech_segment_struct VARCHAR(63),
    ADD COLUMN speech_segment_attr VARCHAR(63),
    ADD COLUMN speaker_id_struct VARCHAR(63),
    ADD COLUMN speaker_id_attr VARCHAR(63),
    ADD COLUMN speech_overlap_struct VARCHAR(63),
    ADD COLUMN speech_overlap_attr VARCHAR(63),
    ADD COLUMN speech_overlap_val VARCHAR(255),
    ADD COLUMN use_safe_font int,
    ADD COLUMN requestable int DEFAULT 0,
    ADD COLUMN text_types_db VARCHAR(255),
    ADD COLUMN bib_label_struct VARCHAR(63),
	ADD COLUMN bib_label_attr VARCHAR(63),
	ADD COLUMN bib_id_struct VARCHAR(63),
	ADD COLUMN bib_id_attr VARCHAR(63),
	ADD COLUMN bib_group_duplicates INTEGER DEFAULT 0,
	ADD COLUMN featured INTEGER DEFAULT 0,
	ADD COLUMN ttdesc_id INTEGER,
	ADD COLUMN description_cs TEXT,
	ADD COLUMN description_en TEXT;

ALTER TABLE corpora ADD CONSTRAINT corpora_name_uniq UNIQUE (name);

/* ------------------------------- CORPUS ALIGNMENT * ---------------- */

DROP TABLE IF EXISTS corpus_alignment;
CREATE TABLE corpus_alignment (
    corpus_name_1 VARCHAR(63) NOT NULL,
    corpus_name_2 VARCHAR(63) NOT NULL,
    CONSTRAINT corpus_alignment_pkey PRIMARY KEY (corpus_name_1, corpus_name_2),
    CONSTRAINT corpus_alignment_corpus_name_1_fkey FOREIGN KEY (corpus_name_1) REFERENCES corpora(name),
    CONSTRAINT corpus_alignment_corpus_name_2_fkey FOREIGN KEY (corpus_name_2) REFERENCES corpora(name)
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
	CONSTRAINT kontext_corpus_article_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- SEARCH KEYWORDS ('tags') ------------------- */

DROP TABLE IF EXISTS kontext_keyword;
CREATE TABLE kontext_keyword (
	id VARCHAR(63) NOT NULL,
	label_cs VARCHAR(255) NOT NULL,
	label_en VARCHAR(255) NOT NULL,
	color VARCHAR(31),
	display_order INT NOT NULL DEFAULT 0,
	CONSTRAINT kontext_keyword_pkey PRIMARY KEY (id)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- CORPUS - KEYWORD M:N ------------------- */

DROP TABLE IF EXISTS kontext_keyword_corpus;
CREATE TABLE kontext_keyword_corpus (
	corpus_name VARCHAR(63) NOT NULL,
	keyword_id VARCHAR(63) NOT NULL,
	CONSTRAINT kontext_keyword_corpus_pkey PRIMARY KEY (corpus_name, keyword_id),
	CONSTRAINT kontext_keyword_corpus_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name),
	CONSTRAINT kontext_keyword_corpus_keyword_id_fkey FOREIGN KEY (keyword_id) REFERENCES kontext_keyword(id)
) ENGINE = INNODB CHARSET=utf8;

/* ------------------------------- TOKEN/KWIC CONNECT PROVIDERS FOR CORPORA ------ */

DROP TABLE IF EXISTS kontext_tckc_corpus;
CREATE TABLE kontext_tckc_corpus (
	corpus_name VARCHAR(63) NOT NULL,
	provider VARCHAR(127) NOT NULL,
	type VARCHAR(63),
	display_order INT NOT NULL DEFAULT 0,
	is_kwic_view INT NOT NULL DEFAULT 0,
	CONSTRAINT kontext_tckc_corpus_pkey PRIMARY KEY (corpus_name, provider, type),
	CONSTRAINT kontext_tckc_corpus_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name)
) ENGINE = INNODB CHARSET=utf8;

/* -------------------------------- MAIN REGISTRY CONF. FILE ------- */

DROP TABLE IF EXISTS registry_conf;
CREATE TABLE registry_conf (
    corpus_name VARCHAR(63) NOT NULL,
    name VARCHAR(255),
    created VARCHAR(25),
    updated VARCHAR(25),
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
    CONSTRAINT registry_conf_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name),
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
    CONSTRAINT registry_varible_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name),
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
    CONSTRAINT corpus_posattr_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name),
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
    CONSTRAINT corpus_structure_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name)
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
    CONSTRAINT corpus_structattr_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name),
    CONSTRAINT corpus_structattr_structure_name_fkey FOREIGN KEY (corpus_name, structure_name) REFERENCES corpus_structure(corpus_name, name)
) ENGINE = INNODB CHARSET=utf8;



/* ------------------------------ CORPUS interval attrs M:N ------------------- */

DROP TABLE IF EXISTS kontext_interval_attr;
CREATE TABLE kontext_interval_attr (
    corpus_name VARCHAR(63) NOT NULL,
    interval_struct VARCHAR(63) NOT NULL,
    interval_attr VARCHAR(63) NOT NULL,
    CONSTRAINT kontext_interval_attr_pkey PRIMARY KEY (corpus_name, interval_attr),
    CONSTRAINT kontext_interval_attr_interval_attr_fkey FOREIGN KEY (corpus_name, interval_struct, interval_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name)
) ENGINE = INNODB CHARSET=utf8;

/* --------------------------------------------- */
/* THIS IS ONLY FOR LOCAL DEVEL PURPOSES */
DROP TABLE IF EXISTS kontext_corpus_user;
CREATE TABLE kontext_corpus_user (
    user_id INTEGER NOT NULL,
    corpus_name VARCHAR(63) NOT NULL,
    variant VARCHAR(63),
    CONSTRAINT kontext_corpus_user_pkey PRIMARY KEY (user_id, corpus_name),
    CONSTRAINT kontext_corpus_user_corpus_name_fkey FOREIGN KEY (corpus_name) REFERENCES corpora(name)
) ENGINE = INNODB CHARSET=utf8;


ALTER TABLE corpora ADD CONSTRAINT corpora_sentence_struct_fkey FOREIGN KEY (name, sentence_struct) REFERENCES corpus_structure(corpus_name, name);
ALTER TABLE corpora ADD CONSTRAINT corpora_speech_segment_structattr_fkey FOREIGN KEY (name, speech_segment_struct, speech_segment_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name);
ALTER TABLE corpora ADD CONSTRAINT corpora_speaker_id_attr_fkey FOREIGN KEY (name, speaker_id_struct, speaker_id_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name);
ALTER TABLE corpora ADD CONSTRAINT corpora_speech_overlap_attr_fkey FOREIGN KEY (name, speech_overlap_struct, speech_overlap_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name);
ALTER TABLE corpora ADD CONSTRAINT corpora_bib_label_structattr_fkey FOREIGN KEY (name, bib_label_struct, bib_label_attr) REFERENCES corpus_structattr(corpus_name, structure_name, name);
ALTER TABLE corpora ADD CONSTRAINT corpora_bib_id_structattr_fkey FOREIGN KEY (name, bib_id_struct, bib_id_attr) REFERENCES  corpus_structattr(corpus_name, structure_name, name);
ALTER TABLE corpora ADD CONSTRAINT corpora_ttdesc_id_fkey FOREIGN KEY (ttdesc_id) REFERENCES kontext_ttdesc(id);



/* THIS PROCEDURE IS A MOCK REPLACEMENT TO SIMULATE PRODUCTION ENVIRONMENT */
DROP PROCEDURE IF EXISTS user_corpus_proc;
DELIMITER $$
CREATE PROCEDURE user_corpus_proc (user_id int)
BEGIN
SELECT user_id, kc.name, NULL AS variant, kc.name
FROM corpora AS kc;
END $$
DELIMITER ;


DROP TABLE IF EXISTS kontext_corpus_taghelper;
CREATE TABLE kontext_corpus_taghelper (
    corpus_name varchar(63) NOT NULL,
    pos_attr varchar(63),
    feat_attr varchar(63) NOT NULL,
    tagset_type ENUM('positional', 'keyval', 'other') NOT NULL,
    tagset_name varchar(63),
    PRIMARY KEY (corpus_name, feat_attr)
);
ALTER TABLE `kontext_corpus_taghelper` COLLATE 'utf8_general_ci';
ALTER TABLE kontext_corpus_taghelper ADD CONSTRAINT kontext_corpus_taghelper_pos_attr_id_fkey FOREIGN KEY (corpus_name, pos_attr) REFERENCES corpus_posattr(corpus_name, name);
ALTER TABLE kontext_corpus_taghelper ADD CONSTRAINT kontext_corpus_taghelper_feat_attr_id_fkey FOREIGN KEY (corpus_name, feat_attr) REFERENCES corpus_posattr(corpus_name, name);
