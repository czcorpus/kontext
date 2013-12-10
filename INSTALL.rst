=========================
Installation instructions
=========================

------------------------
Web server configuration
------------------------

Please note that currently only Apache 2.x web server is supported. Support for other web servers is being considered.

Define a loadable configuration file for your Apache 2 installation or update some of existing configuration files::

  Alias /kontext /path/to/your/app/public

  <Directory /path/to/your/app/public>
    Options +ExecCGI
    AddHandler cgi-script .cgi
    AllowOverride FileInfo
    RewriteEngine On
    RewriteRule ^$ run.cgi/first_form [L,R=301]
  </Directory>

VirtualHost-based configuration is possible too. Please refer to the
`Apache documentation <http://httpd.apache.org/docs/2.2/>`_ for more information.

Please note that Apache's document root should be set to the *public* subdirectory
of the application to prevent access to configuration files, source code and other sensitive data.

Using shown configuration, your web application should be available at URL http://your_server_hostname/kontext .

---------------
Plugin approach
---------------

Because it is impossible to implement KonText in such a way that fits all the possible requirements in terms of
integrability into existing information systems, some parts of the application are implemented as plug-ins with
predefined interface.

For example, if you have an existing user database or if you do not want to bother with user authentication at all
you can easily implement your own version of the *auth* plugin. If you for example want to store user session data to
files instead to a database, all you have to do is to rewrite the *sessions* plugin.

You can start by exploring plugins we use in our institute - they are included in the *plugins* directory and have
*ucnk_* prefix.

Typically, a plugin module is required to implement method ::

    def create_instance(settings, *args, **kwargs):
        return MyPluginImplementation()

which returns an instance of required service. Additionally, a method ::

    def setup(**kwargs):
        pass

can be defined to allow further plugin configuration after *CGIPublisher* object is fully operational.

Following plugins are mandatory:

+------------------+------------------------------------------------------------------------------+
| id               | description                                                                  |
+==================+==============================================================================+
| auth             | user authentication                                                          |
+------------------+------------------------------------------------------------------------------+
| corptree         | loads a hierarchy of corpora from an XML file                                |
+------------------+------------------------------------------------------------------------------+
| query_storage    | stores recent queries entered by users and allows their reopening            |
+------------------+------------------------------------------------------------------------------+
| sessions         | handles user sessions (i.e. between-requests persistence)                    |
+------------------+------------------------------------------------------------------------------+
| settings_storage | stores users' settings to a persistent storage                               |
+------------------+------------------------------------------------------------------------------+

Following plugins are optional:

+------------------+------------------------------------------------------------------------------+
| id               | description                                                                  |
+==================+==============================================================================+
| appbar           | loads a between-app-shared page element (e.g. a bar at the top of the page)  |
+------------------+------------------------------------------------------------------------------+
| db               | provides a connection to a database (if required by other plugins)           |
+------------------+------------------------------------------------------------------------------+
| getlang          | if you want to read current UI language in a non-KonText way                 |
+------------------+------------------------------------------------------------------------------+


Authentication plugin notes
===========================

The application expects you to provide a custom implementation of authentication module. If you want to test the
application without (almost) any programming you can use provided *dummy_auth.py* module which authenticates any user
and always returns the same list of corpora (you probably want to set your own list).

To be able to provide different lists of corpora for different users, you have to implement an authentication
module with the following properties:

  * the module resides in the *plugins* package (= *./lib/plugins* directory)
  * contains function *create_instance(settings)* which creates and returns a new instance of your authentication object.
    The *settings* parameter is KonText's *settings* module or some compatible one. This
    provides access to any required configuration parameter (e.g. database connection if you need one).

Authentication object is expected to implement following methods: ::

    def validate_user(self, username, password):
        """
        Returns bool
        """
        pass

Returns True on success else False and changes the state of your authentication object to reflect user's properties ::

    def get_corplist(self):
        pass

Returns list/tuple containing identifiers of corpora available to the logged user. ::

    def is_administrator(self):
        pass

Returns True if the user is admin else False is returned.
::

    def anonymous_user(self):
        """
        returns a dictionary containing anonymous user credentials
        """
        pass

If a password update interface is required then the following additional methods must be implemented: ::

    def update_password(self, new_password):
        pass


    def validate_password(self, password):
        """
        tests whether provided password matches user's current password
        """
        pass

    def validate_new_password(self, password):
        """
        tests whether provided password candidate matches required password
        properties (like length)
        """
        pass

    def get_required_password_properties(self):
        """
        returns a text describing what are the properties of a valid password
        """
        pass

In case you want to use some other web application to log-in/log-out your users you have also to specify following
methods telling the KonText where a user should be redirected: ::

    def get_login_url(self):
        """
        returns URL of *login* action (because in general, it may be outside the application)
        """
        pass

    def get_logout_url(self):
        """
        returns URL of *logout* action (because in general, it may be outside the application)
        """
        pass


