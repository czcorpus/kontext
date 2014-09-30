/*
 * This script contains tables and triggers needed to
 * synchronize Czech National Corpus database with KonText's
 * data storage. Please note that the synchronization script
 * performs additional checks on tables with mass influence
 * on users (e.g. we add a new public corpus => all the users
 * must be updated). But because this concerns multiple tables
 * it is much easier to detect changes via information schema.
 */

/*
 *  Table for logging user changes
 */
CREATE TABLE user_changelog (
  user_id int(11) NOT NULL,
  created datetime NOT NULL,
  PRIMARY KEY (user_id, created)
);

/*
 * Triggers to detect changes in table "user"
 */

DELIMITER $$
CREATE TRIGGER log_user_update
AFTER UPDATE ON user
FOR EACH ROW BEGIN
INSERT INTO user_changelog (user_id, created) VALUES (NEW.id, NOW())
  ON DUPLICATE KEY UPDATE user_id = user_id;
END $$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER log_user_insert
AFTER INSERT ON user
FOR EACH ROW BEGIN
INSERT INTO user_changelog (user_id, created) VALUES (NEW.id, NOW())
  ON DUPLICATE KEY UPDATE user_id = user_id;
END $$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER log_user_delete
AFTER DELETE ON user
FOR EACH ROW BEGIN
INSERT INTO user_changelog (user_id, created) VALUES (OLD.id, NOW())
  ON DUPLICATE KEY UPDATE user_id = user_id;
END $$
DELIMITER ;

/*
 * Triggers to detect changes in table "user_corpus_relation"
 */

DELIMITER $$
CREATE TRIGGER log_user_corpus_relation_update
AFTER UPDATE ON user_corpus_relation
FOR EACH ROW BEGIN
INSERT INTO user_changelog (user_id, created) VALUES (NEW.user_id, NOW())
  ON DUPLICATE KEY UPDATE user_id = user_id;
END $$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER log_user_corpus_relation_insert
AFTER INSERT ON user_corpus_relation
FOR EACH ROW BEGIN
INSERT INTO user_changelog (user_id, created) VALUES (NEW.user_id, NOW())
  ON DUPLICATE KEY UPDATE user_id = user_id;
END $$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER log_user_corpus_relation_delete
AFTER DELETE ON user_corpus_relation
FOR EACH ROW BEGIN
INSERT INTO user_changelog (user_id, created) VALUES (OLD.user_id, NOW())
  ON DUPLICATE KEY UPDATE user_id = user_id;
END $$
DELIMITER ;



