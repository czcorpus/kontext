==================
Installation guide
==================

Web server configuration
========================

Please note that currently only supported web server is Apache 2.x. Support for some other web servers is being considered.

Define a loadable configuration file for your Apache 2 installation or update some of existing configuration files::

  Alias /bonito /path/to/your/app

  <Directory /path/to/your/app>
    Options +ExecCGI
    AddHandler cgi-script .cgi
    AllowOverride FileInfo
    RewriteEngine On
    RewriteRule ^$ run.cgi/first_form [L,R=301]
    SetEnv REMOTE_USER default
  </Directory>


The value of the REMOTE_USER parameter ('default' here) is typically set by Apache's authentication mechanism
but in our sample we skip this.

Using described configuration, your web application should be available at URL http://your_server_hostname/bonito.

Authentication
==============

The application expects you to provide your custom implementation of authentication module. If you want to test the
application without (almost) any programming you can use provided *dummy_auth.py* module which authenticates any user
and always returns the same list of corpora (you probably want to set your own list).

To be able to provide different lists of corpora for different users, you have to implement an authentication
module with the following properties:

  * resides in a directory specified in *sys.path* (i.e. is importable without additional Python runtime configuration
  * contains function *create_instance(settings)* which creates and returns a new instance of your authentication object.
    The *settings* parameter is Bonito's *settings* module or some compatible one. This
    provides access to any required configuration parameter (e.g. database connection if you need one).

Authentication object is expected to have these properties:
  * implements method *login(username, password)* which returns bool value (True on success else False) and changes
    the state of your authentication object to reflect user's properties
  * implements method *get_corplist()* which returns list/tuple containing identifiers of corpora available to the
    logged user
  * implements method *is_administrator()* which returns True if the user is admin else False is returned
  * optionally the method *update_password(new_password)* may be implemented if such functionality is expected from
    Bonito



Deployment
==========

Copy/unpack your application directory/archive to the location of your choice and run the deployment script::

   ./scripts/deploy.sh

The script compiles HTML templates and then asks you for the location of the YUI compressor. If you don't want to minify
JavaScript and CSS files you can cancel it by pressing Ctrl^C. If you want to use this feature, please download latest
version of the YUI compressor from https://github.com/yui/yuicompressor/downloads.

Configuration
=============

The application itself is configured via config.xml file located in the root directory of the application.
Please refer to the **config.sample.xml** to see the structure.

+----------------------------------------------+-------------------------------------------------------------------+
| Xpath                                        | Description                                                       |
+==============================================+===================================================================+
| /bonito/global/manatee_path                  | Location of your Python interface to the manatee                  |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/global/debug                         | true/false (true => detailed error info is visible)               |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/global/log_path                      | Path to the logging file (Apache must have write access)          |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/global/administrators                | Contains elements 'user', each with single admin username         |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/global/auth_module                   | Name of a Python module to be used for authentication             |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/database/adapter                     | {mysql, sqlite}                                                   |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/database/name                        | Name (or path) of the database used with Bonito2                  |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/database/host                        | Hostname of the database server                                   |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/database/password                    | Password to the database                                          |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/database/username                    | Username of the user with SELECT and UPDATE privileges            |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/cache/clear_interval                 | number of seconds to keep cached files                            |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/manatee_registry             | Path where corpora registry files are stored                      |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/options_dir                  | Path where 'options' files are stored                             |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/cache_dir                    | Path where application stores general cached data                 |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/subcpath                     | Path where general subcorpora data is stored                      |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/users_subcpath               | Path where user's subcorpora are stored                           |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/tags_src_dir                 | A directory where all unique tag combinations for corpora are     |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/tags_cache_dir               | A directory where tag-builder widget stores some of its data      |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/conc_dir                     | Path where general concordance data is stored                     |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/helpsite                     | URL of the help site (refer to the config.sample.xml)             |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/default_corpora              | Contains list of default corpora (see below)                      |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/default_corpora/item         | Represents individual default corpus (multiple allowed)           |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/speech_segment_struct_attr   | Name of the structural attribute delimiting speeches              |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/speech_data_url              | URL where speech files are stored                                 |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/kwicline_max_context         | Maximum size (in words) of the KWIC context                       |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/use_db_whitelist             | 0/1 (0 => any user has access to any corpus)                      |
+----------------------------------------------+-------------------------------------------------------------------+
| /bonito/corpora/empty_attr_value_placeholder | An alternative string to show if some structattr is empty         |
+----------------------------------------------+-------------------------------------------------------------------+

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

