Installation instructions
=========================

Standalone server application
-----------------------------

KonText can serve itself without any external web server but such a setup is recommended only
for testing and development purposes. The application can be activated by a following command::

```shell
  python public/app.py --address [IP address] --port [TCP port]
```

(*--address* and *--port* parameters are optional; default serving address is 127.0.0.1:5000)


WSGI application
----------------

KonText can be run within a WSGI-enabled web server (e.g. Apache 2.x + [mod_wsgi](https://code.google.com/p/modwsgi/)). This is the recommended mode for production deployments. Here we show two tested, production-ready setups.

### mod_wsgi

Assuming you want to define a separate virtual host for KonText running within Apache, you have to define a loadable
configuration file for your Apache 2 installation (e.g. in Debian and derived GNU/Linux distributions it
is */etc/apache2/sites-available/*):

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

*Important note*: please note that the line *WSGIProcessGroup %{GLOBAL}* must be always present in this concrete form as in other case you may experience occasional error responses from Apache server
(see [mod_wsgi documentation](https://code.google.com/p/modwsgi/wiki/ApplicationIssues#Python_Simplified_GIL_State_API) for details). Also note that such a configuration
does not provide the best performance *mod_wsgi* can offer. 

Installation into an Apache [Location](http://httpd.apache.org/docs/current/mod/core.html#location) is also possible. Please refer to the [Apache documentation](http://httpd.apache.org/docs/2.2/) for more information.


### Gunicorn + a reverse proxy (Apache, Nginx)

This configuration is best suited for high load environments.


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
grunt production-optimized
```

generates files required for the production mode along with some additional RequireJS optimizations (merged libraries).


KonText configuration
---------------------

KonText is configured via an XML configuration file located in the root directory of the application
(do not confuse this with the root directory of the respective web application).
KonText loads its configuration from path *../config.xml*.

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

Custom sections and items should have attribute *extension-by* where value identifies you, your project or your
installation:

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


| Xpath                                          | Description                                                       |
|------------------------------------------------|-------------------------------------------------------------------|
| /kontext/global/manatee_path                   | If you want to use some non-default path to be searched by Python when looking for manatee library, you can define it here       |
| /kontext/global/debug                          | true/false (true => detailed error info is visible etc.)          |
| /kontext/global/log_path                       | Path to a logging file (webserver must have write access)         |
| /kontext/global/logged_values                  | a list of values to be logged |
| /kontext/global/logged_values/item             | a concrete value to be logged; possible values are {date, action, user_id, user, params, settings, proc_time} and environ:\* where \* can be any value WSGI environ dict contains (e.g. REMOTE_ADDR, HTTP_USER_AGENT,...) 
| /kontext/global/profile_log_path               | Path to a file where profiling information will be written to (if debug == 2) |
| /kontext/global/maintenance                    | If true then a simple static page is displayed on any request (currently, all the plugins must be still initiable even in this case) |
| /kontext/global/administrators                 | List of usernames with administrative rights; this is deprecated  |
| /kontext/global/fonts                          | list of custom CSS fonts to be loaded within HTML document        |
| /kontext/global/translations                   | list of supported languages for user interface (this requires proper *\*.mo* file and also enabled support in your OS); a language code must have format xx_YY   |
| /kontext/global/translations/language          | language item - besides language code, it may contain *label* attribute - if defined then the label is shown to user    |
| /kontext/global/max_attr_list_size             | if the number of possible values for a struct. attribute is higher then this number then KonText shows just an empty input box for manual entry (instead of a list of all values) |
| /kontext/global/anonymous_user_id              | a numeric ID of the *public* (aka *anonymous*) user which has limited privileges |


### Plug-ins configuration

| Xpath                                           | Description                                                       |
|-------------------------------------------------|-------------------------------------------------------------------|
| /kontext/plugins                                | This section contains a configuration of plug-ins. Each plug-in has its own subtree with a root element named with the name of the respective plug-in (e.g. *auth*, *db*, *getlang*). This element must contain at least a *module* element specifying the name of the Python package implementing the plug-in. See the *config.sample.xml* |


### Caching configuration

| Xpath                                          | Description                                                      |
|------------------------------------------------|------------------------------------------------------------------|
| /kontext/cache/clear_interval                  | number of seconds to keep cached files                           |


### Corpus-related configuration

| Xpath                                           | Description                                                       |
|-------------------------------------------------|-------------------------------------------------------------------|
| /kontext/corpora/manatee_registry               | Path where corpora registry files are stored                      |
| /kontext/corpora/cache_dir                      | Path where application stores general cached data                 |
| /kontext/corpora/subcpath                       | Path where general subcorpora data is stored                      |
| /kontext/corpora/users_subcpath                 | Path where user's subcorpora are stored                           |
| /kontext/corpora/tags_src_dir                   | A directory where all unique tag combinations for corpora are     |
| /kontext/corpora/tags_cache_dir                 | A directory where tag-builder stores its auxiliary data           |
| /kontext/corpora/conc_dir                       | Path where general concordance data is stored                     |
| /kontext/corpora/helpsite                       | URL of the help site (refer to the config.sample.xml)             |
| /kontext/corpora/default_corpora                | Contains list of default corpora (see below)                      |
| /kontext/corpora/default_corpora/item           | Represents individual default corpus (multiple allowed)           |
| /kontext/corpora/speech_segment_struct_attr     | Name of the structural attribute delimiting speeches              |
| /kontext/corpora/speech_files_path              | root path where audio files containing speech segments are stored |
| /kontext/corpora/kwicline_max_context           | Maximum size (in words) of the KWIC context                       |
| /kontext/corpora/use_db_whitelist               | 0/1 (0 => any user has access to any corpus)                      |
| /kontext/corpora/empty_attr_value_placeholder   | An alternative string to show if some structattr is empty         |
| /kontext/corpora/multilevel_freq_dist_max_levels| Multi-level freq. distrib. - max. number of levels for a query    |


### Tag-builder component configuration

KonText contains a PoS tag construction widget called "tag builder" which provides an interactive way of writing
PoS tags. Only positional tagsets are supported. Multiple tagsets can be defined:

```xml
<tagsets>
  <tagset ident="ucnk1" num_pos="16">
    <position index="0">
      <label>
        <desc lang="en">Part of speech</desc>
        <desc lang="cs">Slovní druh</desc>
      </label>
      <value id="A">
        <desc lang="en">adjective</desc>
        <desc lang="cs">adjektivum</desc>
      </value>
      <value id="N">
       ...
      </value>
        ...
    </position>
    <position index="1">
    ...
    </position>
    ...
  </tagset>
  <tagset ident="my_custom_tagset">
    ...
  </tagset>
</tagsets>
```

Concrete corpus can be configured to support the widget in the following way:

```xml
<corpus ident="my_corpus" tagset="ucnk1" />
```
