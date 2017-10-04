# Installation instructions

## Contents

* [Install dependencies](#install_install_dependencies)
* [Configure KonText (config.xml)](#install_configure_kontext)
  * [Plug-ins](#install_configure_kontext_plugins)
* [Building the project](#install_building_the_project)
* [Deployment](#install_deployment)
* [Standalone server application](#install_standalone_server_application)
* [WSGI application within a dedicated web-server](#install_wsgi_application)
  * [Gunicorn + reverse proxy](#install_gunicorn_plus_proxy)
  * [Apache mod_wsgi](#install_apache_mod_wsgi)
* [Celery worker](#install_celery_worker)
  * [Celery configuration](#install_celery_configuration)
  * [Systemd configuration](#install_celery_systemd_configuration)
* [Celery Beat](#install_celery_beat)
  * [Systemd configuration](#install_celery_beat_systemd_configuration)

<a name="install_install_dependencies"></a>
## Install dependencies


```
pip install -r requirements.txt
```

Please note that the *lxml* package (referred within *requirements.txt*) requires specific dependencies to be
installed on server:

* *python-dev*
* *libxml2-dev*
* *libxslt-dev*


On Ubuntu/Debian you can install them by entering the following command:

```
sudo apt-get install libxml2-dev libxslt-dev python-dev
```

<a name="install_configure_kontext"></a>
## Configure KonText (config.xml)

Before you can build KonText, a proper configuration must be ready (especially the *plugins* section).

KonText is configured via an XML configuration file *conf/config.xml*. To avoid writing one 
from scratch, use a sample configuration *conf/config.sample.xml* as a starting point.

:bulb: You can always check the configuration using *scripts/validate_setup.py*:

```shell
python scripts/validate_setup.py conf/config.xml
```
(use --help for more information)

The configuration file has mostly two-level structure: *sections* and *key-value items*. Values can be either strings
or list of items. Configuration values are documented in *conf/config.rng* (a RelaxNG schema which describes
kontext configuration XML)

<a name="install_configure_kontext_plugins"></a>
### Plug-ins

Configuration section *plugins* is kind of specific as it contains a configuration for custom implementations of
concrete KonText modules (i.e. it determines which objects are instantiated to serve 
configurable/replaceable functions). To configure plug-ins properly please refer to *conf/config.sample.xml* and plug-ins
source codes which should always contain configuration description in
[RelaxNG compact syntax](http://www.relaxng.org/compact-tutorial-20030326.html).

For more information about plug-ins API and configuration please visit
[our wiki](https://github.com/czcorpus/kontext/wiki/Plug-in-API).


<a name="install_building_the_project"></a>
## Building the project

To be able to build the project you must have:

* a working [NodeJS](https://nodejs.org/en/download/) (v4.3 or newer) installation
* properly configured plug-ins in *conf/config.xml* (see the section above)

In your KonText directory write:

```
npm install; grunt production
```

<a name="#install_deployment"></a>
## Deployment

Once you have your copy of KonText built it is possible to deploy it on a server.
Currently KonText does not support any deployment automation but the process is simple.

```
cp -r {cmpltmpl,conf,lib,locale,package.json,public,scripts,worker.py} destination_directory
```

<a name="install_standalone_server_application"></a>
## Standalone server application

KonText can serve itself without any external web server but such a setup is recommended only
for testing and development purposes. The application can be activated by the following command::

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
timeout = 300
accesslog = "/var/log/kontext/gunicorn.log"
errorlog = "/var/log/kontext/gunicorn-error.log"
```


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

<a name="install_apache_mod_wsgi"></a>
### Apache mod_wsgi

Running KonText within *Apache* webserver is possible with some [limitations](#limitation_note). 
We recommend considering [Gunicorn + Proxy](#wsgi_application) variant for serious 
production deployment.

Assuming you want to define a separate virtual host for KonText running within Apache, you have to define a loadable
configuration file for your Apache 2 installation (e.g. in Debian and derived GNU/Linux distributions it
is */etc/apache2/sites-enabled/my_config*):

```
<VirtualHost *:80>
    ServerName my.domain
    DocumentRoot /opt/kontext-production/public

    Alias /files /opt/kontext-production/public/files
    <Directory /opt/kontext-production/public/files>
        Order deny,allow
        Allow from all
    </Directory>

    WSGIScriptAlias / /opt/kontext-production/public/app.py
    WSGIDaemonProcess kontext_app processes=2 threads=15 display-name=%{GROUP}
    WSGIProcessGroup %{GLOBAL}
</VirtualHost>
```

<a name="limitation_note"></a>
**Important note**: please note that the line *WSGIProcessGroup %{GLOBAL}* must be always present in this
concrete form as in other case you may experience occasional error responses from Apache server
(see [mod_wsgi documentation](https://code.google.com/p/modwsgi/wiki/ApplicationIssues#Python_Simplified_GIL_State_API)
for details). Also note that such a configuration does not provide the best performance *mod_wsgi* can offer.

Installation into an Apache [Location](http://httpd.apache.org/docs/current/mod/core.html#location) is also
possible. Please refer to the [Apache documentation](http://httpd.apache.org/docs/2.2/) for more information.


<a name="install_celery_worker"></a>
## Celery worker

KonText uses [Celery](http://www.celeryproject.org/) worker queue for many 
computing-intensive tasks (many of them asynchronous). It can run on the same
machine as the main application but it can also run on a dedicated server
(as long as the servers share a disk storage).

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

Also define a KonText-specific configuration */opt/kontext-production/conf/celeryconfig.py*:

```
BROKER_URL = 'redis://127.0.0.1:6379/2'
CELERY_RESULT_BACKEND = 'redis://127.0.0.1:6379/2'
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TIMEZONE = 'Europe/Prague'
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

