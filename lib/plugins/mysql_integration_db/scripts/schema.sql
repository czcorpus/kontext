--
-- This SQL script contains only tables required by the integration plug-in itself. Typically, the
-- database will contain also scripts from mysql_corparch, mysql_auth and possibly also vendor-specific tables
--

--
-- The kontext_integration_env is used by the plug-in's method 'wait_for_environment' to check
-- whether the application environment (typically within a Docker container) is ready after
-- a deployment has been performed.
--
CREATE TABLE kontext_integration_env (
    deployment_date TIMESTAMP PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT INTO kontext_integration_env VALUES (NOW());
