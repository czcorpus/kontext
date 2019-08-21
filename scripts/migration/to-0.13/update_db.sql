ALTER TABLE corpora ADD COLUMN tagset_type VARCHAR(63) AFTER tagset;
ALTER TABLE corpora ADD COLUMN tagset_pos_attr VARCHAR(63) AFTER tagset_type;
ALTER TABLE corpora ADD CONSTRAINT corpus_tagset_pos_attr_id_fkey FOREIGN KEY (name, tagset_pos_attr) REFERENCES corpus_posattr(corpus_name, name);
ALTER TABLE corpora ADD COLUMN tagset_feat_attr VARCHAR(63) AFTER tagset_pos_attr;
ALTER TABLE corpora ADD CONSTRAINT corpus_tagset_tagset_feat_attr_id_fkey FOREIGN KEY (name, tagset_feat_attr) REFERENCES corpus_posattr(corpus_name, name);