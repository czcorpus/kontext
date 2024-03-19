DROP TABLE IF EXISTS kontext_conc_persistence;

CREATE TABLE kontext_conc_persistence (
    id VARCHAR(191) NOT NULL,
    data JSON NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    num_access INT(11) NOT NULL DEFAULT 0,
    last_access TIMESTAMP,
    PRIMARY KEY (id,created)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
