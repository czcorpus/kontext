/*
 * Following database tables are part of UCNK's custom data model and related plugins.
 */

CREATE TABLE noske_session (
    id varchar(127) NOT NULL,
    updated integer NOT NULL,
    data text,
primary key(id)) ENGINE=InnoDB;


CREATE TABLE noske_saved_queries (
    id VARCHAR(255) NOT NULL,
    user VARCHAR(255) NOT NULL,
    corpname VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    public INTEGER NOT NULL DEFAULT 0,
    created INTEGER NOT NULL,
    updated INTEGER,
    deleted INTEGER, 
    tmp INTEGER NOT NULL default 1,
    PRIMARY KEY(id),
    FOREIGN KEY(user) REFERENCES user(user)
) ENGINE=InnoDB;


CREATE TABLE noske_user_settings (
    user_id INTEGER NOT NULL,
    data TEXT,
    updated INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES user(id)
) ENGINE=InnoDB;