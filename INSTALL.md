Installation instructions
=========================

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


### Gunicorn + a reverse proxy (Apache, Nginx)

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

This can be set in *config.xml*'s */kontext/global/debug* by setting the value *false*.

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


KonText configuration
---------------------

KonText is configured via an XML configuration file located in the *conf* directory.
KonText loads its configuration from path *../conf/config.xml* (taken relative to the *app.py*).

You can use *conf/config.sample.xml* which

The configuration XML file is expected to be partially customizable according to the needs of 3rd party plug-ins.
Generally it has two-level structure: *sections* and *key-value items* (where value can be also a list of items (see
e.g. */kontext/corpora/default_corpora*). Some parts of the file with specific structure can be also processed by
dedicated functions or modules.

The structure can be understood from the following example:

```xml
<kontext>
  <global>
    <key1>value1</key>
  </global>
  <some_other_section>
    <key2>value2</key>
    <key3>
      <!-- array value -->
      <item>value3a</item>
      <item>value3b</item>
    </key3>
  </some_other_section>
</kontext>
```

Custom sections have the *extension-by* attribute. The value is a installation/organization-specific
identifier:

```xml
<kontext>
    <global>
    ...
    </global>
    <corpora>
    ...
    </corpora>
    <my_section extension-by="acme">
        <key1>value1</key1>
    </my_section>
</kontext>
```


The value of the attribute is then used as a prefix to access custom items. While core configuration items are accessible
via two parameters *[section_name]* and *[item_name]* in case of custom values it is *[value_of_extension_for:section_name]*
or *[value_of_extension_for:item_name]*. If you define your custom section as shown in the previous code example
then you must use following call to obtain for example the value *value1*:

```python
settings.get('acme:my_section', 'key1')
```

Please note that items of your custom section are accessed without any prefix (because the whole section is custom).

You can also add a custom item to a KonText-fixed section:

```xml
<kontext>
    <global>
    ...
      <my_item extension-by="acme">foo</my_item>
    </global>
    <corpora>
    ...
    </corpora>
</kontext>
```

Such value is then accessible via following call:

```xml
settings.get('global', 'acme:my_item')
```

Sample configuration file **config.sample.xml** provides more examples.

### Global configuration

```

```

### Tag-builder component configuration

KonText contains a PoS tag construction widget called "tag builder" which provides an interactive way of writing
PoS tags. Only positional tagsets are supported. Multiple tagsets can be defined:


Concrete corpus can be configured to support the widget in the following way:

```xml
<corpus ident="my_corpus" tagset="defined_tagset_name" />
```
