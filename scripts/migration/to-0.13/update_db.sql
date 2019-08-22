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

-- INSERT INTO kontext_corpus_taghelper (corpus_name, feat_attr, tagset_name, tagset_type)
-- SELECT c.name, 'tag', c.tagset, 'positional' FROM corpora AS c WHERE tagset IS NOT NULL;

ALTER TABLE corpora DROP COLUMN tagset;