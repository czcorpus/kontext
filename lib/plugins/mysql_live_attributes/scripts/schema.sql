CREATE TABLE corpus_parallel_item (
  id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item varchar(255) NOT NULL,
  CONSTRAINT unique_item UNIQUE (item)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE corpus_structattr_value_tuple (
  id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  corpus_name varchar(63) NOT NULL,
  poscount int NOT NULL,
  wordcount int NOT NULL,
  item_id int,
  CONSTRAINT corpus_structatrr_value_tuple_corpus_name_fk FOREIGN KEY (corpus_name) REFERENCES kontext_corpus(name),
  CONSTRAINT corpus_structatrr_value_tuple_item_id_fk FOREIGN KEY (corpus_name) REFERENCES corpus_parallel_item(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE corpus_structattr_value (
  id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  corpus_name varchar(63) NOT NULL,
  structure_name varchar(63) NOT NULL,
  structattr_name varchar(63) NOT NULL,
  value varchar(255),
  CONSTRAINT unique_value UNIQUE (corpus_name, structure_name, structattr_name, value),
  CONSTRAINT corpus_structatrr_value_structattr_fk FOREIGN KEY (corpus_name, structure_name, structattr_name) REFERENCES corpus_structattr(corpus_name, structure_name, name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE corpus_structattr_value_mapping (
  value_tuple_id int NOT NULL,
  value_id int NOT NULL,
  PRIMARY KEY (value_tuple_id, value_id),
  CONSTRAINT corpus_structattr_mapping_value_tuple_id_fk FOREIGN KEY (value_tuple_id) REFERENCES corpus_structattr_value_tuple(id),
  CONSTRAINT corpus_structattr_mapping_value_id_fk FOREIGN KEY (value_id) REFERENCES corpus_structattr_value(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
