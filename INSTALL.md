Installation instructions
=========================

Web server configuration
------------------------

KonText can be run in two modes:

### Standalone server application

In this case a web-server functionality is provided by KonText itself. Such solution is best suited for
testing/development purposes and for low-load deployments. This mode can be activated by a following command::

```shell
  python public/app.py --address [IP address] --port [TCP port]
```

(*--address* and *--port* parameters are optional; default serving address is 127.0.0.1:5000)

### WSGI application within a web-server

KonText can be run in a WSGI-enabled web server (e.g. Apache 2.x + mod_wsgi). This is recommended for
production deployments.

Define a loadable configuration file for your Apache 2 installation or update some of existing configuration files::

```
  Alias /kontext /path/to/your/app/public

  <Directory /path/to/your/app/public>
    Options +ExecCGI
    AddHandler cgi-script .cgi
    AllowOverride FileInfo
    RewriteEngine On
    RewriteRule ^$ run.cgi/first_form [L,R=301]
  </Directory>
```

VirtualHost-based configuration is possible too. Please refer to the
[Apache documentation](http://httpd.apache.org/docs/2.2/) for more information.

Please note that Apache's document root should be set to the *public* subdirectory
of the application to prevent access to configuration files, source code and other sensitive data.

Using shown configuration, your web application should be available at URL *http://your_server_hostname/kontext* .

Plugin approach
---------------

Because it is impossible to implement KonText in such a way that fits all the possible requirements in terms of
integrability into existing information systems, some parts of the application are implemented as plug-ins with
predefined interface.

For example, if you have an existing user database or if you do not want to bother with user authentication at all
you can easily implement your own version of the *auth* plugin. If you for example want to store user session data to
files instead of a database, all you have to do is to rewrite the *sessions* plugin appropriately.

You can start by exploring plugins we use in our institute - they are included in the *plugins* directory and have
*ucnk_* prefix.


### Client-side implementation notes

Specifications of some plugins include also a client-side functionality. In such cases you have to implement or
configure some existing solution. Plu-in must be defined as an [AMD](https://github.com/amdjs/amdjs-api) compatible
module. A minimal implementation may look like in the following sample

```js
define([], function () {
var lib = {};

    lib.init = function () {};
    return lib;
});
```


### Server-side implementation notes

In general, a plugin is a Python object defined in a Python module. the module must implement factory function
*create_instance*

```python
def create_instance(settings, *args, **kwargs):
    return MyPluginImplementation()
```

The factory function should create and return a plugin object. Because plugins are instantiated early in the request
processing workflow, it is sometimes necessary to perform additional configuration after *CGIPublisher* object is fully
operational. In such cases, the plugin can implement a method *setup*:

```python
def setup(self, **kwargs):
    pass
```

### A note for developers

When implementing an optional plugin you can make it dependent on both default and optional plugins. The only thing
to be aware of is that optional plugin dependencies in *app.py* must be specified using strings (i.e. you cannot
directly use the package *plugins*) because when Python interpreter reads optional plugins configuration no optional
plugin is instantiated yet.

It is also recommended to add at least following information to a plugin's module docstring:

    * 3rd party libraries needed to run the plugin
    * required config.xml entries to properly configure the plugin


List of currently supported plugins
-----------------------------------

Following plugins are mandatory:


| id               | description                                                                  | client-side code |
|------------------|------------------------------------------------------------------------------|------------------|
| auth             | user authentication                                                          | No               |
| db               | provides a connection to a database (if required by other plugins)           | No               |
| query_storage    | stores recent queries entered by users and allows their reopening            | No               |
| sessions         | handles user sessions (i.e. between-requests persistence)                    | No               |
| settings_storage | stores users' settings to a persistent storage                               | No               |

Following plugins are optional:

| id               | description                                                                  | client-side code |
|------------------|------------------------------------------------------------------------------|------------------|
| application_bar  | loads a between-app-shared page element (e.g. a bar at the top of the page)  | No               |
| corptree         | loads a hierarchy of corpora from an XML file                                | No               |
| getlang          | if you want to read current UI language in a non-KonText way                 | No               |
| live_attributes  | When filtering searched positions by attribute value(s), this provides a knowledge which values of currently unused (within the selection) attributes are still applicable.  | Yes              |
| query_storage    | KonText may store users' queries for further review/reuse                    | No               |


### The "db" plugin

The "db" plugin provides a connection to a database. An implementation must provide following method:

```python
def get(self):
    """
    returns a database connection object
    """
    pass
```

### The "auth" plugin

The application expects you to provide a custom implementation of authentication module. If you want to test the
it without (almost) any programming you can use provided *dummy_auth.py* module which authenticates any user
and always returns the same list of corpora (you probably want to set your own list).

Authentication object is expected to implement the following methods:

```python
def validate_user(self, username, password):
    """
    Returns bool
    """
    pass
```

Returns True on success else False and changes the state of your authentication object to reflect user's properties

```python
def logout(self, session_id):
    pass
```

Changes current user's status to an 'anonymous' user.

```python
def get_corplist(self, user):
    pass
```

Returns list/tuple containing identifiers of corpora available to the *user* (= username).

```python
def is_administrator(self):
    pass
```

Returns True if the current user has administrator's privileges else False is returned.

```python
def anonymous_user(self):
    """
    returns a dictionary containing anonymous user credentials
    """
    pass
```

If a password update page is required to be active then the following additional methods must be implemented:

```python
def update_user_password(self, new_password):
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
```

KonText supports log-in/log-out in two different ways:

1. within KonText application (i.e. log-in/log-out pages are within KonText and KonText also cares about user
   credentials validation)
2. outside KonText application (log-in/log-out pages and user session validation are defined outside KonText)

Because of that, all the *auth* plugins must implement methods which tell the KonText where log-in/log-out pages are:

```python
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
```


Class *auth.AbstractAuth* can be used as a base class when implementing custom authentication object. It already
provides some of required methods.

In case you want to implement "outside KonText" authentication variant, an additional method *revalidate* must
be implemented:

```python
def revalidate(cookies, session):
    pass
```

KonText call this method (if it is provided by your plugin) during session initialization. If an external service
responds user is logged in no more, method *revalidate* should change user's session data to an "anonymous user".

### The "sessions" plugin

The *sessions* plugin is expected to handle web sessions where users are identified by some cookie
*(key, value)* pair.

```python
def start_new(self, data=None):
    """
    starts a new session

    returns a dictionary {'id': session_id, 'data': data}
    """
    pass

def delete(self, session_id):
    """
    Deletes session identified by session_id
    """
    pass

def load(self, session_id, data=None):
    """
    Loads existing session from a storage

    returns  {'id': session_id, 'data': ...}
    """
    pass

def save(self, session_id, data):
    """
    Saves session data to a storage
    """
    pass

def delete_old_sessions(self):
    """
    This function should provide some cleaning mechanism for old/unused sessions.
    It is called by KonText from time to time.
    """
```

### The "settings_storage" plugin

This plugin allows users to store their concordance view settings. In general, it does not matter what kind of storage
is used here but KonText always provides a database connection plugin (if defined). ::

```python
def __init__(self, conf, db):
    """
    arguments:
    conf -- the 'settings' module (or some compatible object)
    db -- a database connection
    """
    pass

def save(self, user_id, data):
    """
    saves user data (encoded to JSON) to a storage
    """
    pass

def load(self, user_id, current_settings=None):
    """
    loads user data from a storage and decoded them from
    JSON to a Python dict/list/etc. types
    """
    pass
```

### The "corptree" plugin"

The *corptree* plugin reads a hierarchical list of corpora from an XML file (it can be part of *config.xml* but not
necessarily). Enclosed version of the plugin requires the following format:

```xml
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
```

Attributes for the **corplist** element:


| attr. name   | description         |
|--------------|---------------------|
| title        | name of the group   |

Attributes for the **corpus** element:


| attr. name      | description                                                        |
|-----------------|--------------------------------------------------------------------|
| id              | name of the corpus (as used within registry files)                 |
| sentence_struct | structure delimiting sentences                                     |
| num_tag_pos     | number of character positions in a tag                             |
| web             | (optional) external link containing information about the corpus   |

Please note that you do not have to put the *corplist* subtree into the *config.xml* file. *Corptree* can be configured
to load any XML file and search for the tree node anywhere you want.


### The "appbar" plugin

This optional plugin provides a way how to integrate KonText to an existing group of applications sharing some
visual page component (typically, a top-positioned toolbar - like e.g. in case of Google applications).

Such page component may provide miscellaneous information (e.g. links to your other applications, knowledge base
links etc.) but it is expected that its main purpose is to provide user-login status and links to an external
authentication page. KonText uses this plugin to fetch an HTML fragment of such "toolbar". The HTML data is loaded
internally (between KonText's hosting server and a "toolbar provider" server, via HTTP) and rendered along with
KonText's own output.

Please note that if you configure *appbar* plugin then KonText will stop showing its own authentication information
and login/logout links.

Because of its specific nature, the "appbar" plugin is instantiated in a slightly different way from other plugins.
Module your plugin resides in is expected to implement following factory method

```python
def create_instance(conf, auth_plugin):
    pass
```

This means that even if your *appbar* implementation does not need an *auth_plugin* instance you still must implement
compatible *create_instance* method:

```python
def create_instance(conf, *args, **kwargs):
    # all the arguments KonText passes are covered by *args and **kwargs
    return MyAppBarImplementation()
```

Your plugin object is expected to implement a single method *get_contents*::

```python
def get_contents(self, cookies, current_lang, return_url=None):
    pass
```

*cookies* is a *BonitoCookie(Cookie.BaseCookie)* instance providing dictionary-like access to cookie values,
*current_lang* is a string representing selected language (e.g. en_US, cs_CZ). In general *cookies* is expected to
contain a ticket of some kind you can validate via your *auth_plugin* and *current_lang* is useful if you want to
notify your toolbar/app-bar/whatever content provider which language is currently in use. Argument *return_url*
serves in case user leaves KonText to some of *appbar*'s pages and these pages are able to navigate him back to
KonText (typically, user logs in and expects to be redirected back).

### The "getlang" plugin

This optional plugin allows you to obtain language settings set by some other application (i.e. you want to have a
shared toolbar with centralized authentication and user interface settings).

It is required to implement a single method::

```python
def fetch_current_language(self, cookie):
    pass
```

where *cookie* is an instance of *Cookie.BaseCookie*

Additionally, you can implement also a method to get a fallback language in case your "other application" sets some
language your version of KonText does not support.

```python
def get_fallback_language(self):
    pass
```


### The "live_attributes" plugin

*[currently in development]*

This is an optional plugin allowing to obtain all the attribute values according to some attribute subset selection.

Let's say you have the following structural element defined in your corpus::

```xml
<doc translated="[true|false]" author="[name of the author]" type="[poetry|fiction]">
```

Let's also assume you have no translated fiction works in your corpus and you pass a query:

```json
{"doc.type": "fiction"}
```

The plugin should return valid values of all other attributes as found in structural elements
where *doc.type == 'fiction'* (your passed values should be included too). Your answer may look like the
following example:

```json
{
    "doc.type": ["fiction"],
    "doc.translated": ["false"],
    "doc.author": ["Isaac Asimov", ..., "Émile Zola"]
}
```

This allows user to select desired attributes when creating a query or a subcorpus in a more convenient way.


Deployment and running
----------------------

To be able to be deployed and run, *KonText* requires some additional file post-processing to be performed. These
steps also depend on whether the *KonText* runs in *debugging* or *production* mode.

All the required tasks are configured to be performed by [Grunt](http://gruntjs.com/) task automater (see file
*Gruntfile.js*).

### Debugging mode

This can be set in *config.xml*'s */kontext/global/debug* by putting *true*.

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
running *grunt* command in application's root directory.


KonText configuration
---------------------

KonText is configured via an XML configuration file located in the root directory of the application
(do not confuse this with the root directory of the respective web application).
KonText loads its configuration from path *../config.xml*.

The configuration XML file is expected to be partially customizable according to the needs of 3rd party plugins.
Generally it has two-level structure: *sections* and *key->value items* (where value can be also a list of items (see
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
| /kontext/global/log_path                       | Path to the logging file (webserver must have write access)       |
| /kontext/global/administrators                 | List of usernames with administrative rights; this is deprecated  |
| /kontext/global/fonts                          | list of custom CSS fonts to be loaded within HTML document        |
| /kontext/global/translations                   | list of supported languages for user interface (this requires proper *\*.mo* file and also enabled support in your OS)   |
| /kontext/global/translations/language          | language item - besides language code, it may contain *label* attribute - if defined then the label is shown to user    |


### Plugins configuration

| Xpath                                           | Description                                                       |
|-------------------------------------------------|-------------------------------------------------------------------|
| /kontext/plugins                                | This section contains a configuration of plugins. Each plugin has its own subtree with a root element named with the name of the respective plugin (e.g. *auth*, *db*, *getlang*). This element must contain at least a *module* element specifying the name of the Python package implementing the plugin. See the *config.sample.xml* |


### Caching configuration

| Xpath                                          | Description                                                      |
|------------------------------------------------|------------------------------------------------------------------|
| /kontext/cache/clear_interval                  | number of seconds to keep cached files                           |


### Corpus-related configuration

| Xpath                                           | Description                                                       |
|-------------------------------------------------|-------------------------------------------------------------------|
| /kontext/corpora/manatee_registry               | Path where corpora registry files are stored                      |
| /kontext/corpora/options_dir                    | Path where 'options' files are stored                             |
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

Currently, KonText supports a single tagset helper tool which allows creating tag queries in an interactive way.

Sample file:

```xml
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
```
