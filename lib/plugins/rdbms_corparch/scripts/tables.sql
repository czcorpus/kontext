CREATE TABLE kontext_corpus (
	id TEXT NOT NULL,
	size INT NOT NULL DEFAULT 0,
	group_name TEXT NOT NULL,
	version int NOT NULL DEFAULT 1,
	created int NOT NULL,
	updated int NOT NULL,
	active int NOT NULL,
	web TEXT,
	sentence_struct_id INT,
	tagset TEXT,
    collator_locale TEXT,
    speech_segment TEXT,
    speaker_id_attr TEXT,
    speech_overlap_attr TEXT,
    speech_overlap_val TEXT,
    use_safe_font int,
    use_variant int NOT NULL DEFAULT 0,
    CONSTRAINT kontext_corpus_pkey PRIMARY KEY(id),
    FOREIGN KEY (sentence_struct_id) REFERENCES registry_structure(id)
);

CREATE TABLE kontext_article (
    id INTEGER PRIMARY KEY NOT NULL,
    entry TEXT NOT NULL
);

CREATE TABLE kontext_metadata (
	corpus_id TEXT NOT NULL,
	database TEXT,
	label_attr TEXT,
	id_attr TEXT,
	featured INTEGER DEFAULT 0,
	ttdesc_id INTEGER,
	CONSTRAINT kontext_metadata_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
	CONSTRAINT kontext_metadata_ttdesc_id_fkey FOREIGN KEY (ttdesc_id) REFERENCES kontext_ttdesc(id),
	CHECK (featured == 0 OR featured == 1)
);

CREATE TABLE kontext_ttdesc (
    id int NOT NULL,
    text_cs TEXT,
    text_en TEXT,
    CONSTRAINT kontext_ttdesc_pkey PRIMARY KEY (id)
);

CREATE TABLE kontext_corpus_article (
	article_id INTEGER NOT NULL,
	corpus_id TEXT NOT NULL,
	role TEXT NOT NULL,
	CONSTRAINT kontext_corpus_article_article_id_fkey FOREIGN KEY (article_id) REFERENCES kontext_article(id),
	CONSTRAINT kontext_corpus_article_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
	CHECK (role IN ('default', 'standard', 'other'))
);

CREATE TABLE kontext_keyword (
	id TEXT NOT NULL,
	label_cs TEXT NOT NULL,
	label_en TEXT NOT NULL,
	color TEXT,
	CONSTRAINT kontext_keyword_pkey PRIMARY KEY (id)
);

CREATE TABLE kontext_keyword_corpus (
	corpus_id TEXT NOT NULL,
	keyword_id TEXT NOT NULL,
	CONSTRAINT kontext_keyword_corpus_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
	CONSTRAINT kontext_keyword_corpus_keyword_id_fkey FOREIGN KEY (keyword_id) REFERENCES kontext_keyword(id)
);

CREATE TABLE kontext_tckc_corpus (
	corpus_id TEXT NOT NULL,
	provider TEXT,
	type TEXT,
	CONSTRAINT kontext_tckc_corpus_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id)
);

/* --------------------------------------- */

CREATE TABLE registry_conf (
    id INTEGER PRIMARY KEY NOT NULL,
    corpus_id TEXT NOT NULL,
    variant TEXT,
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    name TEXT,
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
    CONSTRAINT registry_conf_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
    CONSTRAINT registry_conf_docstructure_id_fkey FOREIGN KEY (docstructure_id) REFERENCES registry_structure(id),
    CONSTRAINT registry_conf_wsattr_id_fkey FOREIGN KEY (wsattr_id) REFERENCES registry_attribute(id)
);

CREATE TABLE registry_alignment (
    registry1_id INTEGER NOT NULL,
    registry2_id INTEGER NOT NULL,
    CONSTRAINT registry_alignment_registry1_id_fkey FOREIGN KEY (registry1_id) REFERENCES registry_conf(id),
    CONSTRAINT registry_alignment_registry2_id_fkey FOREIGN KEY (registry2_id) REFERENCES registry_conf(id),
    CONSTRAINT registry_alignment_pkey PRIMARY KEY (registry1_id, registry2_id)
);

