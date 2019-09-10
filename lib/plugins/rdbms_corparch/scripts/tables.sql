PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS kontext_corpus;
DROP TABLE IF EXISTS kontext_corpus_alignment;
DROP TABLE IF EXISTS kontext_article;
DROP TABLE IF EXISTS kontext_keyword;
DROP TABLE IF EXISTS kontext_corpus_article;
DROP TABLE IF EXISTS kontext_ttdesc;
DROP TABLE IF EXISTS kontext_keyword_corpus;
DROP TABLE IF EXISTS kontext_tckc_corpus;
DROP TABLE IF EXISTS registry_conf;
DROP TABLE IF EXISTS registry_variable;
DROP TABLE IF EXISTS corpus_posattr;
DROP TABLE IF EXISTS corpus_structure;
DROP TABLE IF EXISTS corpus_structattr;
DROP TABLE IF EXISTS registry_conf_user;
DROP VIEW IF EXISTS registry_overview;
DROP TABLE IF EXISTS kontext_corpus_user;

CREATE TABLE kontext_corpus (
    id TEXT NOT NULL,
    size INT NOT NULL DEFAULT 0,
    group_name TEXT NOT NULL,
    version int NOT NULL DEFAULT 1,
    created int NOT NULL,
    updated int NOT NULL,
    active int NOT NULL,
    web TEXT,
    sentence_struct TEXT,
    tagset TEXT,
    collator_locale TEXT,
    speech_segment_struct TEXT,
    speech_segment_attr TEXT,
    speaker_id_struct TEXT,
    speaker_id_attr TEXT,
    speech_overlap_struct TEXT,
    speech_overlap_attr TEXT,
    speech_overlap_val TEXT,
    use_safe_font int,
    requestable int DEFAULT 0,
    text_types_db TEXT,
    bib_label_struct TEXT,
    bib_label_attr TEXT,
    bib_id_struct TEXT,
    bib_id_attr TEXT,
    bib_group_duplicates INTEGER DEFAULT 0,
    featured INTEGER DEFAULT 0,
    ttdesc_id INTEGER,
    description_cs TEXT,
    description_en TEXT,
    CONSTRAINT kontext_corpus_pkey PRIMARY KEY (id),
    CONSTRAINT kontext_corpus_sentence_struct_fkey FOREIGN KEY (id, sentence_struct) REFERENCES corpus_structure(corpus_id, name),
    CONSTRAINT kontext_corpus_speech_segment_structattr_fkey FOREIGN KEY (id, speech_segment_struct, speech_segment_attr) REFERENCES corpus_structattr(corpus_id, structure_name, name),
    CONSTRAINT kontext_corpus_speaker_id_attr_fkey FOREIGN KEY (id, speaker_id_struct, speaker_id_attr) REFERENCES corpus_structattr(corpus_id, structure_name, name),
    CONSTRAINT kontext_corpus_speech_overlap_attr_fkey FOREIGN KEY (id, speech_overlap_struct, speech_overlap_attr) REFERENCES corpus_structattr(corpus_id, structure_name, name),
    CONSTRAINT kontext_corpus_bib_label_structattr_fkey FOREIGN KEY (id, bib_label_struct, bib_label_attr) REFERENCES corpus_structattr(corpus_id, structure_name, name),
    CONSTRAINT kontext_corpus_bib_id_structattr_fkey FOREIGN KEY (id, bib_id_struct, bib_id_attr) REFERENCES  corpus_structattr(corpus_id, structure_name, name),
    CONSTRAINT kontext_corpus_ttdesc_id_fkey FOREIGN KEY (ttdesc_id) REFERENCES kontext_ttdesc(id)
);

/* ------------------------------- CORPUS ALIGNMENT * ---------------- */

CREATE TABLE kontext_corpus_alignment (
    corpus_id_1 INTEGER NOT NULL,
    corpus_id_2 INTEGER NOT NULL,
    CONSTRAINT kontext_corpus_alignment_pkey PRIMARY KEY (corpus_id_1, corpus_id_2),
    CONSTRAINT kontext_corpus_alignment_corpus_id_1_fkey FOREIGN KEY (corpus_id_1) REFERENCES kontext_corpus(id),
    CONSTRAINT kontext_corpus_alignment_corpus_id_2_fkey FOREIGN KEY (corpus_id_2) REFERENCES kontext_corpus(id)
);

/* ------------------------------- ARTICLE ------------------------ */