Class auth.AbstractAuth can be used as a base class when implementing custom authentication object. It already provides
some required methods.

The "appbar" plugin
===================

This optional plugin provides a way how to integrate KonText to an existing group of applications sharing some
visual page component (typically, a top-positioned toolbar - like e.g. in case of Google applications).

Such page component may provide miscellaneous information (e.g. links to your other applications, knowledge base
links,...) but it is expected that its main purpose is to provide user-login status and links to shared login/logout
website. KonText uses this plugin to fetch an HTML fragment of such "toolbar". The HTML data is loaded internally
(between KonText's hosting server and a "toolbar provider" server, via HTTP) and rendered along with KonText's own
output.

Please note that if you configure "appbar" plugin then KonText will stop showing its own authentication information
and login/logout links.

Because of its specific nature, the "appbar" plugin is instantiated in a slightly different way from other plugins.
Module your plugin resides in is expected to implement following factory method::

    def create_instance(conf, auth_plugin):
        pass

This means that even if your "appbar" implementation does not need an *auth_plugin* instance you still must implement
compatible *create_instance* method::

    def create_instance(conf, *args, **kwargs):
        return MyAppBarImplementation()

Your plugin object is expected to implement single method *get_contents*::

    def get_contents(self, cookies, current_lang):
        pass

*cookies* is a *BonitoCookie(Cookie.BaseCookie)* instance providing dictionary-like access to cookie values,
*current_lang* is a string representing selected language (e.g. en_US, cs_CZ). In general *cookies* is expected to
contain a ticket of some kind you can validate via your *auth_plugin* and *current_lang* is useful if you want to
notify your toolbar/app-bar/whatever content provider which language is currently in use.

The "getlang" plugin
====================

This optional plugin allows you to obtain language settings set by some other application (i.e. you want to have a shared
toolbar with centralized authentication and user interface settings).

It is required to implement a single method::

    def fetch_current_language(self, cookie):
        pass

where *cookie* is an instance of *Cookie.BaseCookie*

Additionally, you can implement also a method to get a fallback language in case your "other application" sets some
language your version of KonText does not support.::

    def get_fallback_language(self):
        pass


----------------------
Deployment and running
----------------------

To be able to be deployed and run, the application requires some additional file post-processing to be done. These
steps also depend on whether the application runs in *debugging* or *production* mode.

All the required tasks are configured to be performed by `Grunt <http://gruntjs.com/>`_ task automater (see file
*Gruntfile.js*).

Debugging mode
==============

This can be set in *config.xml*'s */kontext/global/debug* by putting *true*.

  * file post-processing:

    * \*.tmpl files must be compiled by Cheetah templating compiler
  * LESS dynamic stylesheets are translated to CSS on client-side
  * server-side errors are displayed in a raw form (i.e. page layout disappears and Python stack-trace is shown with some
    description)


Production mode
===============

This can be set in *config.xml*'s */kontext/global/debug* by setting the value *false*.

  * file post-processing:

    * \*.tmpl files must be compiled by Cheetah templating compiler
    * LESS dynamic stylesheets must be compiled (optionally minified) and merged into a single CSS file
    * optionally, JavaScript can be minimized

If you have a working node.js and Grunt (grunt-cli package) installation, you can prepare KonText for deployment just by
running *grunt* command in application's root directory.

-------------
Configuration
-------------

KonText is configured via an XML configuration file located in the root directory of the application
(do not confuse this with the root directory of the respective web application).
By default KonText loads its configuration from the path *../config.xml*. This can be overridden by setting an environment
variable *KONTEXT_CONF_PATH* (in case of Apache this is done by the *SetEnv* directive).

The configuration XML file is expected to be partially customizable according to the needs of 3rd party plugins.
Generally it has two-level structure: *sections* and *key->value items* (where value can be also a list of items (see
e.g. */kontext/corpora/default_corpora*). Some parts of the file with specific structure can be also processed by
dedicated functions or modules.

The structure can be understood from the following example::

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

Custom sections and items should have attribute *extension-by* where value identifies you, your project or your
installation ::

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


The value of the attribute is then used as a prefix to access custom items. While core configuration items are accessible
via two parameters *[section_name]* and *[item_name]* in case of custom values it is *[value_of_extension_for:section_name]*
or *[value_of_extension_for:item_name]*. If you define your custom section as shown in the previous code example
then you must use following call to obtain for example the value *value1*::

    settings.get('acme:my_section', 'key1')

Please note that items of your custom section are accessed without any prefix (because whole section is custom).

You can also add a custom item to a KonText-fixed section ::

    <kontext>
        <global>
        ...
          <my_item extension-by="acme">foo</my_item>
        </global>
        <corpora>
        ...
        </corpora>
    </kontext>

Such value is then accessible via following call ::

    settings.get('global', 'acme:my_item')

Sample configuration file **config.sample.xml** provides more examples.

Global configuration
====================

+------------------------------------------------+-------------------------------------------------------------------+
| Xpath                                          | Description                                                       |
+================================================+===================================================================+
| /kontext/global/manatee_path                   | If you want to use some non-default path to be searched by        |
|                                                | Python when looking for manatee library, you can define it here   |
+------------------------------------------------+-------------------------------------------------------------------+
| /kontext/global/debug                          | true/false (true => detailed error info is visible etc.)          |
+------------------------------------------------+-------------------------------------------------------------------+
| /kontext/global/log_path                       | Path to the logging file (webserver must have write access)       |
+------------------------------------------------+-------------------------------------------------------------------+
| /kontext/global/administrators                 | List of usernames with administrative rights; this is deprecated  |
+------------------------------------------------+-------------------------------------------------------------------+
| /kontext/global/fonts                          | list of custom CSS fonts to be loaded within HTML document        |
+------------------------------------------------+-------------------------------------------------------------------+
| /kontext/global/translations                   | list of supported languages for user interface (this requires     |
|                                                | proper *\*.mo* file and also enabled support in your OS)          |
+------------------------------------------------+-------------------------------------------------------------------+
| /kontext/global/translations/language          | language item - besides language code, it may contain *label*     |
|                                                | attribute - if defined then the label is shown to user            |
+------------------------------------------------+-------------------------------------------------------------------+


Plugins configuration
=====================

+-------------------------------------------------+-------------------------------------------------------------------+
| Xpath                                           | Description                                                       |
+=================================================+===================================================================+
| /kontext/plugins                                | this section contains plugins' configuration; each plugin         |
|                                                 | requires at least *module* element to specify where code resides  |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/plugins/db                             | required plugin to access application's database                  |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/plugins/auth                           | required plugin for authentication                                |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/plugins/sessions                       | required plugin implementing session storage functions            |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/plugins/settings_storage               | required plugin specifying where and how to store user settings   |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/plugins/query_storage                  | optional plugin allowing to store query history to some storage   |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/plugins/appbar                         | optional plugin allowing remote-loaded toolbar on all pages       |
+-------------------------------------------------+-------------------------------------------------------------------+

Caching configuration
=====================

+------------------------------------------------+------------------------------------------------------------------+
| Xpath                                          | Description                                                      |
+================================================+==================================================================+
| /kontext/cache/clear_interval                  | number of seconds to keep cached files                           |
+------------------------------------------------+------------------------------------------------------------------+

Corpus-related configuration
============================

+-------------------------------------------------+-------------------------------------------------------------------+
| Xpath                                           | Description                                                       |
+=================================================+===================================================================+
| /kontext/corpora/manatee_registry               | Path where corpora registry files are stored                      |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/options_dir                    | Path where 'options' files are stored                             |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/cache_dir                      | Path where application stores general cached data                 |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/subcpath                       | Path where general subcorpora data is stored                      |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/users_subcpath                 | Path where user's subcorpora are stored                           |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/tags_src_dir                   | A directory where all unique tag combinations for corpora are     |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/tags_cache_dir                 | A directory where tag-builder stores its auxiliary data           |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/conc_dir                       | Path where general concordance data is stored                     |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/helpsite                       | URL of the help site (refer to the config.sample.xml)             |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/default_corpora                | Contains list of default corpora (see below)                      |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/default_corpora/item           | Represents individual default corpus (multiple allowed)           |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/speech_segment_struct_attr     | Name of the structural attribute delimiting speeches              |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/speech_files_path              | root path where audio files containing speech segments are stored |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/kwicline_max_context           | Maximum size (in words) of the KWIC context                       |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/use_db_whitelist               | 0/1 (0 => any user has access to any corpus)                      |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/empty_attr_value_placeholder   | An alternative string to show if some structattr is empty         |
+-------------------------------------------------+-------------------------------------------------------------------+
| /kontext/corpora/multilevel_freq_dist_max_levels| Multi-level freq. distrib. - max. number of levels for a query    |
+-------------------------------------------------+-------------------------------------------------------------------+

Corpora hierarchy
=================

Corpora hierarchy serves as a source for the 'tree-like' corpus selection tool which is handled by the *corptree*
plugin. It supports nested (i.e. multi-level) organization::

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

Please note that you do not have to put the *corplist* subtree into the *config.xml* file. *Corptree* can be configured
to load any XML file and search for the tree node anywhere you want.


Tag-builder component configuration
===================================

Currently, KonText supports a single tagset helper tool which allows creating tag queries in an interactive way.

Sample file::

  <kontext>
  ...
    <corpora>
      ...
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
      ...
    </corpora>
    ...
  </kontext>