CREATE TABLE registry_attribute (
    id INTEGER PRIMARY KEY NOT NULL,
    registry_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    position INT NOT NULL,
    type TEXT,
    label TEXT,
    dynamic TEXT,
    dynlib TEXT,
    arg1 TEXT,
    arg2 TEXT,
    fromattr_id INTEGER,
    funtype TEXT,
    dyntype TEXT, /* TODO former 'type' ? */
    transquery TEXT,
    mapto_id INTEGER,
    multivalue TEXT,
    multisep TEXT,
    CONSTRAINT registry_attribute_registry_id_fkey FOREIGN KEY (registry_id) REFERENCES registry_conf(id),
    CONSTRAINT registry_attribute_fromattr_id_fkey FOREIGN KEY (fromattr_id) REFERENCES registry_attribute(id),
    CONSTRAINT registry_attribute_mapto_id_fkey FOREIGN KEY (mapto_id) REFERENCES registry_attribute(id),
    CONSTRAINT registry_attribute_type_chk CHECK (type IN ('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE'))
    CONSTRAINT registry_attribute_funtype_chk CHECK (funtype IS NULL OR funtype IN ('0', 'c', 's', 'i', 'cc', 'ii', 'ss', 'ci', 'cs', 'sc', 'si', 'ic', 'is')),
    CONSTRAINT registry_attribute_dyntype_chk CHECK (dyntype IS NULL OR dyntype IN ('plain', 'lexicon', 'index', 'freq')),
    CONSTRAINT registry_attribute_transquery_chk CHECK (transquery is NULL OR transquery IN ('yes', 'no', 'y', 'n')),
    CONSTRAINT registry_attribute_multivalue_chk CHECK (multivalue is NULL OR multivalue IN ('yes', 'no', 'y', 'n'))
);

CREATE TABLE registry_structure (
    id INTEGER PRIMARY KEY NOT NULL,
    registry_id int NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    displaytag INT,
    displaybegin TEXT,
    CONSTRAINT registry_structure_registry_id_fkey FOREIGN KEY (registry_id) REFERENCES registry_conf(id),
    CONSTRAINT registry_structure_type_chk CHECK (type IS NULL OR type IN ('file32', 'map32', 'file64', 'map64')),
    CONSTRAINT registry_structure_displaytag_chk CHECK (displaytag IS NULL OR displaytag IN ('0', '1'))
);

CREATE TABLE registry_structattr (
    id INTEGER PRIMARY KEY NOT NULL,
    rstructure_id INTEGER NOT NULL,
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
    CONSTRAINT registry_structattr_rstructure_id_fkey FOREIGN KEY (rstructure_id) REFERENCES registry_structure(id),
    CONSTRAINT registry_structattr_type_chk CHECK (type IS NULL OR type IN ('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE')),
    CONSTRAINT registry_structattr_multivalue_chk CHECK (multivalue is NULL OR multivalue IN ('yes', 'no', 'y', 'n')),
    CONSTRAINT registry_structattr_rnumeric_chk CHECK (rnumeric is NULL OR rnumeric IN ('yes', 'no', 'y', 'n'))
);


CREATE TABLE registry_conf_user (
    user_id INTEGER NOT NULL,
    registry_conf_id INTEGER NOT NULL,
    CONSTRAINT registry_conf_user_pkey PRIMARY KEY (user_id, registry_conf_id),
    CONSTRAINT registry_conf_user_registry_conf_id_fkey FOREIGN KEY (registry_conf_id) REFERENCES registry_conf(id)
);


CREATE VIEW  registry_overview AS
SELECT kc.id AS corpus_id, rc.id AS registry_id, rc.variant
FROM kontext_corpus AS kc
JOIN registry_conf AS rc ON kc.id = rc.corpus_id;




