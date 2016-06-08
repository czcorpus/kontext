Installation instructions
=========================

Install dependencies
--------------------

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


Configure KonText (config.xml)
------------------------------

Before you can build KonText, a proper configuration must be ready (especially plug-ins).

KonText is configured via an XML configuration file *conf/config.xml*. To avoid writing one from scratch a sample
configuration *conf/config.sample.xml* can be used to start with.

:bulb: You can always check the configuration using *scripts/validate_setup.py*:

```shell
python scripts/validate_setup.py conf/config.xml
```
(use --help for more information)

The configuration file has mostly two-level structure: *sections* and *key-value items*. Values can be either strings
or list of items. The structure can be understood from the following example:

```xml
<kontext>
  <global>
    <key1>value1</key>
  </global>
  <some_other_section>
    <key2>value2</key>
    <key3>
      <!-- list value -->
      <item>value3a</item>
      <item>value3b</item>
    </key3>
  </some_other_section>
  <plugins>
    <db>
    ...
    </db>
  ...
  </plugins>
</kontext>
```

### Plug-ins

Section named *plugins* is a bit specific as it contains a configuration for custom implementations of
specific KonText modules. To configure plug-ins properly please refer to *conf/config.sample.xml* and plug-ins
source codes which should always contain configuration description in
[RelaxNG compact syntax](http://www.relaxng.org/compact-tutorial-20030326.html).

For more information about plug-ins API and configuration please visit
[our wiki](https://github.com/czcorpus/kontext/wiki/Plug-in-API).



Building the project
--------------------

To be able to build the project you must have:

* a working [NodeJS](https://nodejs.org/en/download/) (v4.3 or newer) installation
* properly configured plug-ins in *conf/config.xml* (see the section above)

In your KonText directory write:

```
npm install; grunt production
```

Deployment
----------

Once you have your copy of KonText built it is possible to deploy it on a server.
Currently KonText does not support any deployment automation but the process is simple.

```
cp -r {cmpltmpl,conf,lib,locale,package.json,public,scripts,worker.py} destination_directory
```

Standalone server application
-----------------------------

KonText can serve itself without any external web server but such a setup is recommended only
for testing and development purposes. The application can be activated by the following command::

```shell
  python public/app.py --address [IP address] --port [TCP port]
```

(*--address* and *--port* parameters are optional; default serving address is 127.0.0.1:5000)


WSGI application
----------------

KonText can be run within a WSGI-enabled web server (e.g. Apache 2.x +
[mod_wsgi](https://code.google.com/p/modwsgi/)). This is the recommended mode for production
deployments. Here we show two tested, production-ready setups.

### mod_wsgi

Assuming you want to define a separate virtual host for KonText running within Apache, you have to define a loadable
configuration file for your Apache 2 installation (e.g. in Debian and derived GNU/Linux distributions it
is */etc/apache2/sites-enabled/my_config*):

```
<VirtualHost *:80>
    ServerName my.domain
    DocumentRoot /path/to/kontext/public

    Alias /files /path/to/kontext/public/files
    <Directory /path/to/kontext/public/files>
        Order deny,allow
        Allow from all
    </Directory>

    WSGIScriptAlias / /path/to/kontext/public/app.py
    WSGIDaemonProcess kontext_app processes=2 threads=15 display-name=%{GROUP}
    WSGIProcessGroup %{GLOBAL}
</VirtualHost>
```

*Important note*: please note that the line *WSGIProcessGroup %{GLOBAL}* must be always present in this
concrete form as in other case you may experience occasional error responses from Apache server
(see [mod_wsgi documentation](https://code.google.com/p/modwsgi/wiki/ApplicationIssues#Python_Simplified_GIL_State_API)
for details). Also note that such a configuration does not provide the best performance *mod_wsgi* can offer.

Installation into an Apache [Location](http://httpd.apache.org/docs/current/mod/core.html#location) is also
possible. Please refer to the [Apache documentation](http://httpd.apache.org/docs/2.2/) for more information.


### Gunicorn + reverse proxy (Apache, Nginx)

This configuration is best suited for high load environments.

Let's assume you are going to install KonText into */opt/kontext-production*.

First, define your Gunicorn configuration file */opt/kontext-production/conf/gunicorn-conr.py*
(= common Python module) and place it to the *conf* directory.

```
import multiprocessing

workers = multiprocessing.cpu_count() * 2 + 1
bind = "127.0.0.1:8099"
timeout = 300
accesslog = "/var/log/kontext/gunicorn.log"
errorlog = "/var/log/kontext/gunicorn-error.log"
```

Then define an Upstart configuration file */etc/init/kontext.conf*:

```
description "kontext"
start on (filesystem)
stop on runlevel [016]
respawn
setuid www-data
setgid www-data
chdir /opt/kontext-production/public
exec /usr/local/bin/gunicorn app:application -c /opt/kontext-production/conf/gunicorn-conf.py
```

Then configure Apache:

```
<VirtualHost *:80>
  ServerName my-korpus-domain.org

  ProxyPreserveHost On
  ProxyPass /files/ !
  ProxyPass "/" "http://127.0.0.1:8099/" timeout=30
  ProxyPassReverse "/" "http://127.0.0.1:8099/"
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

Now you can start Gunicorn:

```
service kontext start
```

And reload Apache configuration:

```
service apache2 graceful
```

Please always keep in mind to have only *public* directory accessible by web clients to prevent them viewing
configuration files, source code and other sensitive data.


Deployment and running
----------------------

To be able to be deployed and run, *KonText* requires some additional file post-processing to be performed. These
steps also depend on whether the *KonText* runs in *debugging* or *production* mode.

All the required tasks are configured to be performed by [Grunt](http://gruntjs.com/) task automater (see file
*Gruntfile.js*).

### Debugging mode

This can be set in *config.xml*'s */kontext/global/debug* by putting *true* or *1* or *2* (which adds app profiling).

* file post-processing:
    * \*.tmpl files must be compiled by Cheetah templating compiler
    * LESS dynamic stylesheets are translated to CSS on client-side
* server-side errors are displayed in a raw form (i.e. page layout disappears and Python stack-trace is shown with some
  description)


### Production mode

This can be set in *config.xml*'s */kontext/global/debug* by setting the value *false* (or *0*).

* file post-processing:
    * \*.tmpl files must be compiled by Cheetah templating compiler
    * LESS dynamic stylesheets must be compiled (optionally minified) and merged into a single CSS file
    * optionally, JavaScript can be minimized

If you have a working node.js and Grunt (grunt-cli package) installation, you can prepare KonText for deployment just by
running *grunt* command in application's root directory. E.g.:

```bash
grunt production
```

generates files required for the production mode along with some additional RequireJS optimizations (merged libraries).
