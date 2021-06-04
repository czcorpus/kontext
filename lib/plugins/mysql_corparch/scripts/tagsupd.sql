--
-- Copyright (c) 2021 Tomas Capka <tomas.capka@korpus.cz>
-- Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
--

--
-- Update old names of tagsets and copy data to new tagset-related tables.
-- This should work also for non-CNC installations.
--

UPDATE kontext_corpus_taghelper SET tagset_name = 'cs_cnc2000' WHERE tagset_name = 'pp_tagset';
UPDATE kontext_corpus_taghelper SET tagset_name = 'cs_cnc2020' WHERE tagset_name = 'pp_tagset2';
UPDATE kontext_corpus_taghelper SET tagset_name = 'cs_cnc2000_spk' WHERE tagset_name = 'pp_tagset_spk';


INSERT INTO corpus_tagset (corpus_name, tagset_name, feat_attr, pos_attr, kontext_widget_enabled)
SELECT corpus_name, tagset_name, feat_attr, CASE WHEN pos_attr = '' THEN NULL ELSE pos_attr END, widget_enabled FROM kontext_corpus_taghelper
WHERE (
SELECT COUNT(*) FROM corpus_posattr
WHERE corpus_name = kontext_corpus_taghelper.corpus_name
AND name = kontext_corpus_taghelper.feat_attr
AND (kontext_corpus_taghelper.pos_attr IS NULL OR kontext_corpus_taghelper.pos_attr = '' OR name = kontext_corpus_taghelper.pos_attr)
) > 0 AND tagset_name is NOT NULL;