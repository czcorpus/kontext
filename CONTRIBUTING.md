Contributing to KonText
=======================

Workflow
--------

* create a fork of the [repository](https://github.com/czcorpus/kontext)
* create you feature branch from the *master* branch
  * be sure to keep your repository in sync with upstream
* once your changes are ready, create a pull request

Coding style
------------

### Python code

* [PEP8 Style Guide](https://www.python.org/dev/peps/pep-0008/)
  * line length of *100* characters


### Client-side code in general

* prefer *TypeScript* over *JavaScript*
  * *React* views are an exception - use JSX there
* action models/stores are located in *public/files/js/tpl*
* *React* views are located in *public/files/js/views*
* plugin-related modules are in *public/files/js/plugins*

### JavaScript

* use [AMD](http://requirejs.org/docs/whyamd.html#amd) modules
* new *JavaScript* modules should be accompanied with a *.d.ts* file 
  (see [Writing .d.ts files](http://www.typescriptlang.org/Handbook#writing-dts-files))

### TypeScript

* constructs from versions up to *1.4* (included) are supported
  * changes in support towards newer versions will be announced here
* try to minimize use of the *any* type
* prefer existing types from *ts/declarations/common.d.ts* and *tpl/document.ts* over defining 
  your own ones



License
-------

By contributing to KonText, you agree that your contributions will be licensed under its 
GNU General Public License version 2.