CREATE TABLE kontext_article (
    id INTEGER PRIMARY KEY NOT NULL,
    entry TEXT NOT NULL
);

/* ------------------------------- TEXTY TYPES DESCRIPTION ------------------------ */

CREATE TABLE kontext_ttdesc (
    id int NOT NULL,
    text_cs TEXT,
    text_en TEXT,
    CONSTRAINT kontext_ttdesc_pkey PRIMARY KEY (id)
);

/* ------------------------------- CORPUS ARTICLE M:N ------------------------ */

CREATE TABLE kontext_corpus_article (
	article_id INTEGER NOT NULL,
	corpus_id TEXT NOT NULL,
	role TEXT NOT NULL,
	CONSTRAINT kontext_corpus_article_article_id_fkey FOREIGN KEY (article_id) REFERENCES kontext_article(id),
	CONSTRAINT kontext_corpus_article_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
	CHECK (role IN ('default', 'standard', 'other'))
);

/* ------------------------------- SEARCH KEYWORDS ('tags') ------------------- */

CREATE TABLE kontext_keyword (
	id TEXT NOT NULL,
	label_cs TEXT NOT NULL,
	label_en TEXT NOT NULL,
	color TEXT,
	display_order INT NOT NULL DEFAULT 0,
	CONSTRAINT kontext_keyword_pkey PRIMARY KEY (id)
);

CREATE TABLE kontext_keyword_corpus (
	corpus_id TEXT NOT NULL,
	keyword_id TEXT NOT NULL,
	CONSTRAINT kontext_keyword_corpus_pkey PRIMARY KEY (corpus_id, keyword_id),
	CONSTRAINT kontext_keyword_corpus_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
	CONSTRAINT kontext_keyword_corpus_keyword_id_fkey FOREIGN KEY (keyword_id) REFERENCES kontext_keyword(id)
);

/* ------------------------------- TOKEN/KWIC CONNECT PROVIDERS FOR CORPORA ------ */

CREATE TABLE kontext_tckc_corpus (
	corpus_id TEXT NOT NULL,
	provider TEXT NOT NULL,
	type TEXT,
	display_order INT NOT NULL DEFAULT 0,
	CONSTRAINT kontext_tckc_corpus_pkey PRIMARY KEY (corpus_id, provider, type),
	CONSTRAINT kontext_tckc_corpus_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id)
);

/* -------------------------------- MAIN REGISTRY CONF. FILE ------- */

CREATE TABLE registry_conf (
    corpus_id TEXT NOT NULL,
    name TEXT,
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    path TEXT NOT NULL,
    vertical TEXT,
    language TEXT,
    locale TEXT,
    rencoding TEXT NOT NULL,
    docstructure TEXT,
    info TEXT,
    shortref TEXT,
    freqttattrs TEXT,
    tagsetdoc TEXT,
    wposlist TEXT,
    wsdef TEXT,
    wsattr TEXT,
    wsbase TEXT,
    wsthes TEXT,
    alignstruct TEXT,
    aligndef TEXT,
    CONSTRAINT registry_conf_pkey PRIMARY KEY (corpus_id),
    CONSTRAINT registry_conf_corpus_name_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
    CONSTRAINT registry_conf_docstructure_fkey FOREIGN KEY (corpus_id, docstructure) REFERENCES corpus_structure(corpus_id, name),
    CONSTRAINT registry_conf_wsattr_id_fkey FOREIGN KEY (corpus_id, wsattr) REFERENCES corpus_posattr(corpus_id, name)
);

/* --------------------- VARIABLE (CUSTOMIZABLE) PART OF THE MAIN REGISTRY FILE ------------ */

CREATE TABLE registry_variable (
    id INTEGER NOT NULL,
    corpus_id TEXT NOT NULL,
    variant TEXT,
    maxcontext INTEGER,
    maxdetail INTEGER,
    maxkwic INTEGER,
    CONSTRAINT registry_varible_pkey PRIMARY KEY (id),
    CONSTRAINT registry_varible_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
    CONSTRAINT registry_variable_corp_variant_uniq UNIQUE (corpus_id, variant)
);


