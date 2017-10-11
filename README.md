![KonText](https://kontext.korpus.cz/files/themes/default/kontext-logo.png)

[![Build status](https://travis-ci.org/czcorpus/kontext.svg?branch=master)](https://travis-ci.org/czcorpus/kontext)

## Introduction

KonText is a **fully featured corpus query interface** for the [Manatee open](http://nlp.fi.muni.cz/trac/noske)
corpus search engine. It started as a fork of the Bonito 2.68 web interface and while still sharing
a lot of code with the original Bonito (now *bonito-open*), KonText is gradually becoming more independent.

It is maintained by the
[Institute of the Czech National Corpus](http://ucnk.ff.cuni.cz/).
Current version contains all the key features of the Bonito 2.98.3 (primarily a support for parallel
corpora).

![KonText screenshot](https://github.com/czcorpus/kontext/tree/master/doc/kontext-screenshot1.jpg)

## Features

### new features

* fully **editable query chain**
    * any operation from a user defined sequence (e.g. query -&gt; filter -&gt; sample -&gt; sorting) can be changed 
    and the whole sequence is then re-executed.
* support for **spoken corpora**
    * defined concordance segments can be played back as audio
    * KWIC detail provides a custom rendering with easily distinguishable speeches
* support for **user-defined line groups**
    * user can define custom numeric tags attached to concordance lines, filter out other lines, review groups ratios
* **improved subcorpus creation**
    * user can easily examine corpus structure by selecting some text types and see how other text type attributes 
      availability changed ("which publishers are there in case only *fiction* is selected?")
    * a custom text types ratio can be defined ("give me 20% fiction and 80% journalism") 
    * a sub-corpus can be created by a custom CQL expression
    * subcorpora are backed up as CQL queries which makes further modification/restoring possible
* **frequency distribution**
    * result caching decreases time required to navigate between pages
    * on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
* **persistent URLs for large queries** - you can send a link to someone even if the query was in megabytes
* access to **previous queries**
* **access to favorite corpora** (subcorpora, aligned corpora)
* **interactive PoS tag tool** - in case of positional PoS tag formats an interactive tool can be used to write tag queries
* a concordance/frequency/collocation listing can be **saved in Excel format** (xlsx)
* a correct (i.e. the one calculating only with selected text types) i.p.m. can be calculated on-demand for ad-hoc subcorpora
* result shuffling can be pre-set
* less full page reloads 

### internal changes

* server-side rewritten as a **WSGI application** (Bonito-open is CGI-based)
* completely **rewritten client-side code** (React+Flux architecture, TypeScript + ES6, modularized)
* modular code design with dynamically loadable plug-ins providing custom functionality implementation (e.g. custom database
adapters, authentication method, corpus listing widgets, HTTP session management)
* fully **decoupled background concordance/frequency/collocation calculation** based on the 
[Celery task queue](http://www.celeryproject.org/)  (alternatively, Python's *multiprocessing* package can be used)
* improved logging, error processing and debugging support
* improved code documentation


## Notable installations

* [Institute of the Czech National Corpus](https://kontext.korpus.cz/first_form)
* [LINDAT](https://ufal.mff.cuni.cz/lindat-kontext)


## Requirements

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
    * versions from *2.83.3* to *2.150* are supported (the latest one is highly recommended); unless there is an incompatible change in Manatee, newer versions should work too
* a key-value storage
    * any custom implementation ([Redis](http://redis.io/) and [SQLite](https://sqlite.org/) backends are available by default) 
* (optional) [Celery task queue](http://www.celeryproject.org/) task queue for (asynchronous) background calculations and maintenance tasks


## Build and installation

Please refer to the [doc/INSTALL.md](doc/INSTALL.md) file for details.


## Customization and contribution

Please refer to our [Wiki](https://github.com/czcorpus/kontext/wiki/Development-and-customization).
