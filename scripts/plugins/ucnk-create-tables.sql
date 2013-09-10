/*
 * Following database tables are part of UCNK's custom data model and related plugins.
 */

CREATE TABLE noske_session (
    id varchar(127) NOT NULL,
    updated integer NOT NULL,
    data text,
primary key(id)) ENGINE=InnoDB;


CREATE TABLE noske_saved_queries (
  id int(11) NOT NULL AUTO_INCREMENT,
  export_id varchar(255) DEFAULT NULL,
  user_id int NOT NULL,
  corpname varchar(255) NOT NULL,
  url text NOT NULL,
  cql text,
  description text,
  public int(11) NOT NULL DEFAULT '0',
  created int(11) NOT NULL,
  updated int(11) DEFAULT NULL,
  deleted int(11) DEFAULT NULL,
  tmp int(11) NOT NULL DEFAULT '1',
  PRIMARY KEY (id),
  UNIQUE KEY export_id (export_id),
  FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE=InnoDB;


CREATE TABLE noske_user_settings (
    user_id INTEGER NOT NULL,
    data TEXT,
    updated INTEGER NOT NULL,
    UNIQUE KEY(user_id),
    FOREIGN KEY(user_id) REFERENCES user(id)
) ENGINE=InnoDB;