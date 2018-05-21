CREATE TABLE corpus (
	id TEXT NOT NULL,
	group_name TEXT NOT NULL,
	version int NOT NULL DEFAULT 1,
	created int NOT NULL,
	updated int NOT NULL,
	active int NOT NULL,
	web TEXT,
	sentence_struct TEXT,
	tagset TEXT,
    collator_locale TEXT,
    speech_segment TEXT,
    speaker_id_attr TEXT,
    speech_overlap_attr TEXT,
    speech_overlap_val TEXT,
    use_safe_font int,
    PRIMARY KEY(id)
);

CREATE TABLE metadata (
	corpus_id TEXT NOT NULL,
	database TEXT,
	label_attr TEXT,
	id_attr TEXT,
	featured TEXT,
	reference_default TEXT,
	reference_other TEXT,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id)
);

CREATE TABLE ttdesc (
    id int NOT NULL,
    TEXT_cs TEXT,
    TEXT_en TEXT,
    PRIMARY KEY (id)
);

CREATE TABLE ttdesc_corpus (
    corpus_id TEXT NOT NULL,
    ttdesc_id int NOT NULL,
    FOREIGN KEY (corpus_id) REFERENCES corpus(id)
    FOREIGN KEY (ttdesc_id) REFERENCES ttdesc(id)
);

CREATE TABLE reference_article (
	id int NOT NULL,
	corpus_id TEXT,
	article TEXT,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id)
);

CREATE TABLE keyword (
	id TEXT NOT NULL,
	label_cs TEXT NOT NULL,
	label_en TEXT NOT NULL,
	color TEXT,
	PRIMARY KEY (id)
);

CREATE TABLE keyword_corpus (
	corpus_id TEXT NOT NULL,
	keyword_id TEXT NOT NULL,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id),
	FOREIGN KEY (keyword_id) REFERENCES keyword(id)
);

CREATE TABLE tckc_corpus (
	corpus_id TEXT NOT NULL,
	provider TEXT,
	type TEXT,
	FOREIGN KEY (corpus_id) REFERENCES corpus(id)
);

/* --------------------------------------- */

CREATE TABLE registry (
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
    FOREIGN KEY (corpus_id) REFERENCES corpus(id),
    FOREIGN KEY (docstructure_id) REFERENCES rstructure(id),
    FOREIGN KEY (wsattr_id) REFERENCES wsattr(id)
);

CREATE TABLE ralignment (
    registry1_id INTEGER NOT NULL,
    registry2_id INTEGER NOT NULL,
    PRIMARY KEY (registry1_id, registry2_id),
    FOREIGN KEY (registry1_id) REFERENCES registry(id),
    FOREIGN KEY (registry2_id) REFERENCES registry(id)
);

CREATE TABLE rattribute (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    registry_id INTEGER NOT NULL,
    name TEXT NOT NULL,
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
    FOREIGN KEY (registry_id) REFERENCES registry(id),
    FOREIGN KEY (fromattr_id) REFERENCES rattribute(id),
    FOREIGN KEY (mapto_id) REFERENCES rattribute(id),
    CHECK (type IN ('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE'))
    CHECK (funtype IS NULL OR funtype IN ('0', 'c', 's', 'i', 'cc', 'ii', 'ss', 'ci', 'cs', 'sc', 'si', 'ic', 'is')),
    CHECK (dyntype IS NULL OR dyntype IN ('plain', 'lexicon', 'index', 'freq')),
    CHECK (transquery is NULL OR transquery IN ('yes', 'no', 'y', 'n')),
    CHECK (multivalue is NULL OR multivalue IN ('yes', 'no', 'y', 'n'))
);

CREATE TABLE rstructure (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    registry_id int NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    FOREIGN KEY (registry_id) REFERENCES registry(id),
    CHECK (type IS NULL OR type IN ('file32', 'map32', 'file64', 'map64'))
);

CREATE TABLE rstructattr (
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
    FOREIGN KEY (rstructure_id) REFERENCES rstructure(id),
    CHECK (type IS NULL OR type IN ('index', 'MD_MD', 'FD_MD', 'FD_FD', 'FFD_FD', 'FD_FBD', 'FD_FGD', 'MD_MGD', 'NoMem', 'MD_MI', 'FD_MI', 'UNIQUE')),
    CHECK (multivalue is NULL OR multivalue IN ('yes', 'no', 'y', 'n')),
    CHECK (rnumeric is NULL OR rnumeric IN ('yes', 'no', 'y', 'n'))
);







