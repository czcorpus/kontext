FROM mariadb:latest

ENV MYSQL_ROOT_PASSWORD="root-secret"
ENV MYSQL_DATABASE="kontext"
ENV MYSQL_USER="kontext"
ENV MYSQL_PASSWORD="kontext-secret"

COPY scripts/install/conf/docker/mariadb-init.sql /tmp/mariadb-init.sql
COPY lib/plugins/mysql_auth/scripts/schema.sql /tmp/schema_auth.sql
COPY lib/plugins/mysql_corparch/scripts/schema.sql /tmp/schema_corparch.sql
COPY lib/plugins/mysql_query_persistence/scripts/schema.sql /tmp/schema_query_persistence.sql
COPY lib/plugins/mysql_user_items/scripts/schema.sql /tmp/user_items.sql
COPY lib/plugins/mysql_integration_db/scripts/schema.sql /tmp/integration_db.sql
COPY lib/plugins/mysql_live_attributes/scripts/schema.sql /tmp/liveattrs.sql
COPY scripts/install/conf/docker/mariadb-cypress.sql /tmp/mariadb-cypress.sql
RUN cat /tmp/mariadb-init.sql /tmp/schema_corparch.sql /tmp/schema_auth.sql /tmp/schema_query_persistence.sql /tmp/user_items.sql /tmp/integration_db.sql /tmp/liveattrs.sql /tmp/mariadb-cypress.sql > /docker-entrypoint-initdb.d/init.sql
RUN rm -f /tmp/*.sql