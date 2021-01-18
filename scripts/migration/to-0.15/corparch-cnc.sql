ALTER TABLE corpora ADD column default_view_opts TEXT;
ALTER TABLE kontext_interval_attr ADD column widget VARCHAR(31) NOT NULL DEFAULT 'years';


ALTER TABLE `kontext_corpus_taghelper`
ADD `widget_enabled` tinyint NOT NULL DEFAULT '0',
ADD `doc_url_local` varchar(255) COLLATE 'utf8_general_ci' NULL AFTER `widget_enabled`,
ADD `doc_url_en` varchar(255) COLLATE 'utf8_general_ci' NULL AFTER `doc_url_local`;

update kontext_corpus_taghelper set widget_enabled = 1;