CREATE TABLE corpus_posattr (
    corpus_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INT NOT NULL,
    type TEXT,
    label TEXT,
    dynamic TEXT,
    dynlib TEXT,
    arg1 TEXT,
    arg2 TEXT,
    fromattr TEXT,
    funtype TEXT,
    dyntype TEXT, /* TODO former 'type' ? */
    transquery TEXT,
    mapto TEXT,
    multivalue TEXT,
    multisep TEXT,
    CONSTRAINT corpus_posattr_pkey PRIMARY KEY (corpus_id, name),
    CONSTRAINT corpus_posattr_corpus_name_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
    CONSTRAINT corpus_posattr_fromattr_fkey FOREIGN KEY (corpus_id, fromattr) REFERENCES corpus_posattr(corpus_id, name),
    CONSTRAINT corpus_posattr_mapto_fkey FOREIGN KEY (corpus_id, mapto) REFERENCES corpus_posattr(corpus_id, name)
    CONSTRAINT corpus_posattr_type_chk CHECK (type IN ('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE'))
    CONSTRAINT corpus_posattr_funtype_chk CHECK (funtype IS NULL OR funtype IN ('0', 'c', 's', 'i', 'cc', 'ii', 'ss', 'ci', 'cs', 'sc', 'si', 'ic', 'is')),
    CONSTRAINT corpus_posattr_dyntype_chk CHECK (dyntype IS NULL OR dyntype IN ('plain', 'lexicon', 'index', 'freq')),
    CONSTRAINT corpus_posattr_transquery_chk CHECK (transquery is NULL OR transquery IN ('yes', 'no', 'y', 'n')),
    CONSTRAINT corpus_posattr_multivalue_chk CHECK (multivalue is NULL OR multivalue IN ('yes', 'no', 'y', 'n'))
);

CREATE TABLE corpus_structure (
    corpus_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    displaytag INT,
    displaybegin TEXT,
    CONSTRAINT corpus_structure_pkey PRIMARY KEY (corpus_id, name),
    CONSTRAINT corpus_structure_corpus_name_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id)
    CONSTRAINT corpus_structure_type_chk CHECK (type IS NULL OR type IN ('file32', 'map32', 'file64', 'map64')),
    CONSTRAINT corpus_structure_displaytag_chk CHECK (displaytag IS NULL OR displaytag IN ('0', '1'))
);

CREATE TABLE corpus_structattr (
    corpus_id TEXT NOT NULL,
    structure_name TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    locale TEXT,
    multivalue TEXT,
    multisep TEXT,
    maxlistsize INTEGER,
    defaultvalue TEXT,
    attrdoc TEXT,
    attrdoclabel TEXT,
    rnumeric TEXT,
    subcorpattrs_idx INTEGER DEFAULT -1,
    freqttattrs_idx INTEGER DEFAULT -1,
    CONSTRAINT corpus_structattr_pkey PRIMARY KEY (corpus_id, structure_name, name),
    CONSTRAINT corpus_structattr_corpus_name_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
    CONSTRAINT corpus_structattr_structure_name_fkey FOREIGN KEY (corpus_id, structure_name) REFERENCES corpus_structure(corpus_id, name),
    CONSTRAINT corpus_structattr_type_chk CHECK (type IS NULL OR type IN ('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE')),
    CONSTRAINT corpus_structattr_multivalue_chk CHECK (multivalue is NULL OR multivalue IN ('yes', 'no', 'y', 'n')),
    CONSTRAINT corpus_structattr_rnumeric_chk CHECK (rnumeric is NULL OR rnumeric IN ('yes', 'no', 'y', 'n'))
);

CREATE TABLE kontext_corpus_user (
    user_id INTEGER NOT NULL,
    corpus_id TEXT NOT NULL,
    variant TEXT,
    CONSTRAINT kontext_corpus_user_pkey PRIMARY KEY (user_id, corpus_id),
    CONSTRAINT kontext_corpus_user_corpus_name_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id)
);


CREATE TABLE kontext_corpus_taghelper (
    corpus_name TEXT NOT NULL,
    pos_attr TEXT,
    feat_attr TEXT NOT NULL,
    tagset_type TEXT NOT NULL,
    tagset_name TEXT,
    PRIMARY KEY (corpus_name, feat_attr),
    CONSTRAINT corpus_structattr_type_chk CHECK (tagset_type IN ('positional', 'keyval', 'other')),
    CONSTRAINT kontext_corpus_taghelper_pos_attr_id_fkey FOREIGN KEY (corpus_name, pos_attr) REFERENCES corpus_posattr(corpus_name, name),
    CONSTRAINT kontext_corpus_taghelper_feat_attr_id_fkey FOREIGN KEY (corpus_name, feat_attr) REFERENCES corpus_posattr(corpus_name, name)
);

