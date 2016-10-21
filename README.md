![KonText](https://kontext.korpus.cz/files/themes/default/kontext-logo.png)

[![Build status](https://travis-ci.org/czcorpus/kontext.svg?branch=master)](https://travis-ci.org/czcorpus/kontext)

Introduction
------------

KonText is a **fully featured corpus query interface** for the [Manatee open](http://nlp.fi.muni.cz/trac/noske)
corpus search engine. It started as a fork of the Bonito 2.68 web interface and while still sharing
a lot of code with the original Bonito (now *bonito-open*), KonText is gradually becoming more independent.

It is maintained by the
[Institute of the Czech National Corpus](http://ucnk.ff.cuni.cz/).
Current version contains all the key features of the Bonito 2.98.3 (primarily a support for parallel
corpora).

Features
--------

### internal changes

* rewritten as a **WSGI application** (Bonito-open is CGI-based)
* modular code design with dynamically loadable plug-ins providing custom functionality implementation
* fully **decoupled background concordance calculation** based on the [Celery task queue](http://www.celeryproject.org/)  (alternatively, the *multiprocessing* package can be used)
* completely **rewritten client-side code** (AMD modules, code separated from templates)
* improved logging, error processing and debugging support
* improved code documentation

### new features

* support for **spoken corpora** - defined segments can be played back as audio
* support for **user-defined line groups**
* **persistent URLs for large queries** - you can send a link to someone even if the query was in megabytes
* access to **previous queries**
* easy **access to favorite corpora** (subcorpora, aligned corpora)
* **interactive subcorpus selection** - you can select text types and see how other attributes' available values changed
* **interactive PoS tag tool** - in case of positional PoS tag formats an interactive tool can be used to write tag queries
* a concordance/frequency/collocation listing can be **saved in Excel format** (xlsx)
* a correct (i.e. the one calculating only with selected text types) i.p.m. can be calculated on-demand for ad-hoc subcorpora

### enhanced user interface

* improved user interface and design
* extended corpora information (size, structures, attributes, citation information)
* concordance results contain also the [Average Reduced Frequency](http://lrec.elra.info/proceedings/lrec2006/pdf/11_pdf.pdf)
* sub-corpus can be created by a custom CQL expression
* on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
* result shuffling can be pre-set


Requirements
------------

* a WSGI-compatible server
    * recommended setup: [Gunicorn](http://gunicorn.org/) + a reverse proxy (e.g. [Nginx](http://nginx.org/) or Apache2)
    * supported setup: Apache2 with [mod_wsgi](https://code.google.com/p/modwsgi/)
* Python *2.7* and:
    * [Cheetah](http://www.cheetahtemplate.org/) Template Engine
    * [lxml](http://lxml.de/) library
    * [werkzeug](http://werkzeug.pocoo.org/) library (provides WSGI middleware)
    * [PyICU](https://pypi.python.org/pypi/PyICU) library (optional but preferred)
    * [markdown](https://pypi.python.org/pypi/Markdown) library (optional, for formatted corpora references)
    * [openpyxl](https://pythonhosted.org/openpyxl/) library (optional, for XLSX export)
* corpus search engine [Manatee](http://nlp.fi.muni.cz/trac/noske)
    * versions from *2.83.3* to *2.137.2* are supported (the latest one is highly recommended); unless there is an incompatible change in Manatee, newer versions should work too
* a key-value storage
    * any custom implementation ([Redis](http://redis.io/) and [SQLite](https://sqlite.org/) backends are available by default) 
* (optional) [Celery task queue](http://www.celeryproject.org/) task queue for background concordance calculation and maintenance tasks


Build and installation
-----------------------

Please refer to the [doc/INSTALL.md](doc/INSTALL.md) file for details.


Customization and contribution
------------------------------

Please refer to our [Wiki](https://github.com/czcorpus/kontext/wiki/Development-and-customization).
