CREATE TABLE user (
  id int(11) NOT NULL AUTO_INCREMENT,
  user varchar(255) NOT NULL,
  corplist text,
  sketches text,
  pass varchar(16) DEFAULT NULL,
  firstName varchar(255) DEFAULT NULL,
  surname varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY user (user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE corpora (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(50) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE user_corpus (
  user_id int(11) NOT NULL,
  name varchar(255) NOT NULL,
  user varchar(255) DEFAULT NULL,
  PRIMARY KEY (user_id,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE relation (
  corplist int(11) NOT NULL DEFAULT '0',
  corpora int(11) NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE corplist (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(15) NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;