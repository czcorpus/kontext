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
    PRIMARY KEY(id),
    FOREIGN KEY (sentence_struct_id) REFERENCES registry_structure(id)
);

CREATE TABLE kontext_article (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    entry TEXT NOT NULL
);

CREATE TABLE kontext_metadata (
	corpus_id TEXT NOT NULL,
	database TEXT,
	label_attr TEXT,
	id_attr TEXT,
	featured INTEGER DEFAULT 0,
	reference_default INTEGER,
	reference_other INTEGER,
	ttdesc_id INTEGER,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id),
	FOREIGN KEY (reference_default) REFERENCES article(id),
	FOREIGN KEY (reference_other) REFERENCES article(id),
	FOREIGN KEY (ttdesc_id) REFERENCES ttdesc(id),
	CHECK (featured == 0 OR featured == 1)
);

CREATE TABLE kontext_ttdesc (
    id int NOT NULL,
    text_cs TEXT,
    text_en TEXT,
    PRIMARY KEY (id)
);

CREATE TABLE kontext_corpus_article (
	article_id INTEGER NOT NULL,
	corpus_id TEXT NOT NULL,
	role TEXT NOT NULL,
	FOREIGN KEY (article_id) REFERENCES article(id),
	FOREIGN KEY (corpus_id) REFERENCES corpus(id),
	CHECK (role IN ('default', 'standard', 'other'))
);

CREATE TABLE kontext_keyword (
	id TEXT NOT NULL,
	label_cs TEXT NOT NULL,
	label_en TEXT NOT NULL,
	color TEXT,
	PRIMARY KEY (id)
);

CREATE TABLE kontext_keyword_corpus (
	corpus_id TEXT NOT NULL,
	keyword_id TEXT NOT NULL,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id),
	FOREIGN KEY (keyword_id) REFERENCES keyword(id)
);

CREATE TABLE kontext_tckc_corpus (
	corpus_id TEXT NOT NULL,
	provider TEXT,
	type TEXT,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id)
);

/* --------------------------------------- */

CREATE TABLE registry_conf (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
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
    FOREIGN KEY (corpus_id) REFERENCES kontext_corpus(id),
    FOREIGN KEY (docstructure_id) REFERENCES registry_structure(id),
    FOREIGN KEY (wsattr_id) REFERENCES registry_attribute(id)
);

CREATE TABLE registry_alignment (
    registry1_id INTEGER NOT NULL,
    registry2_id INTEGER NOT NULL,
    PRIMARY KEY (registry1_id, registry2_id),
    FOREIGN KEY (registry1_id) REFERENCES registry_conf(id),
    FOREIGN KEY (registry2_id) REFERENCES registry_conf(id)
);

CREATE TABLE registry_attribute (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
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
    FOREIGN KEY (registry_id) REFERENCES registry_conf(id),
    FOREIGN KEY (fromattr_id) REFERENCES registry_attribute(id),
    FOREIGN KEY (mapto_id) REFERENCES registry_attribute(id),
    CHECK (type IN ('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE'))
    CHECK (funtype IS NULL OR funtype IN ('0', 'c', 's', 'i', 'cc', 'ii', 'ss', 'ci', 'cs', 'sc', 'si', 'ic', 'is')),
    CHECK (dyntype IS NULL OR dyntype IN ('plain', 'lexicon', 'index', 'freq')),
    CHECK (transquery is NULL OR transquery IN ('yes', 'no', 'y', 'n')),
    CHECK (multivalue is NULL OR multivalue IN ('yes', 'no', 'y', 'n'))
);

CREATE TABLE registry_structure (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    registry_id int NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    displaytag INT,
    displaybegin TEXT,
    FOREIGN KEY (registry_id) REFERENCES registry_conf(id),
    CHECK (type IS NULL OR type IN ('file32', 'map32', 'file64', 'map64')),
    CHECK (displaytag IS NULL OR displaytag IN ('0', '1'))
);

CREATE TABLE registry_structattr (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
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
    FOREIGN KEY (rstructure_id) REFERENCES registry_structure(id),
    CHECK (type IS NULL OR type IN ('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE')),
    CHECK (multivalue is NULL OR multivalue IN ('yes', 'no', 'y', 'n')),
    CHECK (rnumeric is NULL OR rnumeric IN ('yes', 'no', 'y', 'n'))
);







