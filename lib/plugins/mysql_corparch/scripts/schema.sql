--
-- This script provides a basic set of tables required to run mysql_corparch
-- In case you have no custom auth solution, please also review mysql_auth plug-in
--

SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS kontext_corpus;
DROP TABLE IF EXISTS kontext_article;
DROP TABLE IF EXISTS kontext_ttdesc;
DROP TABLE IF EXISTS kontext_corpus_article;
DROP TABLE IF EXISTS kontext_keyword;
DROP TABLE IF EXISTS kontext_keyword_corpus;
DROP TABLE IF EXISTS kontext_tckc_corpus;
DROP TABLE IF EXISTS kontext_simple_query_default_attrs;
DROP TABLE IF EXISTS corpus_posattr;
DROP TABLE IF EXISTS corpus_structure;
DROP TABLE IF EXISTS corpus_structattr;
DROP TABLE IF EXISTS tagset;
DROP TABLE IF EXISTS corpus_tagset;
DROP TABLE IF EXISTS kontext_interval_attr;
DROP TABLE IF EXISTS kontext_conc_persistence;

-- ------------------------------- CORPUS ------------------------

CREATE TABLE kontext_corpus (
  id int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
  name varchar(63),
  size bigint(20) NOT NULL DEFAULT '0',
  group_name varchar(255) NOT NULL,
  version int(11) NOT NULL DEFAULT '1',
  created varchar(25),
  updated varchar(25),
  active int(11) NOT NULL,
  web varchar(255),
  sentence_struct varchar(63),
  default_tagset varchar(63),
  collator_locale varchar(255),
  speech_segment_struct varchar(63),
  speech_segment_attr varchar(63),
  speaker_id_struct varchar(63),
  speaker_id_attr varchar(63),
  speech_overlap_struct varchar(63),
  speech_overlap_attr varchar(63),
  speech_overlap_val varchar(255),
  use_safe_font int(11),
  requestable int(11) DEFAULT '0',
  text_types_db varchar(255),
  bib_label_struct varchar(63),
  bib_label_attr varchar(63),
  bib_id_struct varchar(63),
  bib_id_attr varchar(63),
  bib_group_duplicates int(11) DEFAULT '0',
  featured int(11) DEFAULT '0',
  ttdesc_id int(11),
  description_cs text,
  description_en text,
  default_virt_keyboard varchar(255),
  default_view_opts text,
  syntax_viewer_conf_json text,
  UNIQUE KEY corpora_name_uniq (name),
  KEY corpora_requestable_idx (requestable),
  CONSTRAINT corpora_bib_id_structattr_fkey FOREIGN KEY (name, bib_id_struct, bib_id_attr) REFERENCES corpus_structattr (corpus_name, structure_name, name),
  CONSTRAINT corpora_bib_label_structattr_fkey FOREIGN KEY (name, bib_label_struct, bib_label_attr) REFERENCES corpus_structattr (corpus_name, structure_name, name),
  CONSTRAINT corpora_sentence_struct_fkey FOREIGN KEY (name, sentence_struct) REFERENCES corpus_structure (corpus_name, name),
  CONSTRAINT corpora_speaker_id_attr_fkey FOREIGN KEY (name, speaker_id_struct, speaker_id_attr) REFERENCES corpus_structattr (corpus_name, structure_name, name),
  CONSTRAINT corpora_speech_overlap_attr_fkey FOREIGN KEY (name, speech_overlap_struct, speech_overlap_attr) REFERENCES corpus_structattr (corpus_name, structure_name, name),
  CONSTRAINT corpora_speech_segment_structattr_fkey FOREIGN KEY (name, speech_segment_struct, speech_segment_attr) REFERENCES corpus_structattr (corpus_name, structure_name, name),
  CONSTRAINT corpora_ttdesc_id_fkey FOREIGN KEY (ttdesc_id) REFERENCES kontext_ttdesc (id),
  CONSTRAINT corpora_default_tagset_fkey FOREIGN KEY (default_tagset) REFERENCES tagset (name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;


-- ------------------------------- ARTICLE ------------------------

CREATE TABLE kontext_article (
    id INTEGER PRIMARY KEY NOT NULL,
    entry TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------- TEXTY TYPES DESCRIPTION -------------------

CREATE TABLE kontext_ttdesc (
  id int(11) NOT NULL AUTO_INCREMENT,
  text_cs text,
  text_en text,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;


-- ----------------------------- CORPUS ARTICLE M:N ------------------------

CREATE TABLE kontext_corpus_article (
  article_id int(11) NOT NULL,
  corpus_name varchar(63) NOT NULL,
  role enum('default', 'standard', 'other') NOT NULL,
  PRIMARY KEY (article_id, corpus_name),
  CONSTRAINT kontext_corpus_article_article_id_fkey FOREIGN KEY (article_id) REFERENCES kontext_article (id),
  CONSTRAINT kontext_corpus_article_corpus_name_fkey FOREIGN KEY (corpus_name) references kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------- SEARCH KEYWORDS ('tags') -------------------

CREATE TABLE kontext_keyword (
  id varchar(63) NOT NULL,
  label_cs varchar(255) NOT NULL,
  label_en varchar(255) NOT NULL,
  color varchar(31),
  display_order int(11) DEFAULT '0',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------- KEYWORD - CORPUS (M:N) -------------------

CREATE TABLE kontext_keyword_corpus (
  corpus_name varchar(63) NOT NULL,
  keyword_id varchar(63) NOT NULL,
  PRIMARY KEY (corpus_name,keyword_id),
  KEY kontext_keyword_corpus_keyword_id_fkey (keyword_id),
  CONSTRAINT kontext_keyword_corpus_corpus_name_fkey FOREIGN KEY (corpus_name) references kontext_corpus(name),
  CONSTRAINT kontext_keyword_corpus_keyword_id_fkey FOREIGN KEY (keyword_id) REFERENCES kontext_keyword (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- --------------------------- TOKEN/KWIC CONNECT PROVIDERS FOR CORPORA ------

CREATE TABLE kontext_tckc_corpus (
    corpus_name varchar(63) NOT NULL,
    provider varchar(127) NOT NULL,
    type varchar(63) NOT NULL DEFAULT '',
    display_order int(11) NOT NULL DEFAULT '0',
    is_kwic_view int(11) NOT NULL DEFAULT '0',
    PRIMARY KEY (corpus_name, provider, type),
    CONSTRAINT kontext_tckc_corpus_corpus_name_fkey FOREIGN KEY (corpus_name) references kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ------------------------- default attributes for single conc. query ---------------------

CREATE TABLE kontext_simple_query_default_attrs (
  corpus_name varchar(63) NOT NULL,
  pos_attr varchar(63) NOT NULL,
  PRIMARY KEY (corpus_name, pos_attr),
  CONSTRAINT kontext_simple_query_attr_seq_corpus_fkey FOREIGN KEY (corpus_name, pos_attr) REFERENCES corpus_posattr (corpus_name, name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- --------------- positional attribute ---------------------

CREATE TABLE corpus_posattr (
  corpus_name varchar(63) NOT NULL,
  name varchar(63) NOT NULL,
  position int(11) NOT NULL,
  type enum('index','MD_MD','FD_MD','FD_FD','FFD_FD','FD_FBD','FD_FGD','MD_MGD','NoMem','MD_MI','FD_MI','UNIQUE'),
  label varchar(255),
  dynamic varchar(255),
  dynlib varchar(255),
  arg1 varchar(255),
  arg2 varchar(255),
  fromattr varchar(63),
  funtype enum('0','c','s','i','cc','ii','ss','ci','cs','sc','si','ic','is'),
  dyntype enum('plain','lexicon','index','freq'),
  transquery enum('yes','no','y','n'),
  mapto varchar(63),
  multivalue enum('yes','no','y','n'),
  multisep varchar(31),
  PRIMARY KEY (corpus_name, name),
  CONSTRAINT corpus_posattr_corpus_name_fkey FOREIGN KEY (corpus_name) references kontext_corpus(name),
  CONSTRAINT corpus_posattr_fromattr_fkey FOREIGN KEY (corpus_name, fromattr) REFERENCES corpus_posattr (corpus_name, name),
  CONSTRAINT corpus_posattr_mapto_fkey FOREIGN KEY (corpus_name, mapto) REFERENCES corpus_posattr (corpus_name, name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- --------------- structure  ---------------------

CREATE TABLE corpus_structure (
  corpus_name varchar(63) NOT NULL,
  name varchar(63) NOT NULL,
  type enum('file32','map32','file64','map64'),
  position INT NOT NULL DEFAULT 0,
  displaytag enum('0','1'),
  displaybegin varchar(255),
  displayend varchar(255),
  PRIMARY KEY (corpus_name, name),
  CONSTRAINT corpus_structure_corpus_name_fkey FOREIGN KEY (corpus_name) references kontext_corpus(name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- --------------- structural attribute  ---------------------

CREATE TABLE corpus_structattr (
  corpus_name varchar(63) NOT NULL,
  structure_name varchar(63) NOT NULL,
  name varchar(63) NOT NULL,
  type enum('index','MD_MD','FD_MD','FD_FD','FFD_FD','FD_FBD','FD_FGD','MD_MGD','NoMem','MD_MI','FD_MI','UNIQUE'),
  position INT NOT NULL DEFAULT 0,
  locale varchar(31),
  multivalue enum('yes','no','y','n'),
  multisep varchar(31),
  maxlistsize int(11),
  defaultvalue varchar(255),
  attrdoc varchar(255),
  attrdoclabel varchar(255),
  rnumeric enum('yes','no','y','n'),
  subcorpattrs_idx int(11) DEFAULT '-1',
  freqttattrs_idx int(11) DEFAULT '-1',
  dt_format VARCHAR(40), -- if not NULL then we assume the structural attribute encodes a date-time information
  PRIMARY KEY (corpus_name,structure_name,name),
  CONSTRAINT corpus_structattr_corpus_name_fkey FOREIGN KEY (corpus_name) references kontext_corpus(name),
  CONSTRAINT corpus_structattr_structure_name_fkey FOREIGN KEY (corpus_name, structure_name) REFERENCES corpus_structure (corpus_name, name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- --------------- tagset info (incl. props for tag builder)  ---------------------

CREATE TABLE tagset (
  name varchar(63) NOT NULL,
  full_name text NOT NULL,
  tagset_type enum('positional', 'keyval', 'other') NOT NULL,
  doc_url_local varchar(255) DEFAULT NULL,
  doc_url_en varchar(255) DEFAULT NULL,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;


INSERT INTO tagset (name, full_name, tagset_type, doc_url_local, doc_url_en) VALUES
('cs_cnc2000',	'Prague positional tagset',	'positional', NULL, NULL),
('cs_cnc2000_spk',	'Prague positional tagset - spoken corpus variant',	'positional', NULL, NULL),
('cs_cnc2020',	'Prague positional tagset, version 2020', 'positional',	NULL, NULL);

CREATE TABLE corpus_tagset (
  corpus_name varchar(63) DEFAULT NULL,
  tagset_name varchar(63) DEFAULT NULL,
  pos_attr varchar(63) DEFAULT NULL,
  feat_attr varchar(63) NOT NULL,
  kontext_widget_enabled tinyint(4) NOT NULL DEFAULT 0,
  KEY corpus_tagset_ibfk_1 (corpus_name,feat_attr),
  KEY corpus_tagset_ibfk_2 (corpus_name,pos_attr),
  KEY corpus_tagset_ibfk_3 (tagset_name),
  PRIMARY KEY(corpus_name, tagset_name),
  CONSTRAINT corpus_tagset_ibfk_1 FOREIGN KEY (corpus_name, feat_attr) REFERENCES corpus_posattr (corpus_name, name) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT corpus_tagset_ibfk_2 FOREIGN KEY (corpus_name, pos_attr) REFERENCES corpus_posattr (corpus_name, name) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT corpus_tagset_ibfk_3 FOREIGN KEY (tagset_name) REFERENCES tagset (name) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT corpus_tagset_ibfk_4 FOREIGN KEY (corpus_name) REFERENCES kontext_corpus (name) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE tagset_pos_category (
  tagset_name varchar(63) NOT NULL,
  position int(11) NOT NULL,
  pos varchar(64) NOT NULL,
  tag_search_pattern varchar(32) NOT NULL,
  PRIMARY KEY (tagset_name, pos),
  CONSTRAINT tagset_pos_category_fk_tagset_name FOREIGN KEY (tagset_name) REFERENCES tagset (name) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT INTO tagset_pos_category (tagset_name, position, pos, tag_search_pattern) VALUES
('cs_cnc2000', 2, 'adjective', 'A.*'),
('cs_cnc2000', 6, 'adverb', 'D.*'),
('cs_cnc2000', 8, 'conjunction', 'J.*'),
('cs_cnc2000', 10, 'interjection', 'I.*'),
('cs_cnc2000', 1, 'noun', 'N.*'),
('cs_cnc2000', 4, 'numeral', 'C.*'),
('cs_cnc2000', 9, 'particle', 'T.*'),
('cs_cnc2000', 7, 'preposition', 'R.*'),
('cs_cnc2000', 3, 'pronoun', 'P.*'),
('cs_cnc2000', 11, 'punctuation', 'Z.*'),
('cs_cnc2000', 12, 'unknown', 'X.*'),
('cs_cnc2000', 5, 'verb', 'V.*'),
('cs_cnc2020', 2, 'adjective', 'A.*'),
('cs_cnc2020', 6, 'adverb', 'D.*'),
('cs_cnc2020', 8, 'conjunction', 'J.*'),
('cs_cnc2020', 10, 'interjection', 'I.*'),
('cs_cnc2020', 1, 'noun', 'N.*'),
('cs_cnc2020', 4, 'numeral', 'C.*'),
('cs_cnc2020', 9, 'particle', 'T.*'),
('cs_cnc2020', 7, 'preposition', 'R.*'),
('cs_cnc2020', 3, 'pronoun', 'P.*'),
('cs_cnc2020', 11, 'punctuation', 'Z.*'),
('cs_cnc2020', 12, 'unknown', 'X.*'),
('cs_cnc2020', 5, 'verb', 'V.*');

-- --------------- interval attributes for text type selection -------------

CREATE TABLE kontext_interval_attr (
  corpus_name varchar(63) NOT NULL,
  interval_struct varchar(63) NOT NULL,
  interval_attr varchar(63) NOT NULL,
  widget varchar(31) NOT NULL DEFAULT 'years',
  PRIMARY KEY (corpus_name,interval_attr, interval_struct),
  CONSTRAINT kontext_interval_attr_interval_attr_fkey FOREIGN KEY (corpus_name, interval_struct, interval_attr) REFERENCES corpus_structattr (corpus_name, structure_name, name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- --------------- concordance param archiving -------------

CREATE TABLE kontext_conc_persistence (
  id varchar(191) NOT NULL,
  data text NOT NULL,
  created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  num_access int(11) NOT NULL DEFAULT '0',
  last_access timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (id,created)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ---------------------- registry file model ------------------------

CREATE TABLE registry_conf (
  corpus_name varchar(63) NOT NULL,
  name varchar(255) DEFAULT NULL,
  created varchar(25) DEFAULT NULL,
  updated varchar(25) DEFAULT NULL,
  path varchar(255) DEFAULT NULL,
  vertical varchar(255) DEFAULT NULL,
  language varchar(255) DEFAULT NULL,
  locale varchar(255) DEFAULT NULL,
  rencoding varchar(255) NOT NULL,
  info text,
  shortref varchar(255) DEFAULT NULL,
  subcorpattrs text,
  freqttattrs text,
  tagsetdoc varchar(255) DEFAULT NULL,
  wposlist text,
  docstructure varchar(63) DEFAULT NULL,
  wsdef text,
  wsattr varchar(63) DEFAULT NULL,
  wsbase text,
  wsthes text,
  alignstruct text,
  aligndef text,
  use_sketches tinyint(4) DEFAULT '0',
  subdir varchar(255) DEFAULT NULL,
  PRIMARY KEY (corpus_name),
  KEY registry_conf_docstructure_fkey (corpus_name,docstructure),
  KEY registry_conf_wsattr_id_fkey (corpus_name,wsattr),
  KEY registry_conf_info_idx (info(255)),
  CONSTRAINT registry_conf_docstructure_fkey FOREIGN KEY (corpus_name, docstructure) REFERENCES corpus_structure (corpus_name, name) ON UPDATE CASCADE,
  CONSTRAINT registry_conf_ibfk_1 FOREIGN KEY (corpus_name) REFERENCES kontext_corpus (name) ON UPDATE CASCADE,
  CONSTRAINT registry_conf_wsattr_id_fkey FOREIGN KEY (corpus_name, wsattr) REFERENCES corpus_posattr (corpus_name, name)
) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_general_ci';

-- -------------------- susanne corpus

INSERT INTO kontext_corpus (id, name, size, group_name, version, created, active, collator_locale)
VALUES (1, 'susanne', 150426, 'susanne', 1, '2018-06-21T10:36:58+0200', 1, 'en_US');
INSERT INTO corpus_structure (corpus_name, name) VALUES ('susanne', 'p');
INSERT INTO corpus_structure (corpus_name, name) VALUES ('susanne', 'doc');
INSERT INTO corpus_structattr (corpus_name, structure_name, name) VALUES ('susanne', 'doc', 'file');
INSERT INTO corpus_structattr (corpus_name, structure_name, name) VALUES ('susanne', 'doc', 'n');
UPDATE kontext_corpus SET sentence_struct = 'p' WHERE name = 'susanne';