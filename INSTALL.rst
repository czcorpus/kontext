==================
Installation guide
==================

Apache
======

Define a loadable configuration file for your Apache 2 installation or update some of existing configuration files::

  Alias /bonito /path/to/your/app

  <Directory /path/to/your/app>
    Options +ExecCGI
    AddHandler cgi-script .cgi
    AllowOverride FileInfo
    RewriteEngine On
    RewriteRule ^$ run.cgi/first_form [L,R=301]
    AuthType Basic
    AuthName "Add your login message here."
    AuthGroupFile /dev/null
    AuthMySQL On
    AuthMySQL_Authoritative On
    AuthBasicAuthoritative Off
    AuthMySQL_Host localhost
    AuthMySQL_User bonito
    AuthMySQL_Password bonito
    AuthMySQL_DB bonito
    AuthMySQL_Password_Table user
    AuthMySQL_Username_Field user
    AuthMySQL_Password_Field pass
    AuthMySQL_Encryption_Types Crypt_DES
    require valid-user
  </Directory>

If you want to skip using mysql-based user authentication you can use following simplified version::

  Alias /bonito /path/to/your/app

  <Directory /path/to/your/app>
    Options +ExecCGI
    AddHandler cgi-script .cgi
    AllowOverride FileInfo
    RewriteEngine On
    RewriteRule ^$ run.cgi/first_form [L,R=301]
    SetEnv REMOTE_USER default
  </Directory>

Please note that the value of the REMOTE_USER variable ('default' in the example) is up to your choice but you have
to create user of that name in your database (see the following section).

Using one of described configurations, your web application should be available at URL http://your_server_hostname/bonito.

Database
========


Open your mysql console::

     mysql -u root -p

Create new database for your application::

     CREATE DATABASE your_db_name DEFAULT CHARSET UTF8;

Grant required privileges to the database user you want to use along with this application::

     GRANT SELECT, UPDATE ON your_db_name.* to 'some_username'@'database_hostname' IDENTIFIED BY 'some_password';

Typically, your database will run on the same hostname as the application itself::

    GRANT SELECT, UPDATE ON your_db_name.* to 'some_username'@'localhost' IDENTIFIED BY 'some_password';

Update the privileges information::

    FLUSH PRIVILEGES;

Leave mysql console and run the script to create required tables (we assume your current directory is bonito's
root directory)::

    mysql -u root -p < scripts/create-tables.sql


Corpora and users
=================

Bonito 2 does not provide web-based administration of the users which means you have to use mysql console or some
GUI client application (e.g. the PHPMyAdmin). Open mysql console again::

    mysql -u root -p

Define some corpus/corpora you want to publish::

    INSERT INTO corpora (name) VALUES ('some_corpora_name');
    INSERT INTO corpora (name) VALUES ('some_other_corpora_name');

Define a user::

    INSERT INTO user (user, pass, corplist, subcorp, fullname, email, regist, valid)
    VALUES ('some_username', ENCRYPT('some_password'), 'some_corpora_name some_other_corpora_name', 'yes',
    'fullname of the user', 'email of the user', NOW(), 1);

Please note that corpora names in **corplist** are separated by the whitespace.

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

+--------------------------------------------+-----------------------------------------------------------+
| Xpath                                      | Description                                               |
+============================================+===========================================================+
| /bonito/global/manatee_path                | Location of your Python interface to the manatee          |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/global/debug                       | true/false (true => detailed error info is visible)       |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/global/log_path                    | Path to the logging file (Apache must have write access)  |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/database/name                      | Name of the database used along with the application      |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/database/host                      | Hostname of the database server                           |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/database/password                  | Password to the database                                  |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/database/username                  | Username of the user with SELECT and UPDATE privileges    |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/cache/clear_interval               | number of seconds to keep cached files                    |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/manatee_registry           | Path where corpora registry files are stored              |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/options_dir                | Path where 'options' files are stored                     |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/cache_dir                  | Path where application stores general cached data         |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/subcpath                   | Path where general subcorpora data is stored              |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/users_subcpath             | Path where user's subcorpora are stored                   |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/tags_src_dir               | TODO (incoming feature)                                   |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/tags_cache_dir             | TODO (incoming feature)                                   |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/conc_dir                   | Path where general concordance data is stored             |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/helpsite                   | URL of the help site (refer to the config.sample.xml)     |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/default_corpus             | Name of the default corpus                                |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/alternative_corpus         | UNDOCUMENTED FEATURE                                      |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/speech_segment_struct_attr | Name of the structural attribute delimiting speeches      |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/speech_data_url            | URL where speech files are stored                         |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/kwicline_max_context       | Maximum size (in words) of the KWIC context               |
+--------------------------------------------+-----------------------------------------------------------+
| /bonito/corpora/use_db_whitelist           | 0/1 (0 => any user has access to any corpus)              |
+--------------------------------------------+-----------------------------------------------------------+


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

