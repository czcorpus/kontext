# Installation instructions (v 0.11+)

## Contents

* [Install KonText](#install_install_kontext)
* [Configure KonText (config.xml)](#install_configure_kontext)
  * [Plug-ins](#install_configure_kontext_plugins)
* [Building the project](#install_building_the_project)
* [Deployment](#install_deployment)
* [Standalone server application](#install_standalone_server_application)
* [WSGI application within a dedicated web-server](#install_wsgi_application)
  * [Gunicorn + reverse proxy](#install_gunicorn_plus_proxy)
  * [uWSGI](#install_uwsgi)
* [Celery worker](#install_celery_worker)
  * [Celery configuration](#install_celery_configuration)
  * [Systemd configuration](#install_celery_systemd_configuration)
* [Celery Beat](#install_celery_beat)
  * [Systemd configuration](#install_celery_beat_systemd_configuration)
* [Managing users](#managing_users)
* [Managing corpora](#managing_corpora)

<a name="install_install_kontext"></a>
## Install KonText (Ubuntu)

The easiest way to install and test-run KonText is to install it in an **LXC container** using 
the <a href="../scripts/install/install.ubuntu.sh">install.ubuntu.sh</a> script provided in this repository
that performs all the installation and configuration steps that are necessary to run KonText as a standalone 
server application for testing and development purposes. The installation has been
tested in Ubuntu 18.04 LTS Bionic Beaver.

Set up and start an LXC container (Ubuntu variant):

```
sudo apt-get install lxc
sudo lxc-create -t download -n kontext-container -- -d ubuntu -r bionic -a amd64
sudo lxc-start -n kontext-container
```

Note down the container's IP address:

```
sudo lxc-info -n kontext-container -iH
```

Open the container's shell:

```
sudo lxc-attach -n kontext-container
```

(for more details about lxc containers, see <a href="https://linuxcontainers.org/lxc">https://linuxcontainers.org/lxc</a>)

In the container, git-clone the KonText git repo to a directory of your choice (e.g. */opt/kontext*), set the required 
permissions and run the install script.

```
sudo apt-get update
sudo apt-get install -y ca-certificates git
git clone https://github.com/czcorpus/kontext.git /opt/kontext/
cd /opt/kontext/scripts/install
chmod +x install.ubuntu.sh
./install.ubuntu.sh
```
(for CentOS, replace *install.ubuntu.sh* with *install.centos.sh*)


By default, the script installs Manatee and Finlib from the deb packages. If you wish to build from sources and 
use the ucnk-specific manatee patch, you can use the *install.ubuntu.sh --type ucnk* option.

(for more details about Manatee and Finlib installation, see 
<a href="https://nlp.fi.muni.cz/trac/noske/wiki/Downloads">https://nlp.fi.muni.cz/trac/noske/wiki/Downloads</a>)

Once the installation is complete, you can start KonText by entering the following command in the installation 
directory you specified above (*/opt/kontext*):

```
python public/app.py --address 127.0.0.1 --port 8080
```

(this address and port are configured by the installation script for Nginx web server so it will proxy
all the external requests to your *app.py*).

Now open `[container_IP_address]`  in your browser on the host. You should see KonText's first_page and be able to 
enter a query to search in the sample Susanne corpus.


<a name="install_configure_kontext"></a>
## Configure KonText (config.xml)

Before you can compile and build KonText client-side application and run the server-side, 
a proper configuration must be ready (especially the *plugins* section).

KonText is configured via an XML configuration file *conf/config.xml*. To avoid writing one
from scratch, use a sample configuration *conf/config.default.xml* as a starting point.

:bulb: You can always check the configuration using *scripts/validate_setup.py*:

```shell
python scripts/validate_setup.py conf/config.xml
```
(use --help for more information)

The configuration file has mostly two-level structure: *sections* and *key-value items*. Values are typically strings
but in some cases lists of strings are required. Configuration values are documented in *conf/config.rng* 
(a RelaxNG schema which describes KonText configuration XML)

<a name="install_configure_kontext_plugins"></a>
### Plug-ins

Configuration section *plugins* is kind of specific as it contains a configuration for custom implementations of
concrete KonText modules (i.e. it determines which objects are instantiated to serve
configurable/replaceable functions). To configure plug-ins properly please refer to their *config.rng* schema files.

For more information about plug-ins API and configuration please visit
[our wiki](https://github.com/czcorpus/kontext/wiki/Plug-in-API).


<a name="install_building_the_project"></a>
## Building the project

To be able to build the project you must have:

* a working [NodeJS](https://nodejs.org/en/download/) (version 8.x or newer) installation
* properly configured plug-ins in *conf/config.xml* (see the section above)

In your KonText directory write:

```
npm install; make production
```

<a name="#install_deployment"></a>
## Deployment

Once you have your copy of KonText built it is possible to deploy it on a server.
Currently KonText does not support any deployment automation but the process is simple.

```
cp -r {cmpltmpl,conf,lib,locale,package.json,public,scripts,worker.py} destination_directory
```

You can also take a look at a [helper script](https://github.com/czcorpus/kontext-ucnk-scripts/blob/master/deploy.py)
which allows you (once you have a simple JSON configuration file) to install newest version from GitHub while keeping
a backup copy of your previous installation(s).

<a name="install_standalone_server_application"></a>
## Standalone server application

KonText can serve itself without any external web server but such a setup is recommended only
for testing and development purposes. The application can be activated by the 
following command (assuming your working dir is the installation dir):

```shell
  python public/app.py --address [IP address] --port [TCP port]
```

(*--address* and *--port* parameters are optional; default serving address is 127.0.0.1:5000)


<a name="install_wsgi_application"></a>
## WSGI application within a dedicated web-server

This is the recommended mode for production deployments.

<a name="install_gunicorn_plus_proxy"></a>
### Gunicorn + reverse proxy (Apache, Nginx)

This configuration is best suited for production, is easy to configure and
scales well.

Let's assume you are going to install KonText into */opt/kontext-production*.

First, define your Gunicorn configuration file */opt/kontext-production/conf/gunicorn-conf.py*
(= common Python module) and place it to the *conf* directory.

```
import multiprocessing

workers = multiprocessing.cpu_count() * 2 + 1
bind = "127.0.0.1:8090"
timeout = 120
accesslog = "/var/log/kontext/gunicorn.log"
errorlog = "/var/log/kontext/gunicorn-error.log"
```

Please note that the number of workers defined above is not always necessarily the best one. For small installations
with infrequent visits, on a server with many CPU cores, 2-4 workers can be enough. For thousands (to few tens
of thousands) users a day, 8-10 workers should do the job. The configuration also depends on size of corpora you are 
going to provide and on applied use-cases - e.g. workshops where a number of users trigger a query at the same time 
may require a high number of workers even if the total number of daily visits is not very high. 

In general the following parameters should be in harmony:

* proxy read timeout (*proxy_read_timeout* in Nginx)
* Gunicorn timeout (should be less or equal to proxy read timeout)
* number of Gunicorn (or uWSGI) workers
  * e.g. if you allow long calculations, you may need to add some workers to be able to handle "normal" traffic  
* number of Celery workers and their timeouts

Then define an Upstart configuration file */etc/init/gunicorn-kontext.conf*:

```
description "gunicorn-kontext"
start on (filesystem)
stop on runlevel [016]
respawn
setuid www-data
setgid www-data
chdir /opt/kontext-production/public
exec /usr/local/bin/gunicorn app:application -c /opt/kontext-production/conf/gunicorn-conf.py
```

Or in case of systemd create file */etc/systemd/system/gunicorn-kontext.service*:

```
[Unit]
Description=KonText Gunicorn daemon
#Requires=gunicorn.socket
After=network.target

[Service]
PIDFile=/run/gunicorn-kontext/pid
User=www-data
Group=www-data
WorkingDirectory=/opt/kontext-production/public
ExecStart=/usr/local/bin/gunicorn --pid /run/gunicorn-kontext/pid -c /opt/kontext/production/conf/gunicorn-conf.py app:application
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s TERM $MAINPID
PrivateTmp=true
PermissionsStartOnly=true
ExecStartPre=-/bin/mkdir /var/run/gunicorn-kontext
ExecStartPre=/bin/chown -R www-data:root /var/run/gunicorn-kontext

[Install]
WantedBy=multi-user.target
```


Then configure Apache:

```
<VirtualHost *:80>
  ServerName my-korpus-domain.org

  ProxyPreserveHost On
  ProxyPass /files/ !
  ProxyPass "/" "http://127.0.0.1:8090/" timeout=30
  ProxyPassReverse "/" "http://127.0.0.1:8090/"
  RequestHeader set X-Forwarded-Proto "http"
  SetEnv proxy-initial-not-pooled 1
  SetEnv force-proxy-request-1.0 1
  SetEnv proxy-nokeepalive 1

  <Directory "/opt/kontext-production/public">
          Options -Indexes FollowSymLinks
          AllowOverride All
          Order allow,deny
          Allow from all
  </Directory>
</VirtualHost>
```

Or use Nginx:

```
upstream app_server {
    server localhost:8090 fail_timeout=0;
}
server {
    listen 80;
    location /files/ {
        alias /path/to/kontext/public/files/;
    }
    location / {
        proxy_set_header Host $http_host;
        proxy_redirect off;
        proxy_pass http://app_server;
        proxy_read_timeout 120;
    }
}

```

Now you can start Gunicorn:

```
service kontext start
```

or

```
systemctl start gunicorn-kontext
```

<a name="install_uwsgi"></a>
### uWSGI

uWSGI server can be used instead of Gunicorn. For more 
information please see [uWSGI.md](uWSGI.md).


<a name="install_celery_worker"></a>
## Celery worker

KonText uses a backend worker queue for many computing-intensive tasks (many of them asynchronous). 
It can run on the same machine as the main application but it can also run on a dedicated server
(as long as the servers share a disk storage).

Although it is possible to choose a backend calculation server from several 
variants, for production use, [Celery](http://www.celeryproject.org/) is currently 
the recommended way to go.

```
sudo pip install Celery
```

```
sudo useradd -r -s /bin/false celery
adduser celery www-data
```

<a name="install_celery_configuration"></a>
### Celery configuration

* in case of *systemd* use path */etc/conf.d/celery*
* in case of *upstart* use path */etc/default/celeryd*

```
CELERYD_NODES="worker1"

CELERY_BIN="/usr/local/bin/celery"

CELERY_APP="worker:app"

CELERYD_CHDIR="/opt/kontext-production/"

CELERYD_LOG_FILE="/var/log/celery/%N.log"
CELERYD_PID_FILE="/var/run/celery/%N.pid"

CELERYD_USER="celery"
CELERYD_GROUP="www-data"

CELERY_CREATE_DIRS=1

CELERYD_OPTS="--time-limit=480 --concurrency=8"
```

Also define a KonText-specific configuration in your *config.xml* (*config.default.xml* already
contains this):

```xml
<calc_backend>
    <type>celery</type>
    <celery_broker_url>redis://10.0.3.149:6379/2</celery_broker_url>
    <celery_result_backend>redis://10.0.3.149:6379/2</celery_result_backend>
    <celery_task_serializer>json</celery_task_serializer>
    <celery_result_serializer>json</celery_result_serializer>
    <celery_accept_content>
        <item>json</item>
    </celery_accept_content>
    <celery_timezone>Europe/Prague</celery_timezone>
    <status_service_url />
</calc_backend>
```

<a name="install_celery_systemd_configuration"></a>
### Systemd configuration

File */etc/systemd/system/celeryd.service*:

```ini

[Unit]
Description=Celery Service
After=network.target

[Service]
Type=forking
User=celery
Group=www-data
EnvironmentFile=/etc/conf.d/celery
WorkingDirectory=/opt/kontext-production
ExecStart=/bin/sh -ec '${CELERY_BIN} multi start $CELERYD_NODES -A $CELERY_APP --logfile=${CELERYD_LOG_FILE} --pidfile=${CELERYD_PID_FILE} $CELERYD_OPTS'
ExecStop=/bin/sh '${CELERY_BIN} multi stopwait $CELERYD_NODES --pidfile=${CELERYD_PID_FILE}'
ExecReload=/bin/sh '${CELERY_BIN} multi restart $CELERYD_NODES -A $CELERY_APP --pidfile=${CELERYD_PID_FILE} --logfile=${CELERYD_LOG_FILE} --loglevel="${CELERYD_LOG_LEVEL}" $CELERYD_OPTS'

[Install]
WantedBy=multi-user.target
```

File */usr/lib/tmpfiles.d/celery.conf*:

```
d /var/run/celery 0755 celery www-data -
d /var/log/celery 0755 celery www-data -
```

<a name="install_celery_beat"></a>
## Celery Beat

Celery Beat allows cron-like task management within Celery. It is used by
KonText especially to remove old cache files (concordance, frequency, collocations).

<a name="install_celery_beat_systemd_configuration"></a>
### Systemd configuration

File */etc/systemd/system/celerybeat.service*:

```
[Unit]
Description=Celery Beat Service
After=network.target celery.service

[Service]
Type=forking
User=celery
Group=www-data
PIDFile=/var/run/celerybeat/beat.pid
EnvironmentFile=/etc/conf.d/celerybeat
WorkingDirectory=/opt/kontext/production/scripts/celery
ExecStart=/bin/sh -c '${CELERY_BIN} --app=${CELERY_APP} beat ${CELERYBEAT_OPTS} --workdir=${CELERYBEAT_CHDIR} --detach --pidfile=${CELERYBEAT_PID_FILE} --logfile=${CELERYBEAT_LOGFILE} --loglevel=${CELERYBEAT_LOGLEVEL}'
ExecStop=/bin/kill -s TERM $MAINPID
PermissionsStartOnly=true
ExecStartPre=-/bin/mkdir /var/run/celerybeat
ExecStartPre=/bin/chown -R celery:root /var/run/celerybeat

[Install]
WantedBy=multi-user.target
```

Then define a KonText-specific configuration
*/opt/kontext-production/conf/beatconfig.py*:

```
from celery.schedules import crontab
from datetime import timedelta

BROKER_URL = 'redis://127.0.0.1:6379/2'
CELERY_TASK_SERIALIZER = 'json'
CELERY_ENABLE_UTC = True
CELERY_TIMEZONE = 'Europe/Prague'

CELERYBEAT_SCHEDULE = {
    'conc-cache-cleanup': {
        'task': 'conc_cache.conc_cache_cleanup',
        'schedule': crontab(hour='0,12', minute=1),
        'kwargs': dict(ttl=120, subdir=None, dry_run=False)
    }
}
```

<a name="managing_users"></a>
## Managing users

The installation script has installed two users:

1) public user which is used for any unauthorized access to KonText (id = 0)
2) user *kontext* with a random password generated by the installation script (id = 1)

To add more users, another script packed with the *default_auth* plug-in can be used.

First, a JSON containing new users' credentials must be prepared. See `lib/plugins/default_auth/scripts/users.sample.json`
for the required format and data.

*Note 1*: Paswords in the file should be in plaintext. Please note that the file is needed just to install the users and from
then, it won't be needed by KonText. The installed users' password are stored in a secure form within the database. 
The best way how to treat the user credentials file is to delete it or encrypt it and archive somewhere once you install 
the users.

*Note 2*: the script we are going to use will rewrite any existing user if `id` collides. To prevent this,
start your new user IDs from 2 (to leave two initial users unchanged).

### Ensuring access to corpora

For each user, you should also set a list of corpora they will be able to access. It is possible to configure access to
corpora which are not installed yet (just make sure proper corpora identifiers/names are used - typically this
means names matching respective Manatee registry file names for your corpora).

Once the list of new users is ready, run:

```bash
python lib/plugins/default_auth/scripts/install.py /path/to/your/users.json
```


<a name="managing_corpora"></a>
## Managing corpora

To install a new corpus, please follow the steps described below.

### Install registry file

Registry configures a corpus for the Manatee search engine (and also adds some configuration needed by KonText/NoSkE). 
The file should be located in a directory defined in `conf/config.xml`, element `kontext/corpora/manatee_registry`.

### Install indexed data

Copy your indexed corpus to a directory specified in `conf/config.xml` (element `kontext/corpora/manatee_registry`).  
The data must be located in the path specified within a respective registry file under the `PATH` key.

### Update corplist.xml

The `default_corparch` plug-in which is used by default as a module to list and search for corpora uses `conf/corplist.xml`
file to store all the configured corpora. The `susanne` corpus should be already there. To add a new corpus please
follow the same pattern as in case of `susanne`.

### Update access rights

To provide access to the new corpus for an existing user, you can use script `lib/plugins/default_auth/scripts/usercorp.py`.
E.g. to add a new corpus 'foo' to a user with ID = 3:

```bash
python3 lib/plugins/default_auth/scripts/usercorp.py 3 add foo

```

Note: The script also allows removing access rights.

### Apply changes

Once all the steps are done, restart your KonText application and your Celery worker and the corpus should be available.