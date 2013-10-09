==================
Installation guide
==================

Web server configuration
========================

Please note that currently only Apache 2.x web server is supported. Support for other web servers is being considered.

Define a loadable configuration file for your Apache 2 installation or update some of existing configuration files::

  Alias /bonito /path/to/your/app/public

  <Directory /path/to/your/app/public>
    Options +ExecCGI
    AddHandler cgi-script .cgi
    AllowOverride FileInfo
    RewriteEngine On
    RewriteRule ^$ run.cgi/first_form [L,R=301]
  </Directory>

Please note that Apache's document root should be set to the *public* subdirectory
of the application to prevent access to configuration, source code and other sensitive data.

Using described configuration, your web application should be available at URL http://your_server_hostname/bonito.

Plugin approach
===============

To be able to fit in different environments, some of application's functionality is not implemented concretely. It means
you have to implement a solution compatible with your existing systems by yourself (e.g. you have already some database
schema specifying user accounts). You can start by exploring plugins we use in our institute - they are included
in the *plugins* directory.

Typically, a plugin module is required to implement *create_instance(settings, \*args, \**kwargs) * method which returns
an instance of required service.


Database
--------

Because many implicit plugins require a storage of some kind, application defines plugin *db* which is intended to
provide an application-wide access to a database. The most convenient approach is thus based on a single database
server (e.g. MariaDB, MySQL or PostreSQL) serving to the whole application. But there is nothing wrong with
per-plugin storage solution too.

Sessions
--------

The application uses web sessions to store persistent user data. Please refer to *plugins/sessions.py* for an
example of possible implementation.

User settings storage
---------------------

When user changes some of application's settings (e.g. the context size for concordance lines) these data are
stored via *settings_storage* plugin. Please refer to *plugins/settings_storage.py* for an example.


Authentication
--------------

The application expects you to provide a custom implementation of authentication module. If you want to test the
application without (almost) any programming you can use provided *dummy_auth.py* module which authenticates any user
and always returns the same list of corpora (you probably want to set your own list).

To be able to provide different lists of corpora for different users, you have to implement an authentication
module with the following properties:

  * the module resides in the *plugins* package (= *./lib/plugins* directory)
  * contains function *create_instance(settings)* which creates and returns a new instance of your authentication object.
    The *settings* parameter is Bonito's *settings* module or some compatible one. This
    provides access to any required configuration parameter (e.g. database connection if you need one).

Authentication object is expected to implement following methods:

  * *validate_user(username, password)* - returns bool value (True on success else False) and changes
    the state of your authentication object to reflect user's properties
  * *get_corplist()* - returns list/tuple containing identifiers of corpora available to the
    logged user
  * *is_administrator()* - returns True if the user is admin else False is returned
  * if the password update interface is required then the following additional methods must be implemented:

    * *update_password(new_password)*
    * *validate_password(password)* - tests whether provided password matches user's current password
    * *validate_new_password(password)* - tests whether provided password candidate matches required password
      properties (like length)
    * *get_required_password_properties()* - returns a text describing what are the properties of a valid password
    * *is_administrator()* - returns True if current user has administrator's privileges
    * *get_login_url()* - returns URL of *login* action (because in general, it may be outside the application)
    * *get_logout_url()* - returns URL of *logout* action (because in general, it may be outside the application)
    * *anonymous_user()* - returns a dictionary containing anonymous user credentials

Class auth.AbstractAuth can be used as a base class when implementing custom authentication object. It already provides
some required methods.

Query storage
-------------

To be able to use query history a plugin *query_storage* must be implemented. Please refer to the
*plugins/query_storage.py* file for an example.

Deployment
==========

Copy/unpack your application directory/archive to the location of your choice and run the deployment script::

   ./scripts/deploy.sh

The script compiles HTML templates and then asks you for the location of the YUI compressor. If you don't want to minify
JavaScript and CSS just answer "no" in the prompt (= default choice). If you want to use this feature, please download latest
version of the YUI compressor from https://github.com/yui/yuicompressor/downloads.

Configuration
=============

The application itself is configured via an XML configuration file located in the root directory of the application
(do not confuse this with the root directory of the respective web application).
By default Bonito loads its configuration from *../config.xml*. This can be overridden by setting an environment
variable *BONITO_CONF_PATH* (in case of Apache this is done by the *SetEnv* directive).

