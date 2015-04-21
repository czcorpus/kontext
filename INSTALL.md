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

KonText can be run within a WSGI-enabled web server (e.g. Apache 2.x + [mod_wsgi](https://code.google.com/p/modwsgi/)).
This is the recommended mode for production deployments.

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

*Important notice*: please note that the line *WSGIProcessGroup %{GLOBAL}* must be always present in this concrete
form as in other case you may experience occasional error responses from Apache server
(see [mod_wsgi documentation](https://code.google.com/p/modwsgi/wiki/ApplicationIssues#Python_Simplified_GIL_State_API) for details).

Installation into an Apache [Location](http://httpd.apache.org/docs/current/mod/core.html#location) is also possible.
Please refer to the [Apache documentation](http://httpd.apache.org/docs/2.2/) for more information.

Please always keep in mind to have only *public* directory accessible by web clients to prevent them viewing
configuration files, source code and other sensitive data.

Plug-ins
--------

Because it is impossible to implement KonText in such a way that fits all the possible requirements in terms of
integrability into existing information systems, some parts of the application are implemented as plug-ins with
predefined interface.

For example, if you have an existing user database or if you do not want to bother with user authentication at all
you can easily implement your own version of the *auth* plug-in. If you for example want to store user session data to
files instead of a database, all you have to do is to rewrite the *sessions* plug-in appropriately.

You can start by exploring prepackaged plug-ins located in the *lib/plugins* directory. To make clear which methods
are required it is advisable to explore and inherit from abstract plug-in classes in *lib/plugins/abstract* directory.

### The fastest way to make the plug-ins work

KonText comes with two prepackaged plug-in series, both located in *lib/plugins* directory:

1. modules with prefix *ucnk_*
    * they fit specific needs of the Institute of the Czech National Corpus
    * most likely they cannot be used directly in your specific environment but you can still explore them to find out how
    the thing works
2. modules with prefix *default_* (with one additional module *redis_db.py*; see below)
    * they provide a complete, working set of plugins needed to run KonText with all the features enabled
    * there are two database backends available for *default_* modules; both provide key-value storage interface
      (see *plugins.abstract.general_storage.KeyValueStorage*):
        * [sqlite3](http://www.sqlite.org/)-based ([Python module](https://pypi.python.org/pypi/pysqlite)) for testing 
        and small installations
        * [Redis](http://redis.io/)-based ([Python module](https://pypi.python.org/pypi/redis/)) for production installations
    * an initial user import must be performed - for this purpose, a script *scripts/plugins/default_query_storage* is available
     (see also *userdb.sample.json* file to find out how to prepare initial user database)


The only thing to do when using *default_* plug-ins is to properly configure KonText. You can start with the
*config-sample.xml* file which has *default_* plugins set already.


### Client-side implementation notes

Some of the plug-ins include also a client-side functionality which for example enriches user interface benefiting from
plug-in's server-side services. Unless you want to change user interface in some way there will probably no need
to modify the client-side code of prepackaged plug-ins even if you rewrite the server-side from scratch.

Client-side plug-in must be defined as an [AMD](https://github.com/amdjs/amdjs-api) compatible module. A sample
implementation may look like in the following code:

```js
define(['jquery'], function ($) {
var lib = {};

    lib.init = function () {
        var button = $('<button>');

        button.text('say hello');
        button.on('click', function () {
            console.log('hello');
        });
        $('#mainform').append(button);
    };

    return lib;
});
```
Additional notes:

* Available 3rd party libraries include *jQuery*, *jQuery-cookies plug-in*, *soundmanager2*, *typeahead*, *virtual-keyboard*.
* JavaScript code related to a concrete page can be found in *public/files/js/tpl/page_name*.
* Plug-ins are located in *public/files/js/plugins/pluginNameCamelCase*
* New client-side libraries and plug-ins are written in [TypeScript](http://www.typescriptlang.org/).
* Currently there is no solution for additional CSS files (i.e. adding a new plug-in with some UI representation requires
you to edit existing CSS/LESS file *widgets.less*).

### Server-side implementation notes

In general, a plug-in is a Python object defined in a Python module. The module must implement a factory function
*create_instance*

```python
def create_instance(settings, *args, **kwargs):
    return MyPluginImplementation()
```

The factory function should create and return a plug-in object. Because plug-ins are instantiated early in the request
processing workflow, it is sometimes necessary to perform an additional configuration after *Controller* object is fully
operational. In such cases, the plug-in can implement a method *setup*:

```python
def setup(self, controller_obj):
    # ask Controller something as it is already initialized
    pass
```

This (optional) method is called in the end of the *_pre_dispatch()* operation. It means that all the properties
of the controller are already set and available.

But there is an important difference between *setup()* and *create_instance()*. Please recall the fact that there
is always a single instance of a plug-in serving all the requests (within a single process). But in case of the *setup()*
method, each request may pass different parameters and in a concurrent way. It means that all the request-specific data 
(e.g. the language a client uses) must be thread-local. To accomplish that you can inherit for such purpose from *structures.ThreadLocalData*
which provides convenience methods like *setlocal*, *getlocal*, *haslocal*:

```python
class ExtendedTutorialPlugin(structures.ThreadLocalData):
  def __init__(self):
    super(MyPlugin, self).__init__(('prefetch_job',))  # we have to specify thread-local value(s) explicitly here

  def setup(self, controller_obj):
    self.setlocal('prefetch_job', self.preload_user_tutorial(controller_obj.session_get('user', 'id')))

  def get_tutorial_info(self, chapter_id):
    job = self.getlocal('prefetch_job')
    job.join()
    return job.value
```

It should be noted that in case of KonText core plug-ins, a stateless solution (i.e. the one without need for calling
plugin.setup()) can be usually found.

```python
def export(self):
    return { '...JSON serializable data...'}
```

The optional *export* method is called by KonText after an action is processed. It is expected
to return a JSON-serializable data which are then passed to the current template's client-side
model:

```js
require(['tpl/layoutModel', 'tpl/myPage'], function (layoutModel, pageModel) {
    pageModel.doSomething(layoutModel.getConf('pluginData')['my_plugin']);
});
```


### Notes for developers

Plug-ins are configured in *config.xml* under */kontext/global/plugins*. Although three different names for different
contexts can be used for a single plug-in in theory:

1. a name of a module/file containing the plug-in implementation
2. a dynamically created module attached to the *plugins* package (see *app.py*)
3. a name of a tag in *config.xml*

it is a good practice to use a single name/id. E.g. if you implement a module
*corpus_enhancer* then:

1. your respective Python file should be *lib/plugins/corpus_enhancer.py*
2. plug-in configuration should look like this:
```xml
<kontext>
  <global>
    <plugins>
      <corpus_enhancer>
        <module>corpus_enhancer</module>
        ... additional configuration ...
      </corpus_enhancer>
      ...
    </plugins>
    ...
  </global>
</kontext>
```
3. And the registration (which defines a dynamically created module) in *app.py* will look like this:
```python
optional_plugins = (
    # ... existing KonText plug-ins ...
    ('corpus_enhancer', (dependency1, dependency2,...))
)
```

When implementing an optional plug-in, you can make it dependent on both default and optional plug-ins. These dependencies
are passed as arguments to your *factory function*. The only thing to be aware of is that optional plug-in dependencies
in *optional_plugins* (file *app.py*) must be specified using strings (i.e. you cannot directly use the package *plugins*)
because when Python interpreter executes the optional plug-ins configuration no optional plug-in is instantiated yet.

In the following example we define *my_plugin* with two dependencies:
 1. *settings* is a required plug-in (=> it is already instantiated and we can refer it as any other module)
 2. *some_optional_plugin* is an optional plug-in (=> it cannot be guaranteed to be loaded yet and must refer it via a string).

```python
optional_plugins = (
        # ...
        ('my_plugin', ('some_optional_plugin', settings)),
        # ...
)
```

It is also recommended to add at least following information to plug-in's module docstring:

    * 3rd party libraries needed to run the plug-in
    * required config.xml entries to properly configure the plug-in
    * required database schema if any


List of currently supported plug-ins
------------------------------------

### mandatory plug-ins


| id                                           | description                                                                  | client-side code |
|----------------------------------------------|------------------------------------------------------------------------------|------------------|
| [auth](#plugin_auth)                         | user authentication                                                          | No               |
| [db](#plugin_db)                             | provides a connection to a database (if required by other plug-ins)          | No               |
| [sessions](#plugin_sessions)                 | handles user sessions (i.e. between-requests persistence)                    | No               |
| [settings_storage](#plugin_settings_storage) | stores users' settings to a persistent storage                               | No               |
| [conc_cache](#plugin_conc_cache) | caches calculated concordances | No |
| [export](#plugin_export) | exports data sets into file formats (TXT, XML, XLSX, CSV,...) | No |

### optional plug-ins

| id               | description                                                                  | client-side code |
|------------------|------------------------------------------------------------------------------|------------------|
| application_bar  | loads a between-app-shared page element (e.g. a bar at the top of the page)  | No               |
| [corptree](#plugin_corptree)        | loads a hierarchy of corpora from an XML file                                | No               |
| [getlang](#plugin_getlang)          | if you want to read current UI language in a non-KonText way                 | No               |
| [live_attributes](#live_attributes)  | When filtering searched positions by attribute value(s), this provides a knowledge which values of currently unused (within the selection) attributes are still applicable.  | Yes              |
| query_storage    | KonText may store users' queries for further review/reuse                    | Yes              |
| [conc_persistence](#plugin_conc_persistence) | Allows storing queries/filters/etc. longer than URL can handle               | No               |
| [subc_restore](#plugin_subc_restore) | Stores and restores subcorpus creation queries | No | 


Plug-ins detailed information
-----------------------------

<a name="plugin_db"></a>

### The "db" plug-in

The "db" plug-in is kind of specific because it is not used directly by KonText core modules - it is available only to
other plug-ins. Generally speaking, "db" is expected to provide an interface to access a data storage engine
(SQL/NoSQL/whatever). This facts mean that there is no fixed interface required for a *db* plug-in. As soon as your
plug-ins understand your *db* implementation, everything is all right. 

The only thing to consider is the fact that there can be only one *db* plug-in at a time. E.g. if you have several 
plug-ins relying on prepackaged default/redis *db* plug-in and then you implement an additional plug-in using your 
existing SQL database, then you will have to implement/include a connection adapter by yourself.

The plug-ins KonText passes *db* to are:

* sessions
* settings_storage
* auth
* conc_persistence
* query_storage

<a name="plugin_auth"></a>

### The "auth" plug-in

Authentication plug-in object is expected to implement the following methods:

```python
def validate_user(self, username, password):
    """
    Returns bool
    """
    return {
        'id': 1234,
        'user': 'jdoe',
        'fullname': 'John Doe'
    }
```

Returns a dictionary containing core credentials (id, username, full name) of a user matching passed 
arguments. In case no valid user is found, then anonymous user credentials should be returned.
Please note that *anonymous* user is recognized via config.xml's */kontext/global/anonymous_user_id*
which means you have to ensure that the *id* key is equal to that value in case of anonymous
user.


```python
def logout(self, session_id):
    pass
```

Changes current user's status to the *anonymous* user. Typically, this is done by writing new
data into user's session. The method is not expected to return anything.

```python
def get_corplist(self, user_id):
    pass
```

Returns a list/tuple containing identifiers of corpora available to a user with ID = *user_id*.

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

KonText currently supports log-in/log-out in two different ways:

1. within KonText application (i.e. log-in/log-out pages are within KonText and KonText also cares about user
   credentials validation)
2. outside KonText application (log-in/log-out pages and user session validation are defined outside KonText)

Because of that, all the *auth* plug-ins must implement methods which tell the KonText where log-in/log-out 
pages are. In case of internal authentication this is simple:

```python
def get_login_url(self):
    """
    returns URL of *login* action (because in general, it may be outside the application)
    """
    return '%s/login' % a_server_address_and_path

def get_logout_url(self):
    """
    returns URL of *logout* action (because in general, it may be outside the application)
    """
    return '%s/logout' % a_server_address_and_path
```


Class *auth.AbstractAuth* can be used as a base class when implementing custom authentication object. It already
provides some of required methods.

In case you want to implement an "outside KonText" authentication variant, an additional method *revalidate* must
be implemented:

```python
def revalidate(cookies, session, query_string):
    pass
``` 

KonText calls this method (if it is provided by your plug-in) during session initialization. If an external service
responds that remote session ticket is invalid (= outdated, incorrect), method *revalidate* should change user's session 
data to an "anonymous user". The method does not necessarily have to check the ticket each time it is called. 
Once you validate new user session, you can keep user logged-in as long as KonText's own session is valid (then 
revalidation is performed again).
 
To be able to revalidate anonymous user once she returns from a remote authentication server with updated 
credentials, KonText redirects to the authentication server with parameter *remote=1*. The plug-in then may check
for it and force revalidation. The slight problem is that during the phase the method is called there are no
parsed request parameters available yet. For that reason KonText passes argument *query_string* to the method to
allow the plug-in custom parameter processing. 

<a name="plugin_sessions"></a>

### The "sessions" plug-in

The *sessions* plug-in is expected to handle web sessions where users are identified by some cookie
*(key, value)* pair. It is defined to be compatible with *Werkzeug's* sessions. It means you can
take *Werkzeug's* *werkzeug.contrib.sessions.FilesystemSessionStore* (see [documentation](http://werkzeug.pocoo.org/docs/0.10/contrib/sessions/)) and it will work with KonText.

```python
def generate_key(self, salt=None):
    """
    returns: string
    """
    pass

def delete(self, session_id):
    """
    Deletes session identified by session_id
    """
    pass

def get(self, session_id):
    """
    Loads existing session from a storage

    returns:  werkzeug.contrib.Session
    """
    pass

def is_valid_key(self, key):
    """
    returns: bool
    """
    pass

def new(self):
    """
    returns:  werkzeug.contrib.Session
    """
	pass

def save(self, session):
    """
    arguments:
    session -- werkzeug.contrib.Session
    """    
    pass

def save_if_modified(self, session):
    """
    arguments:
    session -- werkzeug.contrib.Session
    """
    pass
```

<a name="plugin_settings_storage"></a>

### The "settings_storage" plug-in

This plug-in allows users to store their concordance view settings. In general, it does not matter what kind of storage
is used here but KonText always passes a database connection plug-in (if defined) to the factory function *create_instance*.

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

<a name="plugin_conc_cache"></a>

### The "conc_cache" plug-in

The "conc_cache" plug-in provides functions needed by *lib/conclib.py* when calculating and caching concordances.
Currently it is not recommended to implement customized versions unless you know well what is going on during 
concordance calculation and caching. 

The safest way here is to stick with the *default_conc_cache*.

<a name="plugin_export"></a>

### The "export" plug-in

This is kind of a special plug-in in terms of its structure and configuration. The plug-in module itself is just a 
loader which loads and imports modules providing export to concrete formats (see *default_csv.py*, *default_xlsx.py* and
*default_xml.py*).

The configuration also differs from other plug-ins. There is no *module* element (because the *module* is in fact 
the mentioned loader located in the *exports* package) and custom export modules are specified within tags named 
by exported formats:

```xml
<export>
  <csv>default_csv</csv>
  <xml>default_xml</xml>
  <xlsx>default_xlsx</xlsx>
  <ods>my_custom_oo_export</ods>
</export>
```

Currently we recommend to use default configuration and modules. But in case you want to implement a custom format 
please note that KonText currently does not offer automatic menu and respective page forms update based on the *export* 
element. In other words, current export formats are hardcoded in main menu and page forms.

<a name="plugin_corptree"></a>

### The "corptree" plug-in"

The *corptree* plug-in reads a hierarchical list of corpora from an XML file (it can be part of *config.xml* but not
necessarily). Enclosed version of the plug-in requires the following format:

```xml
<corplist title="">
  <corplist title="Synchronic Corpora">
     <corplist title="SYN corpora">
       <corpus id="SYN2010" web="http://www.korpus.cz/syn.php" sentence_struct="s" tagset="czech_tagset" />
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
| ident           | name of the corpus (as used within registry files)                 |
| sentence_struct | structure delimiting sentences                                     |
| tagset          | (optional) tagset used by this corpus                              |
| web             | (optional) external link containing information about the corpus   |

Please note that you do not have to put the *corplist* subtree into the *config.xml* file. *Corptree* can be configured to load any XML file and search for the tree node anywhere you want.



### The "appbar" plug-in

This optional plug-in provides a way how to integrate KonText to an existing group of applications sharing some
visual page component (typically, a top-positioned toolbar - like e.g. in case of Google applications).

Such page component may provide miscellaneous information (e.g. links to your other applications, knowledge base
links etc.) but it is expected that its main purpose is to provide user-login status and links to an external
authentication page. KonText uses this plug-in to fetch an HTML fragment of such "toolbar". The HTML data is loaded
internally (between KonText's hosting server and a "toolbar provider" server, via HTTP) and rendered along with
KonText's own output.

Please note that if you configure *appbar* plug-in then KonText will stop showing its own authentication information
and login/logout links.

Because of its specific nature, the "appbar" plug-in is instantiated in a slightly different way from other plug-ins.
Module your plug-in resides in is expected to implement following factory method

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

Your plug-in object is expected to implement a single method *get_contents*::

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

<a name="plugin_getlang"></a>

### The "getlang" plug-in

This optional plug-in allows you to obtain language settings set by some other application (i.e. you want to have a
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

<a name="live_attributes"></a>

### The "live_attributes" plug-in

*[currently in development]*

This is an optional plug-in allowing to obtain all the attribute values according to some attribute subset selection.

Let's say you have the following structural element defined in your corpus::

```xml
<doc translated="[true|false]" author="[name of the author]" type="[poetry|fiction]">
```

Let's also assume you have no translated fiction works in your corpus and you pass a query:

```json
{"doc.type": "fiction"}
```

The plug-in should return valid values of all other attributes as found in structural elements
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

<a name="plugin_conc_persistence"></a>

### The "conc_persistence" plug-in

Original Bonito 2 and older KonText versions keep all the parameters required to specify a concordance (i.e. original
query, filters, samples etc.) in URL of a page. Although it is in general a good idea (links can be copied and accessed
by anyone, HTTP method types are not misused), the problem arises with the limited length of URL (starting circa from
2KB one cannot be sure that the application will work properly).

The *conc_persistence* plugin allows storing these parameters into a database and return a placeholder code which is
then passed via URL.

<a name="plugin_subc_restore"></a>

### The "subc_restore" plug-in

This plug-in is hooked up to subcorpus creation and deletion actions and archives all the necessary arguments to 
provide additional information in the subcorpus list page or to regenerate subcorpora outside current installation (which
is CNC's specific need).


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
