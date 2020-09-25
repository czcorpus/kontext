ALTER TABLE corpora ADD column default_view_opts TEXT;
ALTER TABLE kontext_interval_attr ADD column widget VARCHAR(31) NOT NULL DEFAULT 'years';