The configuration XML file is expected to be partially customizable according to the needs of 3rd party plugins.
Generally it has two-level structure: sections and key->value items (where value can be also a list of items (see
e.g. */bonito/corpora/default_corpora*). Some parts of the file with specific structure can be also processed by
dedicated functions.

The structure can be understood from the following example::

    <bonito>
      <global>
        <key1>value1</key>
      </global>
      <some_other_section>
        <key2>value2</key>
        <key3>
          <item>value3a</item>
          <item>value3b</item>
        </key3>
      </some_other_section>
    </bonito>

Custom sections and items should have attribute *extension-by* where value identifies you, your project or your
installation ::

    <bonito>
        <global>
        ...
        </global>
        <corpora>
        ...
        </corpora>
        <my_section extension-by="acme">
            <key1>value1</key1>
        </my_section>
    </bonito>


The value of the attribute is then used as a prefix to access custom items. While core configuration items are accessible
via two parameters *[section_name]* and *[item_name]* in case of custom values it is *[value_of_extension_for:section_name]*
or *[value_of_extension_for:item_name]*. If you define your custom section as show in the previous code example
then you must use following call to obtain for example the value *value1*::

    settings.get('acme:my_section', 'key1')

Please note that items of your custom section are accessed without any prefix.

You can also add a custom item to a core section ::

    <bonito>
        <global>
        ...
          <my_item extension-by="acme">foo</my_item>
        </global>
        <corpora>
        ...
        </corpora>
    </bonito>

Such value is then accessible via following call ::

    settings.get('global', 'acme:my_item')

You can refer to the **config.sample.xml** to see more examples.

+------------------------------------------------+-------------------------------------------------------------------+
| Xpath                                          | Description                                                       |
+================================================+===================================================================+
| /bonito/global/manatee_path                    | Location of your Python interface to the manatee                  |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/global/debug                           | true/false (true => detailed error info is visible)               |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/global/log_path                        | Path to the logging file (Apache must have write access)          |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/global/administrators                  | List of usernames with administrative rights                      |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/global/fonts                           | list of custom CSS fonts to be loaded within HTML document        |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/plugins                                | this section contains plugins' configuration; each plugin         |
|                                                | requires at least *module* element to specify where code resides  |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/plugins/db                             | required plugin to access application's database                  |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/plugins/auth                           | required plugin for authentication                                |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/plugins/sessions                       | required plugin implementing session storage functions            |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/plugins/settings_storage               | required plugin specifying where and how to store user settings   |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/plugins/query_storage                  | optional plugin allowing to store query history to some storage   |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/plugins/appbar                         | optional plugin allowing remote-loaded toolbar on all pages       |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/cache/clear_interval                   | number of seconds to keep cached files                            |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/manatee_registry               | Path where corpora registry files are stored                      |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/options_dir                    | Path where 'options' files are stored                             |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/cache_dir                      | Path where application stores general cached data                 |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/subcpath                       | Path where general subcorpora data is stored                      |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/users_subcpath                 | Path where user's subcorpora are stored                           |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/tags_src_dir                   | A directory where all unique tag combinations for corpora are     |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/tags_cache_dir                 | A directory where tag-builder stores its auxiliary data           |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/conc_dir                       | Path where general concordance data is stored                     |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/helpsite                       | URL of the help site (refer to the config.sample.xml)             |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/default_corpora                | Contains list of default corpora (see below)                      |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/default_corpora/item           | Represents individual default corpus (multiple allowed)           |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/speech_segment_struct_attr     | Name of the structural attribute delimiting speeches              |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/speech_files_path              | root path where audio files containing speech segments are stored |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/kwicline_max_context           | Maximum size (in words) of the KWIC context                       |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/use_db_whitelist               | 0/1 (0 => any user has access to any corpus)                      |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/empty_attr_value_placeholder   | An alternative string to show if some structattr is empty         |
+------------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/multilevel_freq_dist_max_levels| Multi-level freq. distrib. - max. number of levels for a query    |
+------------------------------------------------+-------------------------------------------------------------------+

Corpora hierarchy
-----------------

Corpora hierarchy serves as a source for the 'tree-like' corpus selection tool. It supports nested (i.e. multi-level)
organization::

    <corplist title="">
      <corplist title="Synchronic Corpora">
         <corplist title="SYN corpora">
           <corpus id="SYN2010" web="http://www.korpus.cz/syn.php" sentence_struct="s" num_tag_pos="16" />
           ... etc...
         </corplist>
         <corplist title="Diachronic Corpora">
            <corpus id="DIA" />
         </corplist>
      </corplist>
    </corplist>

Attributes for the **corplist** element:

+--------------+---------------------+
| attr. name   | description         |
+==============+=====================+
| title        | name of the group   |
+--------------+---------------------+

Attributes for the **corpus** element:

+-----------------+--------------------------------------------------------------------+
| attr. name      | description                                                        |
+=================+====================================================================+
| id              | name of the corpus (as used within registry files)                 |
+-----------------+--------------------------------------------------------------------+
| sentence_struct | structure delimiting sentences                                     |
+-----------------+--------------------------------------------------------------------+
| num_tag_pos     | number of character positions in a tag                             |
+-----------------+--------------------------------------------------------------------+
| web             | (optional) external link containing information about the corpus   |
+-----------------+--------------------------------------------------------------------+


Tag-builder component configuration
-----------------------------------

Sample file::

    <tagsets>
        <tagset position="0">
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
        </tagset>
        <tagset position="1">
        ...
        </tagset>
        ...
    </tagsets>

