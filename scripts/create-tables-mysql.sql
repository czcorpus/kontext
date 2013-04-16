CREATE TABLE user (
  user varchar(25) NOT NULL,
  pass varchar(13) NOT NULL,
  host varchar(30) DEFAULT NULL,
  hardcut int(11) DEFAULT NULL,
  content int(11) DEFAULT NULL,
  corplist text,
  subcorp varchar(7) DEFAULT NULL,
  fullname varchar(50) DEFAULT NULL,
  email varchar(50) DEFAULT NULL,
  regist date DEFAULT NULL,
  expire date DEFAULT NULL,
  valid int(11) DEFAULT NULL,
  sketches tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (user)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE corpora (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(50) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE relation (
  corplist int(11) NOT NULL DEFAULT '0',
  corpora int(11) NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE corplist (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(15) NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;